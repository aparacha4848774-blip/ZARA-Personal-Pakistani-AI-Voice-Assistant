import fs from 'fs';
import path from 'path';

/**
 * Strict command allowlist for terminal diagnostics & verification.
 * Only explicit safe operations with constrained arguments are permitted.
 */
/**
 * Strict command specifications for terminal diagnostics & verification.
 * Only exact binaries with constrained argument sets are permitted.
 * Shell interpretation is strictly disallowed.
 */
export const EXACT_ALLOWED_COMMANDS: Array<{ binary: string; args: string[] }> = [
  { binary: 'node', args: ['-v'] },
  { binary: 'node', args: ['--version'] },
  { binary: 'npm', args: ['-v'] },
  { binary: 'npm', args: ['--version'] },
  { binary: 'npm', args: ['test'] },
  { binary: 'npm', args: ['run', 'lint'] },
  { binary: 'npm', args: ['run', 'build'] },
  { binary: 'git', args: ['status'] },
  { binary: 'git', args: ['branch'] },
  { binary: 'git', args: ['log', '-n', '5'] },
  { binary: 'git', args: ['log', '--oneline', '-n', '5'] },
  { binary: 'dir', args: [] },
  { binary: 'ls', args: [] },
  { binary: 'uptime', args: [] },
  { binary: 'date', args: [] },
  { binary: 'whoami', args: [] },
];

export const ALLOWED_COMMAND_PREFIXES = [
  'node -v',
  'npm -v',
  'npm test',
  'npm run lint',
  'npm run build',
  'git status',
  'git branch',
  'git log -n 5',
  'git log --oneline -n 5',
  'dir',
  'ls',
  'echo',
  'uptime',
  'date',
  'whoami',
];

/**
 * Dangerous shell meta-characters and sequences that enable command chaining or subshells.
 */
const FORBIDDEN_SHELL_PATTERNS = [
  /&&/,
  /\|\|/,
  /;/,
  /\|/,
  /`/,
  /\$\(/,
  />/,
  /</,
  /\n/,
  /\r/,
  /\x00/,
];

/**
 * High-risk binaries and operations strictly prohibited.
 */
const FORBIDDEN_COMMAND_TOKENS = [
  'rm',
  'del',
  'rmdir',
  'format',
  'sudo',
  'su',
  'sh',
  'bash',
  'powershell',
  'cmd.exe',
  'curl',
  'wget',
  'fetch',
  'chmod',
  'chown',
  'kill',
  'pkill',
  'taskkill',
  'shutdown',
  'reboot',
  'eval',
  'python',
  'python3',
  'perl',
  'ruby',
];

export interface CommandValidationResult {
  allowed: boolean;
  binary?: string;
  args?: string[];
  sanitizedCommand?: string;
  reason?: string;
}

/**
 * Parses command string into tokens without invoking a shell.
 */
export function tokenizeCommand(command: string): string[] {
  const tokens: string[] = [];
  const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(command)) !== null) {
    if (match[1] !== undefined) {
      tokens.push(match[1]);
    } else if (match[2] !== undefined) {
      tokens.push(match[2]);
    } else {
      tokens.push(match[0]);
    }
  }

  return tokens;
}

export function validateTerminalCommand(rawCommand: string): CommandValidationResult {
  if (!rawCommand || typeof rawCommand !== 'string') {
    return { allowed: false, reason: 'Command must be a non-empty string.' };
  }

  const trimmed = rawCommand.trim();

  // Reject command length exceeding 200 chars
  if (trimmed.length > 200) {
    return { allowed: false, reason: 'Command exceeds maximum permitted length (200 chars).' };
  }

  // Check for forbidden shell metacharacters
  for (const pattern of FORBIDDEN_SHELL_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        allowed: false,
        reason: 'Command contains prohibited shell metacharacters (chaining, pipes, redirects, or subshells).',
      };
    }
  }

  const tokens = tokenizeCommand(trimmed);
  if (tokens.length === 0) {
    return { allowed: false, reason: 'Empty command tokens.' };
  }

  const binary = tokens[0].toLowerCase();
  const args = tokens.slice(1);

  // Check for forbidden executable tokens anywhere in arguments
  for (const token of tokens) {
    const tLower = token.toLowerCase();
    if (FORBIDDEN_COMMAND_TOKENS.includes(tLower)) {
      return {
        allowed: false,
        reason: `Command includes restricted executable token: "${token}".`,
      };
    }
  }

  // Safe echo exception: alphanumeric message only, max 100 chars, no leading dashes
  if (binary === 'echo') {
    const echoText = args.join(' ');
    if (echoText.length > 100) {
      return { allowed: false, reason: 'Echo message exceeds 100 characters.' };
    }
    // Block any flag injection like -e, -n
    if (args.some((a) => a.startsWith('-'))) {
      return { allowed: false, reason: 'Flags are not permitted in echo command.' };
    }
    return {
      allowed: true,
      binary: 'echo',
      args,
      sanitizedCommand: trimmed,
    };
  }

  // Check against EXACT_ALLOWED_COMMANDS specification
  const matchedSpec = EXACT_ALLOWED_COMMANDS.find((spec) => {
    if (spec.binary !== binary) return false;
    if (spec.args.length !== args.length) return false;
    return spec.args.every((expectedArg, idx) => expectedArg.toLowerCase() === args[idx].toLowerCase());
  });

  if (!matchedSpec) {
    return {
      allowed: false,
      reason: `Command is not in the authorized command allowlist. Permitted commands: ${ALLOWED_COMMAND_PREFIXES.slice(0, 8).join(', ')}...`,
    };
  }

  return {
    allowed: true,
    binary: matchedSpec.binary,
    args: matchedSpec.args,
    sanitizedCommand: trimmed,
  };
}

/**
 * Validates file path for project export to strictly prevent directory traversal, symlink escapes, and application overwrites.
 */
export function validateExportPath(baseDir: string, relativePath: string): { valid: boolean; resolvedPath?: string; reason?: string } {
  if (!relativePath || typeof relativePath !== 'string') {
    return { valid: false, reason: 'Filename or path is required.' };
  }

  // Reject null bytes
  if (relativePath.includes('\0')) {
    return { valid: false, reason: 'Null byte injection detected in file path.' };
  }

  // Normalize path separators
  const cleanRelative = relativePath.replace(/\\/g, '/').trim();

  // Reject traversal markers and drive letters
  if (cleanRelative.includes('..') || cleanRelative.startsWith('/') || /^[a-zA-Z]:/.test(cleanRelative)) {
    return { valid: false, reason: 'Directory traversal sequence ("..") or absolute path not allowed.' };
  }

  // Block sensitive credential/secret files and OS configurations in any path segment
  const SENSITIVE_PATTERNS = [
    /^\.env(\..+)?$/i,
    /^\.git/i,
    /^id_(rsa|ed25519|dsa|ecdsa)/i,
    /\.(pem|key)$/i,
    /^\.(npmrc|yarnrc|bashrc|profile|bash_profile|zshrc)$/i,
    /^\.ssh/i,
  ];

  const segments = cleanRelative.split('/').map((s) => s.trim().toLowerCase());
  for (const segment of segments) {
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(segment)) {
        return { valid: false, reason: `Exporting to protected or credential file/directory "${segment}" is forbidden.` };
      }
    }
  }

  const appRootDir = path.resolve(process.cwd());
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(baseDir, cleanRelative);

  // Prevent baseDir from being the application root or parent of app root
  if (resolvedBase === appRootDir || appRootDir.startsWith(resolvedBase + path.sep)) {
    return { valid: false, reason: 'Export directory cannot be the root application directory.' };
  }

  // Must strictly stay inside resolvedBase lexically
  if (!resolvedTarget.startsWith(resolvedBase + path.sep) && resolvedTarget !== resolvedBase) {
    return { valid: false, reason: 'Target path resolves outside authorized export directory.' };
  }

  // Prevent overwriting any real host application root file
  const rootProtectedFiles = ['server.ts', 'vite.config.ts', 'tsconfig.json', 'package.json', 'package-lock.json'];
  for (const rootFile of rootProtectedFiles) {
    const rootPath = path.resolve(appRootDir, rootFile);
    if (resolvedTarget === rootPath) {
      return { valid: false, reason: `Export cannot overwrite root application file "${rootFile}".` };
    }
  }

  // Symlink checks: verify target and all intermediate existing parent directories
  try {
    const realBase = fs.existsSync(resolvedBase) ? fs.realpathSync(resolvedBase) : resolvedBase;

    // 1. Check existing intermediate directory components for symlinks
    let currentDir = path.dirname(resolvedTarget);
    while (currentDir.startsWith(resolvedBase) && currentDir !== resolvedBase) {
      if (fs.existsSync(currentDir)) {
        const dirLstat = fs.lstatSync(currentDir);
        if (dirLstat.isSymbolicLink()) {
          return { valid: false, reason: 'Symlinks in intermediate path components are strictly prohibited.' };
        }
        const realDir = fs.realpathSync(currentDir);
        if (!realDir.startsWith(realBase + path.sep) && realDir !== realBase) {
          return { valid: false, reason: 'Symlink escape detected in intermediate path directory.' };
        }
      }
      currentDir = path.dirname(currentDir);
    }

    // 2. Check resolved target if it exists
    if (fs.existsSync(resolvedTarget)) {
      const lstat = fs.lstatSync(resolvedTarget);
      if (lstat.isSymbolicLink()) {
        return { valid: false, reason: 'Symlinks are strictly prohibited in file exports.' };
      }
      const realTarget = fs.realpathSync(resolvedTarget);
      if (!realTarget.startsWith(realBase + path.sep) && realTarget !== realBase) {
        return { valid: false, reason: 'Symlink escape detected: real path resolves outside export directory.' };
      }
    }
  } catch (fsErr: any) {
    return { valid: false, reason: `Filesystem safety check error: ${fsErr.message}` };
  }

  return { valid: true, resolvedPath: resolvedTarget };
}

/**
 * Validates system authorization, CSRF origins, and Host header integrity for privileged operations.
 * Fails closed in production if ZARA_AUTH_TOKEN is not configured.
 * Does not treat a missing Origin or localhost Host header as proof of authentication.
 */
export function validateAuthorization(
  authHeader?: string,
  zaraAuthHeader?: string,
  originHeader?: string,
  hostHeader?: string,
  clientIp?: string
): { authorized: boolean; reason?: string } {
  const isProduction = process.env.NODE_ENV === 'production';
  const configuredToken = process.env.ZARA_AUTH_TOKEN ? process.env.ZARA_AUTH_TOKEN.trim() : '';

  // 1. Production Fail-Closed: If in production and token is not set, block unconditionally
  if (isProduction && configuredToken.length === 0) {
    return {
      authorized: false,
      reason: 'Production security requirement: ZARA_AUTH_TOKEN must be configured in environment to access privileged operations (fail-closed).',
    };
  }

  // 2. Extract any provided token (Bearer or X-ZARA-AUTH)
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const providedToken = bearer || (typeof zaraAuthHeader === 'string' && zaraAuthHeader.trim().length > 0 ? zaraAuthHeader.trim() : null);

  // 3. Token Verification: When ZARA_AUTH_TOKEN is configured, verify exact match
  if (configuredToken.length > 0) {
    if (!providedToken || providedToken !== configuredToken) {
      return {
        authorized: false,
        reason: 'Unauthorized: valid ZARA_AUTH_TOKEN required for this operation.',
      };
    }
  }

  // 4. Non-production without configured token: require either provided token or verified local origin
  if (configuredToken.length === 0) {
    // "Do not treat a missing Origin header or a localhost Host header as authentication."
    if (!providedToken && !originHeader) {
      return {
        authorized: false,
        reason: 'Unauthorized: missing authentication token and missing Origin verification.',
      };
    }
  }

  // 5. Host header spoofing protection: Detect remote client claiming localhost Host
  const rawIp = (clientIp || '').trim();
  const normalizedIp = rawIp.replace(/^::ffff:/, '');
  const isLoopbackIp =
    !normalizedIp ||
    normalizedIp === '127.0.0.1' ||
    normalizedIp === '::1' ||
    normalizedIp === 'localhost' ||
    normalizedIp === 'test';

  const cleanHost = hostHeader ? hostHeader.split(':')[0].toLowerCase().trim() : '';
  const isLocalhostHost = cleanHost === 'localhost' || cleanHost === '127.0.0.1';

  if (isLocalhostHost && !isLoopbackIp) {
    return {
      authorized: false,
      reason: `Forbidden: spoofed localhost Host header from non-local IP "${clientIp}".`,
    };
  }

  // 6. CSRF & Host header protection: verify origin match
  if (originHeader) {
    try {
      const originUrl = new URL(originHeader);
      const originHost = originUrl.hostname.toLowerCase();

      if (!cleanHost) {
        return {
          authorized: false,
          reason: 'Forbidden: missing Host header with Origin present.',
        };
      }

      // Direct host match
      const isDirectMatch = originHost === cleanHost;

      // Local development hosts
      const isBothLoopback =
        (originHost === 'localhost' || originHost === '127.0.0.1') &&
        (cleanHost === 'localhost' || cleanHost === '127.0.0.1');

      if (!isDirectMatch && !isBothLoopback) {
        return {
          authorized: false,
          reason: `Forbidden: cross-origin request from origin "${originHeader}" is rejected (CSRF protection).`,
        };
      }
    } catch {
      return { authorized: false, reason: 'Forbidden: invalid origin header format.' };
    }
  }

  return { authorized: true };
}

/**
 * Validates URLs for browser launch
 */
export function validateSafeUrl(rawUrl: string): { valid: boolean; sanitizedUrl?: string; reason?: string } {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, reason: 'URL string is required.' };
  }

  const trimmed = rawUrl.trim();
  let parsed: URL;

  try {
    const withProto = trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `https://${trimmed}`;
    parsed = new URL(withProto);
  } catch (err) {
    return { valid: false, reason: 'Invalid URL format.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, reason: 'Only HTTP and HTTPS protocols are allowed.' };
  }

  // Prevent dangerous characters in hostname
  if (/[;<>&`$"'|\\^]/.test(parsed.hostname) || /[;<>&`$"'|\\^]/.test(parsed.search)) {
    return { valid: false, reason: 'URL contains prohibited command-injection characters.' };
  }

  return { valid: true, sanitizedUrl: parsed.toString() };
}

/**
 * Allowlist for desktop application launch
 */
export const ALLOWED_APPS: Record<string, { win: string; mac: string; linux: string }> = {
  notepad: { win: 'notepad.exe', mac: 'open -a TextEdit', linux: 'gedit' },
  calculator: { win: 'calc.exe', mac: 'open -a Calculator', linux: 'gnome-calculator' },
  calc: { win: 'calc.exe', mac: 'open -a Calculator', linux: 'gnome-calculator' },
  chrome: { win: 'start chrome', mac: 'open -a "Google Chrome"', linux: 'google-chrome' },
  vscode: { win: 'code', mac: 'code', linux: 'code' },
  'vs code': { win: 'code', mac: 'code', linux: 'code' },
  taskmgr: { win: 'taskmgr.exe', mac: 'open -a "Activity Monitor"', linux: 'gnome-system-monitor' },
};

export function validateSafeApp(appName: string): { allowed: boolean; command?: { win: string; mac: string; linux: string }; reason?: string } {
  if (!appName || typeof appName !== 'string') {
    return { allowed: false, reason: 'Application name is required.' };
  }

  const key = appName.toLowerCase().trim();
  const matched = ALLOWED_APPS[key];

  if (!matched) {
    return {
      allowed: false,
      reason: `Application "${appName}" is not in the system allowlist. Allowed apps: ${Object.keys(ALLOWED_APPS).join(', ')}.`,
    };
  }

  return { allowed: true, command: matched };
}
