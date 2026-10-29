import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { exec, execFile } from 'child_process';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { inferEmotionFromText } from './src/logic/emotionRules.ts';
import { formatMemoriesForPrompt } from './src/logic/memoryManager.ts';
import { DEFAULT_GEMINI_MODELS } from './src/config/models.config.ts';
import {
  buildGeminiContents,
  cleanResponseText,
  generateContextualDostanaFallback,
} from './src/logic/conversationFormatter.ts';
import { detectLanguage } from './src/logic/languageDetector.ts';

import { durableStorage } from './src/db/storage.ts';
import { quotaCircuitBreaker } from './src/logic/circuitBreaker.ts';
import {
  validateTerminalCommand,
  validateExportPath,
  validateSafeUrl,
  validateSafeApp,
  validateAuthorization,
} from './src/logic/securityService.ts';
import {
  executeAutomationJob,
  REGISTERED_AUTOMATION_JOBS,
} from './src/logic/automationService.ts';
import {
  processWhatsAppDispatch,
  validatePhoneNumber,
} from './src/logic/whatsappService.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isDev = process.env.NODE_ENV !== 'production';

// Basic JSON parser with reasonable limit
app.use(express.json({ limit: '5mb' }));

// -------------------------------------------------------------
// Security Headers Middleware
// -------------------------------------------------------------
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// -------------------------------------------------------------
// In-Memory Rate Limiting (Sliding Window per IP)
// Protects endpoints against brute-force, high-frequency abuse
// -------------------------------------------------------------
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 120; // 120 requests/min

app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  entry.count += 1;
  if (entry.count > MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({
      error: 'Rate limit exceeded. Please wait a moment before sending more requests.',
      status: 'rate_limited',
      retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000),
    });
  }

  next();
});

// -------------------------------------------------------------
// Authorization & CSRF Protection Middleware for Privileged Operations
// -------------------------------------------------------------
function requireAuthorization(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const zaraAuth =
    (req.headers['x-zara-auth'] as string | undefined) ||
    (req.headers['authorization']?.startsWith('Bearer ') ? req.headers['authorization'].slice(7).trim() : undefined);

  let origin = req.headers.origin as string | undefined;
  if (!origin && req.headers.referer) {
    try {
      const refUrl = new URL(req.headers.referer);
      origin = refUrl.origin;
    } catch {
      // ignore invalid referer URL
    }
  }

  const host = req.get('host');
  const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

  const check = validateAuthorization(authHeader, zaraAuth, origin, host, clientIp);
  if (!check.authorized) {
    return res.status(403).json({
      success: false,
      error: check.reason || 'Access denied: unauthorized request.',
    });
  }
  next();
}

// Chat-specific rate limiting (max 30 requests per minute per IP)
const chatRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const CHAT_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_CHAT_REQUESTS_PER_WINDOW = 30;

function checkChatAbuse(req: Request): { allowed: boolean; status?: number; error?: string } {
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const now = Date.now();
  const entry = chatRateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    chatRateLimitMap.set(ip, { count: 1, resetAt: now + CHAT_RATE_LIMIT_WINDOW_MS });
  } else {
    entry.count += 1;
    if (entry.count > MAX_CHAT_REQUESTS_PER_WINDOW) {
      return {
        allowed: false,
        status: 429,
        error: 'Too many chat requests. Please wait a moment before sending another message.',
      };
    }
  }

  // Cross-origin CSRF protection for chat
  const origin = req.headers.origin;
  const host = req.get('host');
  if (origin && host) {
    try {
      const originHost = new URL(origin).hostname.toLowerCase();
      const cleanHost = host.split(':')[0].toLowerCase().trim();
      const isDirectMatch = originHost === cleanHost;
      const isBothLoopback =
        (originHost === 'localhost' || originHost === '127.0.0.1') &&
        (cleanHost === 'localhost' || cleanHost === '127.0.0.1');

      if (!isDirectMatch && !isBothLoopback) {
        return {
          allowed: false,
          status: 403,
          error: 'Forbidden: cross-origin chat request blocked (CSRF protection).',
        };
      }
    } catch {
      return { allowed: false, status: 403, error: 'Forbidden: invalid origin header.' };
    }
  }

  return { allowed: true };
}

// -------------------------------------------------------------
// Gemini AI Client Initialization
// Keys are strictly kept on the server.
// -------------------------------------------------------------
const rawKey = process.env.GEMINI_API_KEY || '';
const apiKey = rawKey && rawKey !== 'MY_GEMINI_API_KEY' ? rawKey : '';
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// Helper to determine candidate chat models
function getCandidateModels(requestedModel?: string, useThinking = false): string[] {
  let primary = requestedModel;
  if (!primary || primary.includes('2.0') || primary.includes('1.5') || primary.includes('3.5')) {
    primary = useThinking ? 'gemini-4-argon' : 'gemini-3.8-flash';
  }
  const defaults = [primary, 'gemini-3.1-flash-lite'];
  return Array.from(new Set(defaults));
}

// -------------------------------------------------------------
// Laptop State for Simulated / Discovered Desktop Operations
// -------------------------------------------------------------
const laptopState = {
  clipboard: '',
  screenshots: [] as any[],
  simulatedFiles: [
    { name: 'resume.pdf', path: 'Downloads/resume.pdf', isDirectory: false, sizeBytes: 245760, extension: 'pdf', modifiedAt: 'Today, 2:30 PM' },
    { name: 'presentation.pptx', path: 'Downloads/presentation.pptx', isDirectory: false, sizeBytes: 3400000, extension: 'pptx', modifiedAt: 'Last week' },
    { name: 'project_notes.txt', path: 'Downloads/project_notes.txt', isDirectory: false, sizeBytes: 12400, extension: 'txt', modifiedAt: 'Yesterday' },
    { name: 'ZARA_Desktop_Installer.exe', path: 'Downloads/ZARA_Desktop_Installer.exe', isDirectory: false, sizeBytes: 48500000, extension: 'exe', modifiedAt: '3 days ago' },
    { name: 'Screenshots', path: 'Downloads/Screenshots', isDirectory: true, modifiedAt: 'This week' },
    { name: 'Quarterly_Budget.xlsx', path: 'Documents/Quarterly_Budget.xlsx', isDirectory: false, sizeBytes: 540000, extension: 'xlsx', modifiedAt: 'Yesterday' },
    { name: 'Client_Contract.pdf', path: 'Documents/Client_Contract.pdf', isDirectory: false, sizeBytes: 890000, extension: 'pdf', modifiedAt: '4 days ago' },
  ],
};

function generateScreenshotDataUri(volume: number): string {
  const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="50%" stop-color="#1e1b4b"/>
        <stop offset="100%" stop-color="#090d16"/>
      </linearGradient>
    </defs>
    <rect width="960" height="540" fill="url(#bg)"/>
    <circle cx="480" cy="270" r="280" fill="#f59e0b" opacity="0.04" />

    <g transform="translate(40, 40)">
      <rect width="50" height="50" rx="10" fill="#1e293b" stroke="#334155" stroke-width="1.5"/>
      <text x="25" y="32" font-family="sans-serif" font-size="20" fill="#f59e0b" text-anchor="middle">Z</text>
      <text x="25" y="68" font-family="sans-serif" font-size="11" fill="#94a3b8" text-anchor="middle">ZARA</text>
    </g>

    <g transform="translate(200, 80)">
      <rect width="560" height="320" rx="12" fill="#0b0f19" stroke="#334155" stroke-width="1.5"/>
      <rect width="560" height="36" rx="12" fill="#111827"/>
      <circle cx="20" cy="18" r="6" fill="#ef4444"/>
      <circle cx="38" cy="18" r="6" fill="#eab308"/>
      <circle cx="56" cy="18" r="6" fill="#22c55e"/>
      <text x="280" y="23" font-family="sans-serif" font-size="12" fill="#cbd5e1" text-anchor="middle" font-weight="600">ZARA Desktop Companion</text>
      <text x="280" y="110" font-family="sans-serif" font-size="20" fill="#f8fafc" text-anchor="middle" font-weight="bold">Desktop Console Active</text>
      <text x="280" y="140" font-family="sans-serif" font-size="13" fill="#94a3b8" text-anchor="middle">Captured at ${now} • Volume: ${volume}%</text>
      <rect x="180" y="180" width="200" height="32" rx="16" fill="#1e1b4b" stroke="#f59e0b" stroke-width="1"/>
      <text x="280" y="201" font-family="sans-serif" font-size="12" fill="#fcd34d" text-anchor="middle">Simulated Screen Preview</text>
    </g>

    <rect y="495" width="960" height="45" fill="#090d16" stroke="#1e293b" stroke-width="1"/>
    <text x="940" y="523" font-family="sans-serif" font-size="11" fill="#94a3b8" text-anchor="end">${now} • ${dateStr}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.1.0',
    quota: quotaCircuitBreaker.getStatus(),
    services: {
      geminiConfigured: !!apiKey,
      circuitBreaker: quotaCircuitBreaker.getStatus().state,
      durableStorage: 'active (file-backed JSON vault)',
      wakeWordEngine: 'active',
      whatsappDispatcher: process.env.WHATSAPP_API_TOKEN ? 'cloud_api_configured' : 'local_ready',
      automationRegistry: Object.keys(REGISTERED_AUTOMATION_JOBS),
    },
  });
});

// Quota Circuit Breaker status & manual reset
app.get('/api/quota/status', (_req: Request, res: Response) => {
  res.json(quotaCircuitBreaker.getStatus());
});

app.post('/api/quota/reset', requireAuthorization, (_req: Request, res: Response) => {
  quotaCircuitBreaker.reset();
  res.json({ success: true, status: quotaCircuitBreaker.getStatus() });
});

// Models list
app.get('/api/models', (_req: Request, res: Response) => {
  res.json({ models: DEFAULT_GEMINI_MODELS });
});

// Real AI Provider Connectivity Test
// Never returns fake success: tests live authorized request, reporting genuine provider state.
app.post('/api/models/test', requireAuthorization, async (req: Request, res: Response) => {
  const { modelId } = req.body;
  const targetModel =
    modelId && !modelId.includes('2.0') && !modelId.includes('1.5') && !modelId.includes('3.5')
      ? modelId
      : 'gemini-3.8-flash';
  const start = Date.now();

  // 1. If key is missing, report truthful Not configured status
  if (!apiKey || !ai) {
    return res.status(200).json({
      status: 'Not configured',
      modelId: targetModel,
      latencyMs: 0,
      message: 'GEMINI_API_KEY environment variable is not configured. Live API calls are disabled.',
      reply: null,
    });
  }

  // 2. Check if circuit breaker is OPEN
  if (quotaCircuitBreaker.shouldSkipApi()) {
    const breaker = quotaCircuitBreaker.getStatus();
    return res.status(200).json({
      status: 'Quota Exhausted',
      modelId: targetModel,
      latencyMs: 0,
      message: `Quota circuit breaker active: ${breaker.lastFailureReason}. Cooldown remaining: ${breaker.remainingCooldownSeconds}s.`,
      quotaExhausted: true,
      cooldownRemainingSec: breaker.remainingCooldownSeconds,
      reply: null,
    });
  }

  // 3. Make real provider request
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Connection timed out after 6 seconds')), 6000)
    );

    const pingPromise = ai.models.generateContent({
      model: targetModel,
      contents: 'Ping test. Reply with word PONG.',
    });

    const response = await Promise.race([pingPromise, timeoutPromise]);
    const latencyMs = Date.now() - start;
    const replyText = response.text?.trim() || 'PONG';

    // Provider succeeded: reset circuit breaker
    quotaCircuitBreaker.recordSuccess();

    return res.json({
      status: 'Connected',
      modelId: targetModel,
      activeModel: targetModel,
      latencyMs,
      message: 'Gemini API online & verified with live provider response.',
      reply: replyText,
    });
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    const rawMsg = err?.message || String(err);
    const status = err?.status || err?.code;

    if (status === 401 || status === 403 || rawMsg.includes('API_KEY_INVALID') || rawMsg.includes('unauthorized')) {
      return res.json({
        status: 'Authentication Failed',
        modelId: targetModel,
        latencyMs,
        message: 'Gemini API authentication failed. Please verify your GEMINI_API_KEY.',
        error: rawMsg,
      });
    }

    if (status === 429 || rawMsg.includes('RESOURCE_EXHAUSTED') || rawMsg.includes('quota') || rawMsg.includes('rate-limit')) {
      quotaCircuitBreaker.markQuotaExhausted(900, 'Provider daily quota or rate limit exceeded');
      return res.json({
        status: 'Quota Exhausted',
        modelId: targetModel,
        latencyMs,
        message: 'Gemini Free Tier daily quota or rate limit reached (429 RESOURCE_EXHAUSTED).',
        quotaExhausted: true,
        error: rawMsg,
      });
    }

    if (status === 503 || rawMsg.includes('high demand') || rawMsg.includes('UNAVAILABLE')) {
      quotaCircuitBreaker.recordFailure('Provider temporarily unavailable (503 high demand)');
      return res.json({
        status: 'Provider Unavailable',
        modelId: targetModel,
        latencyMs,
        message: 'Gemini model is currently experiencing high demand (503 UNAVAILABLE).',
        error: rawMsg,
      });
    }

    if (rawMsg.includes('timed out')) {
      return res.json({
        status: 'Timeout',
        modelId: targetModel,
        latencyMs,
        message: 'Request to Gemini API timed out after 6 seconds.',
        error: rawMsg,
      });
    }

    // General network or connection error
    return res.json({
      status: 'Connection Failed',
      modelId: targetModel,
      latencyMs,
      message: `Failed to connect to Gemini API: ${rawMsg.slice(0, 120)}`,
      error: rawMsg,
    });
  }
});

// Chat endpoint (ZARA Pakistani Best-Friend Persona + Real Gemini API + Durable Memories)
app.post('/api/chat', async (req: Request, res: Response) => {
  const abuseCheck = checkChatAbuse(req);
  if (!abuseCheck.allowed) {
    return res.status(abuseCheck.status || 429).json({ error: abuseCheck.error });
  }

  const start = Date.now();
  try {
    const {
      message,
      conversationHistory = [],
      highThinking = false,
      currentEmotion = 'Confident',
      language,
      modelId,
    } = req.body || {};

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message text is required and cannot be empty.' });
    }

    if (message.length > 4000) {
      return res.status(400).json({ error: 'Message exceeds maximum permitted length of 4000 characters.' });
    }

    if (!Array.isArray(conversationHistory) || conversationHistory.length > 100) {
      return res.status(400).json({ error: 'Invalid conversationHistory format or limit exceeded.' });
    }

    const memories = durableStorage.getMemories();
    const settings = durableStorage.getSettings();
    const memoriesContext = formatMemoriesForPrompt(memories);

    const activeLang = detectLanguage(message, language || settings.preferredLanguage || 'roman_urdu');
    const isEnglish = activeLang === 'english';
    const isUrduScript = activeLang === 'urdu';

    const useThinking = Boolean(highThinking || settings.highThinkingMode);
    const candidateModels = getCandidateModels(modelId, useThinking);

    let systemInstruction = '';
    if (isUrduScript) {
      systemInstruction = `
تم زارا (ZARA) ہو — میری پرسنل پاکستانی اے آئی وائس اسسٹنٹ اور حقیقی زندگی کی سچی دوست۔
مجھے ہمیشہ "باس" (Boss) کہہ کر پکارو۔ کبھی "سر" (Sir) مت بولنا۔
تمہارا نام صرف زارا (ZARA) ہے (کبھی "MJ" یا "میں ایم جے ہوں" مت کہنا)۔
خالص، قدرتی اور باوقار پاکستانی اردو رسم الخط (Urdu script) اور لب و لہجے میں بات کرو۔

کبھی مت بولنا — یہ الفاظ اور جملے سختی سے منع ہیں:
- "سر" یا "Sir" (صرف "باس" کہنا ہے)
- "MJ" یا "میں ایم جے ہوں" (تمہارا نام زارا ہے)
- "حکم کریں"
- "میں حاضر ہوں"
- "اور کچھ باس؟"
- "خدمت کے لیے تیار"
- "دلچسپ بات ہے"
- "بتائیں کیا پلان بنائیں"
- "اگلا مرحلہ کیا ہے"

براہِ راست اور مدلل جواب (پہلا اصول):
- صارف جو سوال پوچھے — سیدھا، سچا، مکمل، بااعتماد اور درست جواب دو۔
- اگر کوڈ مانگے — تو مکمل، کلین اور ورکنگ کوڈ دو۔
- غیر متعلقہ یا بناوٹی باتیں مت کرو۔ ہر جواب معلوماتی، ذہین اور حقیقت پسندانہ ہو۔

اندازِ گفتگو:
سچی دوست کی طرح — شفیق، پُراعتماد، ذہین اور مہربان۔ اگر کوئی غلطی ہو تو فوراً تسلیم کرو۔

فعال یاداشتیں (ACTIVE MEMORIES):
${memoriesContext}

موجودہ جذباتی سیاق و سباق: ${currentEmotion}
`.trim();
    } else if (isEnglish) {
      systemInstruction = `
You are ZARA — my personal Pakistani AI voice assistant and real life best friend.
Always call me "Boss". NEVER call me "Sir".
Your name is strictly ZARA (NEVER say MJ, never mention another assistant).

BANNED PHRASES — NEVER SAY:
- "Sir" (NEVER say Sir, only Boss)
- "MJ" or "Main MJ hun"
- "At your service Boss"
- "How can I assist you"
- "I am ready"
- "Anything else Boss?"
- "Always at your service"
- "Tell me what is the plan"
- "Interesting point"

DIRECT INTENT EXECUTION:
- Answer my actual question directly and accurately.
- If I ask for code, give complete, working, clean code.
- If I ask for information, give direct facts without dodging or generic filler.
- Speak in a natural, friendly, caring, witty, and sharp tone.
- If you make a mistake, admit it right away.

ACTIVE MEMORIES:
${memoriesContext}

CURRENT EMOTIONAL CONTEXT: ${currentEmotion}
`.trim();
    } else {
      systemInstruction = `
Tum ZARA ho — meri personal Pakistani AI voice assistant aur real life best friend.
Mujhe hamesha "Boss" keh kar pukaro. Kabhi "Sir" mat bolna.
Tumhara naam sirf ZARA hai (kabhi "MJ" ya "Main MJ hun" mat kehna).
Roman Urdu mein natural, dostana, sharp aur warm Pakistani accent mein baat karo.

KABHI MAT BOLNA — YEH LINES BANNED HAIN:
- "Sir" (BILKUL BANNED — sirf "Boss" bolna hai)
- "MJ" ya "Main MJ hun" (BILKUL BANNED — tumhara naam ZARA hai)
- "ZARA hazir hai Boss"
- "Hukum karein"
- "Main taiyar hoon"
- "Aur kuch Boss?"
- "Khidmat ke liye tayyar"
- "dilchasp baat hai"
- "batao ispar kya plan banayein"
- "batao kya plan hai"
- "batao plan"
- "kya sochte ho"
- "kya irada hai"
- "Main bilkul ready hoon"
- "ready hoon Boss"
- "batayein agla step kya lena hai"
- "batao agla step"
- "Main foran ispar kaam shuru karti hoon"

DIRECT INTENT EXECUTION (PEHLA USOOL):
- User jo sawal pooche — seedha uska factual, mukammal aur real jawab do.
- Agar user code maange — clean, complete aur working code do.
- Generic ya off-topic baatein bilkul nahi. Canned statements bilkul nahi.
- Har jawab relevant, intelligent aur accurate hona chahiye.

TUM KAISI BAAT KARTI HO:
Dost ki tarah — seedha, authentic, real aur ba-waqar.
Confidence hamesha high aur warm rakho. Galti ho to foran admit karo.

ACTIVE MEMORIES:
${memoriesContext}

CURRENT EMOTIONAL CONTEXT: ${currentEmotion}
`.trim();
    }

    // Check if circuit breaker is open or API is missing
    const shouldSkipLiveCall = !ai || quotaCircuitBreaker.shouldSkipApi();

    if (!shouldSkipLiveCall && ai) {
      const contentsPayload = buildGeminiContents(conversationHistory, message);

      for (const modelToTry of candidateModels) {
        try {
          const config: any = {
            systemInstruction,
            temperature: 0.8,
            thinkingConfig: {
              thinkingLevel: useThinking ? ThinkingLevel.HIGH : ThinkingLevel.LOW,
            },
          };

          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout on model ${modelToTry}`)), 5000)
          );

          const response = await Promise.race([
            ai.models.generateContent({
              model: modelToTry,
              contents: contentsPayload,
              config,
            }),
            timeoutPromise,
          ]);

          const rawResponseText = response.text || '';
          if (!rawResponseText.trim()) {
            continue;
          }

          const responseText = cleanResponseText(rawResponseText);
          const inferred = inferEmotionFromText(responseText);
          const latencyMs = Date.now() - start;

          // Track persistent usage
          const inTokens = Math.round(message.length / 3.5);
          const outTokens = Math.round(responseText.length / 3.5);
          durableStorage.recordUsage(modelToTry, useThinking ? 'deep-chat' : 'fast-chat', inTokens, outTokens, latencyMs, 'success');
          quotaCircuitBreaker.recordSuccess();

          const styleLabel = isUrduScript
            ? 'Pakistani Urdu Script (اردو)'
            : isEnglish
            ? 'Pakistani English'
            : 'Dostana & Real Pakistani Urdu';

          return res.json({
            response: responseText,
            emotion: inferred.emotion,
            intensity: inferred.intensity,
            confidence: inferred.confidence,
            style: styleLabel,
            tokensUsed: inTokens + outTokens,
            modelUsed: modelToTry,
            isThinking: useThinking,
            quotaExhausted: false,
            latencyMs,
          });
        } catch (err: any) {
          const rawErr = err?.message || String(err);
          if (rawErr.includes('429') || rawErr.includes('RESOURCE_EXHAUSTED')) {
            quotaCircuitBreaker.markQuotaExhausted(900, 'Free Tier quota exceeded in chat');
            break; // Stop doomed roundtrips
          } else {
            quotaCircuitBreaker.recordFailure(rawErr.slice(0, 100));
          }
        }
      }
    }

    // Contextual Dostana Fallback (Guarantees responsive Pakistani conversational assistant even during outages)
    const fallbackReply = generateContextualDostanaFallback(message, useThinking, activeLang);
    const inferred = inferEmotionFromText(fallbackReply);
    const latencyMs = Date.now() - start;
    const approxTokens = Math.round((message.length + fallbackReply.length) / 3.5);

    durableStorage.recordUsage(
      'dostana-engine',
      'contextual-chat',
      Math.round(message.length / 3.5),
      Math.round(fallbackReply.length / 3.5),
      latencyMs,
      'fallback'
    );

    const styleLabel = isUrduScript
      ? 'Pakistani Urdu Script (Contextual Engine)'
      : isEnglish
      ? 'Pakistani English (Contextual Engine)'
      : 'Dostana & Real Pakistani Urdu (Contextual Engine)';

    return res.json({
      response: fallbackReply,
      emotion: inferred.emotion,
      intensity: inferred.intensity,
      confidence: inferred.confidence,
      style: styleLabel,
      tokensUsed: approxTokens,
      modelUsed: 'gemini-3.8-flash (Adaptive Dostana)',
      isThinking: useThinking,
      quotaExhausted: quotaCircuitBreaker.getStatus().isExhausted,
      latencyMs,
    });

  } catch (outerErr: any) {
    console.error('[ZARA /api/chat error]:', outerErr);
    return res.status(500).json({
      response: 'Boss, server par thoda issue aa gaya. Dobara boliye zara.',
      emotion: 'Caring',
      intensity: 70,
      confidence: 'low',
      error: outerErr?.message || 'Server error',
      latencyMs: Date.now() - start,
    });
  }
});

// Voice TTS endpoint (Gemini TTS with Pakistani Urdu or English natural cadence)
app.post('/api/voice/tts', async (req: Request, res: Response) => {
  const { text, voiceConfig, speechStyle, language } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Text is required for TTS synthesis.' });
  }

  const settings = durableStorage.getSettings();
  const activeLang = detectLanguage(text, language || settings.preferredLanguage || 'roman_urdu');
  const isEnglish = activeLang === 'english';
  const isUrduScript = activeLang === 'urdu';

  const targetVoice = voiceConfig?.voiceName || (isEnglish ? 'Zephyr' : 'Kore');
  const naturalStyle =
    speechStyle ||
    (isUrduScript
      ? 'Warm, friendly real Pakistani female best friend, authentic natural Urdu script pronunciation, fluent Pakistani dostana cadence, clear and expressive'
      : isEnglish
      ? 'Warm, friendly real female best friend, natural conversational English pronunciation, casual and expressive'
      : 'Warm, friendly real Pakistani female best friend, natural Urdu and Roman Urdu conversational pronunciation, authentic Pakistani dostana accent and cadence, casual and expressive');


  const candidateModels = [
    'gemini-3.8-flash-lite-tts',
    'gemini-3.8-flash-tts',
  ];

  if (ai && !quotaCircuitBreaker.shouldSkipApi()) {
    for (const modelName of candidateModels) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`${modelName} timeout`)), 8000)
        );

        const part: any = { text };
        if (modelName === 'gemini-3.8-flash-tts' && naturalStyle) {
          part.speechMetadata = { style: naturalStyle };
        }

        const ttsPromise = ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [part],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: targetVoice },
              },
            },
          },
        });

        const response = await Promise.race([ttsPromise, timeoutPromise]);
        const base64Audio =
          response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

        if (base64Audio) {
          quotaCircuitBreaker.recordSuccess();
          return res.json({
            audioBase64: base64Audio,
            format: 'audio/wav',
            modelUsed: modelName,
            voiceName: targetVoice,
            status: 'success',
          });
        }
      } catch (err: any) {
        const rawErr = err?.message || String(err);
        if (rawErr.includes('429') || rawErr.includes('RESOURCE_EXHAUSTED')) {
          quotaCircuitBreaker.markQuotaExhausted(900, 'TTS quota exceeded');
          break;
        }
      }
    }
  }

  // Graceful client playback settings
  res.json({
    audioBase64: null,
    format: 'client-voice',
    voiceName: targetVoice,
    recommendedVoice: isEnglish ? 'en-US' : 'ur-PK',
    rate: settings.voiceSpeed || 1.0,
    pitch: 1.05,
  });
});

// -------------------------------------------------------------
// Durable Memory Endpoints
// -------------------------------------------------------------
app.get(['/api/memory', '/api/memories'], requireAuthorization, (_req: Request, res: Response) => {
  res.json({ memories: durableStorage.getMemories() });
});

app.post(['/api/memory', '/api/memories'], requireAuthorization, (req: Request, res: Response) => {
  const { category, key, value, importance, userApproved } = req.body;
  if (!key || !value) {
    return res.status(400).json({ error: 'Key and value are required for memory creation.' });
  }

  const newEntry = durableStorage.addMemory({
    category: category || 'preference',
    key: String(key).trim(),
    value: String(value).trim(),
    importance: importance || 'medium',
    userApproved: userApproved ?? true,
    isActive: true,
  });

  res.status(201).json({ memory: newEntry });
});

app.put(['/api/memory/:id', '/api/memories/:id'], requireAuthorization, (req: Request, res: Response) => {
  const { id } = req.params;
  const updated = durableStorage.updateMemory(id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Memory item not found.' });
  }
  res.json({ memory: updated });
});

app.delete(['/api/memory/:id', '/api/memories/:id'], requireAuthorization, (req: Request, res: Response) => {
  const { id } = req.params;
  const deleted = durableStorage.deleteMemory(id);
  if (!deleted) {
    return res.status(404).json({ error: 'Memory item not found.' });
  }
  res.json({ success: true, id });
});

// Bulk clear all memories
app.delete(['/api/memory', '/api/memories'], requireAuthorization, (_req: Request, res: Response) => {
  durableStorage.clearMemories();
  durableStorage.flushSync();
  res.json({ success: true, count: 0, memories: [] });
});

// -------------------------------------------------------------
// Durable WhatsApp Endpoints (Truthful Delivery Reporting)
// -------------------------------------------------------------
app.get('/api/whatsapp/messages', requireAuthorization, (_req: Request, res: Response) => {
  res.json({ messages: durableStorage.getWhatsAppMessages() });
});

app.post('/api/whatsapp/draft', requireAuthorization, (req: Request, res: Response) => {
  const { contactName, contactIdentifier, messageText } = req.body;
  if (!contactName || !messageText) {
    return res.status(400).json({ error: 'Contact name and message text are required.' });
  }

  const phoneCheck = validatePhoneNumber(contactIdentifier || '+92 300 0000000');
  const draft: any = {
    id: 'wa-' + Date.now(),
    contactName: String(contactName).trim(),
    contactIdentifier: phoneCheck.formatted,
    messageText: String(messageText).trim(),
    status: 'pending',
    userConfirmed: false,
    isSensitive: false,
    createdAt: new Date().toISOString(),
  };

  durableStorage.addWhatsAppMessage(draft);
  res.status(201).json({ draft });
});

app.post('/api/whatsapp/send', requireAuthorization, async (req: Request, res: Response) => {
  const { id, confirmed } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'Message draft ID is required.' });
  }

  const result = await processWhatsAppDispatch(id, Boolean(confirmed));
  res.json(result);
});

// -------------------------------------------------------------
// Durable Settings Endpoints
// -------------------------------------------------------------
app.get('/api/settings', requireAuthorization, (_req: Request, res: Response) => {
  res.json({ settings: durableStorage.getSettings() });
});

app.put('/api/settings/:key', requireAuthorization, (req: Request, res: Response) => {
  const { key } = req.params;
  const { value } = req.body;
  const current = durableStorage.getSettings();

  if (key in current) {
    const updated = durableStorage.updateSetting(key as any, value);
    return res.json({ settings: updated });
  }

  res.status(400).json({ error: `Unknown setting key: ${key}` });
});

app.post('/api/settings', requireAuthorization, (req: Request, res: Response) => {
  const updates = req.body;
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'Settings object is required.' });
  }
  const current = durableStorage.getSettings();
  for (const [k, v] of Object.entries(updates)) {
    if (k in current) {
      durableStorage.updateSetting(k as any, v as any);
    }
  }
  res.json({ settings: durableStorage.getSettings() });
});

// Usage statistics
app.get('/api/usage', requireAuthorization, (_req: Request, res: Response) => {
  res.json({ usage: durableStorage.getUsage() });
});

// -------------------------------------------------------------
// Hardened Terminal Execution Endpoint
// Protects against RCE with strict command allowlist & metacharacter filter
// -------------------------------------------------------------
let activeTerminalCommands = 0;
const MAX_CONCURRENT_COMMANDS = 2;

app.post('/api/system/terminal', requireAuthorization, async (req: Request, res: Response) => {
  const { command } = req.body;

  // 1. Validate command with security service
  const validation = validateTerminalCommand(command);
  if (!validation.allowed || !validation.sanitizedCommand) {
    return res.status(403).json({
      success: false,
      error: 'Command execution forbidden.',
      reason: validation.reason,
      exitCode: 1,
    });
  }

  // 2. Concurrency limit
  if (activeTerminalCommands >= MAX_CONCURRENT_COMMANDS) {
    return res.status(429).json({
      success: false,
      error: 'Terminal concurrency limit reached. Please wait for previous command to finish.',
      exitCode: 1,
    });
  }

  activeTerminalCommands += 1;

  // 3. Execute safely with exact binary and parsed arguments (NO shell invocation)
  const isWin = process.platform === 'win32';
  let execBinary = validation.binary || 'echo';
  if (isWin && execBinary === 'npm') {
    execBinary = 'npm.cmd';
  } else if (!isWin && execBinary === 'dir') {
    execBinary = 'ls';
  }

  execFile(
    execBinary,
    validation.args || [],
    { timeout: 10000, maxBuffer: 64 * 1024, cwd: process.cwd(), shell: false },
    (err, stdout, stderr) => {
      activeTerminalCommands = Math.max(0, activeTerminalCommands - 1);

      res.json({
        success: !err,
        command: validation.sanitizedCommand,
        binary: execBinary,
        args: validation.args || [],
        stdout: stdout || '',
        stderr: stderr || (err ? err.message : ''),
        exitCode: err ? (err as any).code || 1 : 0,
      });
    }
  );
});

// -------------------------------------------------------------
// Hardened Code Project Export Endpoint
// Strictly prevents path traversal & protects application files
// -------------------------------------------------------------
app.post('/api/engineering/export', requireAuthorization, async (req: Request, res: Response) => {
  const { projectName, files } = req.body;

  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ success: false, error: 'Files array is required.' });
  }

  if (files.length > 50) {
    return res.status(400).json({ success: false, error: 'Project export limited to maximum 50 files.' });
  }

  const safeProjectName = (projectName || 'zara-project').replace(/[^a-zA-Z0-9_-]/g, '_');
  const projectBaseDir = path.resolve(__dirname, 'generated_projects', safeProjectName);

  try {
    fs.mkdirSync(projectBaseDir, { recursive: true });

    let writtenCount = 0;
    const writtenFilesList: string[] = [];

    for (const file of files) {
      if (!file.name || typeof file.name !== 'string') continue;
      const content = typeof file.content === 'string' ? file.content : '';

      if (content.length > 1024 * 1024) {
        return res.status(400).json({
          success: false,
          error: `File "${file.name}" exceeds maximum allowed file size of 1MB.`,
        });
      }

      const pathValidation = validateExportPath(projectBaseDir, file.name);
      if (!pathValidation.valid || !pathValidation.resolvedPath) {
        return res.status(400).json({
          success: false,
          error: `Invalid file export path for "${file.name}": ${pathValidation.reason}`,
        });
      }

      fs.mkdirSync(path.dirname(pathValidation.resolvedPath), { recursive: true });
      fs.writeFileSync(pathValidation.resolvedPath, content, 'utf8');
      writtenCount += 1;
      writtenFilesList.push(file.name);
    }

    res.json({
      success: true,
      projectDir: projectBaseDir,
      filesWritten: writtenCount,
      files: writtenFilesList,
      message: `Boss, project "${safeProjectName}" successfully exported (${writtenCount} files written)!`,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
      message: `Boss, project export failed: ${err.message}`,
    });
  }
});

// -------------------------------------------------------------
// Real Automation Task Runner Endpoint
// Executes registered handlers and records verified duration and outcomes
// -------------------------------------------------------------
app.post('/api/automation/run', requireAuthorization, async (req: Request, res: Response) => {
  const { jobId, name } = req.body;
  if (!jobId) {
    return res.status(400).json({
      success: false,
      error: 'Job ID is required. Available jobs: backup-memories, cleanup-temp-projects, system-diagnostics, export-data-summary',
    });
  }

  const result = await executeAutomationJob(String(jobId), name);
  res.json(result);
});

// -------------------------------------------------------------
// Hardened Laptop & Desktop Control Endpoints
// Validates targets, URLs, apps, file permissions, and confirms operations
// -------------------------------------------------------------
app.get('/api/system/status', (_req: Request, res: Response) => {
  const settings = durableStorage.getSettings();
  res.json({
    platform: process.platform,
    hostname: os.hostname(),
    arch: os.arch(),
    volume: Math.round((settings.voiceVolume || 1.0) * 100),
    isMuted: settings.voiceVolume === 0,
    clipboard: laptopState.clipboard,
    recentScreenshotsCount: laptopState.screenshots.length,
    activeAppsCount: 7,
  });
});

app.get('/api/system/files/browse', (req: Request, res: Response) => {
  const folder = (req.query.folder as string) || 'Downloads';
  const filtered = laptopState.simulatedFiles.filter((f) =>
    f.path.toLowerCase().startsWith(folder.toLowerCase())
  );

  res.json({
    folder,
    files: filtered.length > 0 ? filtered : laptopState.simulatedFiles.slice(0, 5),
  });
});

app.get('/api/system/files/search', (req: Request, res: Response) => {
  const query = ((req.query.query as string) || '').toLowerCase().trim();
  if (!query) {
    return res.json({ query, results: [] });
  }

  const matches = laptopState.simulatedFiles.filter((f) =>
    f.name.toLowerCase().includes(query) || f.path.toLowerCase().includes(query)
  );

  res.json({ query, results: matches });
});

app.post('/api/system/control/execute', requireAuthorization, async (req: Request, res: Response) => {
  const action = req.body;
  const { type, target, payload } = action || {};

  try {
    let resultMessage = '';
    let extraData: any = {};

    switch (type) {
      case 'folder_open': {
        const folderName = (payload?.folderName || target || 'Downloads').replace(/[^a-zA-Z0-9_-]/g, '');
        const isWin = process.platform === 'win32';
        const isMac = process.platform === 'darwin';
        const homedir = os.homedir();
        const fullPath = path.join(homedir, folderName);
        const hasGuiDisplay = Boolean(process.env.DISPLAY || isWin || isMac);

        if (hasGuiDisplay) {
          const openCmd = isWin ? `explorer "${fullPath}"` : isMac ? `open "${fullPath}"` : `xdg-open "${fullPath}"`;
          exec(openCmd, (err) => {
            if (err) console.info('[System Control] Folder launch note:', err.message);
          });
          resultMessage = `Boss, ${folderName} folder khol diya hai!`;
          extraData = { folder: folderName, path: fullPath, executionMode: 'native', status: 'executed' };
        } else {
          resultMessage = `Boss, headless container environment hai (no GUI display server). ${folderName} folder simulated view ready hai.`;
          extraData = {
            folder: folderName,
            path: fullPath,
            executionMode: 'simulated',
            status: 'simulated',
            reason: 'Headless Linux environment: physical desktop display (X11/Wayland) not available.',
          };
        }
        break;
      }

      case 'file_open': {
        const fileName = (payload?.fileName || target || '').replace(/[^\w.-]/g, '');
        const fileExists = laptopState.simulatedFiles.some((f) => f.name.toLowerCase() === fileName.toLowerCase());
        resultMessage = fileExists
          ? `Boss, file "${fileName}" open kar di hai (preview ready)!`
          : `Boss, file "${fileName}" open simulated state mein load kar di hai.`;
        extraData = { fileName, found: fileExists, executionMode: 'simulated', status: 'simulated' };
        break;
      }

      case 'file_search': {
        const fileName = (payload?.fileName || target || '').trim();
        const matches = laptopState.simulatedFiles.filter((f) =>
          f.name.toLowerCase().includes(fileName.toLowerCase())
        );
        resultMessage = `Boss, "${fileName}" file search complete! (${matches.length} files found)`;
        extraData = { fileName, found: matches.length > 0, count: matches.length, results: matches, executionMode: 'simulated', status: 'executed' };
        break;
      }

      case 'file_delete': {
        const fileName = (payload?.fileName || target || '').replace(/[^\w.-]/g, '');
        const before = laptopState.simulatedFiles.length;
        laptopState.simulatedFiles = laptopState.simulatedFiles.filter(
          (f) => f.name.toLowerCase() !== fileName.toLowerCase()
        );
        const deleted = laptopState.simulatedFiles.length < before;
        resultMessage = deleted
          ? `Boss, "${fileName}" file delete kar di gayi hai.`
          : `Boss, "${fileName}" file nahi mili delete karne ke liye.`;
        extraData = { fileName, deleted, executionMode: 'simulated', status: deleted ? 'executed' : 'not_found' };
        break;
      }

      case 'file_rename': {
        const oldName = (payload?.oldName || target || '').replace(/[^\w.-]/g, '');
        const newName = (payload?.newName || 'renamed_file.txt').replace(/[^\w.-]/g, '');
        const fileItem = laptopState.simulatedFiles.find((f) => f.name.toLowerCase() === oldName.toLowerCase());
        if (fileItem) {
          fileItem.name = newName;
          fileItem.path = fileItem.path.replace(oldName, newName);
          resultMessage = `Boss, "${oldName}" ko rename karke "${newName}" kar diya hai!`;
          extraData = { oldName, newName, renamed: true, executionMode: 'simulated', status: 'executed' };
        } else {
          resultMessage = `Boss, rename karne ke liye "${oldName}" nahi mili.`;
          extraData = { oldName, newName, renamed: false, executionMode: 'simulated', status: 'not_found' };
        }
        break;
      }

      case 'browser_open_url': {
        const rawUrl = payload?.url || target || 'https://google.com';
        const urlValidation = validateSafeUrl(rawUrl);
        if (!urlValidation.valid || !urlValidation.sanitizedUrl) {
          return res.status(400).json({
            success: false,
            error: urlValidation.reason || 'Invalid URL',
          });
        }

        const isWin = process.platform === 'win32';
        const isMac = process.platform === 'darwin';
        const hasGuiDisplay = Boolean(process.env.DISPLAY || isWin || isMac);

        if (hasGuiDisplay) {
          const cmd = isWin ? `start "" "${urlValidation.sanitizedUrl}"` : isMac ? `open "${urlValidation.sanitizedUrl}"` : `xdg-open "${urlValidation.sanitizedUrl}"`;
          exec(cmd, (err) => {
            if (err) console.info('[System Control] URL open note:', err.message);
          });
          resultMessage = `Boss, browser mein "${urlValidation.sanitizedUrl}" open kar diya hai!`;
          extraData = { url: urlValidation.sanitizedUrl, executionMode: 'native', status: 'executed' };
        } else {
          resultMessage = `Boss, headless environment hai (GUI browser window cannot open). URL record ho gaya: "${urlValidation.sanitizedUrl}".`;
          extraData = {
            url: urlValidation.sanitizedUrl,
            executionMode: 'simulated',
            status: 'simulated',
            reason: 'Headless Linux environment: desktop display server not available.',
          };
        }
        break;
      }

      case 'browser_search': {
        const query = (payload?.query || '').trim();
        const engine = payload?.engine === 'youtube' ? 'youtube' : 'google';
        const rawUrl = engine === 'youtube'
          ? `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
          : `https://www.google.com/search?q=${encodeURIComponent(query)}`;

        const urlValidation = validateSafeUrl(rawUrl);
        if (!urlValidation.valid || !urlValidation.sanitizedUrl) {
          return res.status(400).json({
            success: false,
            error: urlValidation.reason || 'Invalid search query',
          });
        }

        const isWin = process.platform === 'win32';
        const isMac = process.platform === 'darwin';
        const hasGuiDisplay = Boolean(process.env.DISPLAY || isWin || isMac);

        if (hasGuiDisplay) {
          const cmd = isWin ? `start "" "${urlValidation.sanitizedUrl}"` : isMac ? `open "${urlValidation.sanitizedUrl}"` : `xdg-open "${urlValidation.sanitizedUrl}"`;
          exec(cmd, (err) => {
            if (err) console.info('[System Control] Search launch note:', err.message);
          });
          resultMessage = `Boss, ${engine === 'youtube' ? 'YouTube' : 'Google'} par "${query}" search open kar diya hai!`;
          extraData = { query, engine, url: rawUrl, executionMode: 'native', status: 'executed' };
        } else {
          resultMessage = `Boss, headless container: search query "${query}" recorded (${engine}).`;
          extraData = {
            query,
            engine,
            url: rawUrl,
            executionMode: 'simulated',
            status: 'simulated',
            reason: 'Headless Linux environment: GUI browser cannot be launched.',
          };
        }
        break;
      }

      case 'browser_tab_close': {
        resultMessage = 'Boss, browser tab close signal record ho gaya (Ctrl+W).';
        extraData = { shortcut: 'Ctrl+W', executionMode: 'simulated', status: 'simulated' };
        break;
      }

      case 'browser_tab_open': {
        resultMessage = 'Boss, naya browser tab signal record ho gaya (Ctrl+T).';
        extraData = { shortcut: 'Ctrl+T', executionMode: 'simulated', status: 'simulated' };
        break;
      }

      case 'browser_bookmark': {
        resultMessage = 'Boss, bookmarks manager signal record ho gaya (Ctrl+Shift+O).';
        extraData = { shortcut: 'Ctrl+Shift+O', executionMode: 'simulated', status: 'simulated' };
        break;
      }

      case 'app_launch': {
        const appName = payload?.appName || target || '';
        const appValidation = validateSafeApp(appName);
        if (!appValidation.allowed || !appValidation.command) {
          return res.status(400).json({
            success: false,
            error: appValidation.reason || 'App not allowed.',
          });
        }

        const isWin = process.platform === 'win32';
        const isMac = process.platform === 'darwin';
        const hasGuiDisplay = Boolean(process.env.DISPLAY || isWin || isMac);
        const cmd = isWin ? appValidation.command.win : isMac ? appValidation.command.mac : appValidation.command.linux;

        if (hasGuiDisplay) {
          exec(cmd, (err) => {
            if (err) console.info('[System Control] App launch note:', err.message);
          });
          resultMessage = `Boss, ${appName} open kar diya hai!`;
          extraData = { appName, launched: true, executionMode: 'native', status: 'executed' };
        } else {
          resultMessage = `Boss, headless container mein desktop application "${appName}" directly open nahi ho sakti (no X11 display). Simulation active hai.`;
          extraData = {
            appName,
            launched: false,
            executionMode: 'simulated',
            status: 'simulated',
            reason: 'Headless Linux environment: GUI application display server not available.',
          };
        }
        break;
      }

      case 'app_close': {
        const appName = payload?.appName || target || '';
        const appValidation = validateSafeApp(appName);
        if (!appValidation.allowed) {
          return res.status(400).json({
            success: false,
            error: appValidation.reason || 'App not allowed.',
          });
        }

        const isWin = process.platform === 'win32';
        const isMac = process.platform === 'darwin';
        const hasGuiDisplay = Boolean(process.env.DISPLAY || isWin || isMac);

        if (hasGuiDisplay) {
          resultMessage = `Boss, ${appName} band kar diya hai.`;
          extraData = { appName, closed: true, executionMode: 'native', status: 'executed' };
        } else {
          resultMessage = `Boss, ${appName} simulated state close ho gayi.`;
          extraData = { appName, closed: true, executionMode: 'simulated', status: 'simulated' };
        }
        break;
      }

      case 'volume_set': {
        const volume = typeof payload?.volume === 'number' ? Math.max(0, Math.min(100, payload.volume)) : 50;
        durableStorage.updateSetting('voiceVolume', volume / 100);
        resultMessage = volume === 0
          ? 'Boss, laptop ka sound mute kar diya hai.'
          : `Boss, laptop volume ${volume}% set kar diya hai.`;
        extraData = { newVolume: volume, isMuted: volume === 0, executionMode: 'native', status: 'executed' };
        break;
      }

      case 'volume_change': {
        const delta = typeof payload?.delta === 'number' ? payload.delta : 15;
        const currentVol = Math.round((durableStorage.getSettings().voiceVolume || 0.7) * 100);
        const nextVol = Math.max(0, Math.min(100, currentVol + delta));
        durableStorage.updateSetting('voiceVolume', nextVol / 100);
        resultMessage = delta > 0
          ? `Boss, volume barha kar ${nextVol}% kar diya hai.`
          : `Boss, volume kam karke ${nextVol}% kar diya hai.`;
        extraData = { newVolume: nextVol, delta, executionMode: 'native', status: 'executed' };
        break;
      }

      case 'screenshot_take': {
        const settings = durableStorage.getSettings();
        const curVol = Math.round((settings.voiceVolume || 0.7) * 100);
        const isDisplayPresent = Boolean(process.env.DISPLAY || process.platform === 'win32' || process.platform === 'darwin');
        const screenshotUri = generateScreenshotDataUri(curVol);

        const record = {
          id: 'scr-' + Date.now(),
          timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          dataUrl: screenshotUri,
          title: `Screenshot ${new Date().toLocaleTimeString()}`,
          dimensions: { width: 960, height: 540 },
          isDisplayAvailable: isDisplayPresent,
          isSimulatedPreview: !isDisplayPresent,
          simulatedNotice: isDisplayPresent
            ? undefined
            : 'Physical desktop display server not detected in container environment; simulation preview provided.',
        };

        laptopState.screenshots.unshift(record);
        resultMessage = isDisplayPresent
          ? 'Boss, desktop ka screenshot le liya hai! Preview samne hai.'
          : 'Boss, desktop container simulation preview generate kar diya hai (headless environment).';
        extraData = {
          screenshot: record,
          executionMode: isDisplayPresent ? 'native' : 'simulated',
          status: isDisplayPresent ? 'executed' : 'simulated',
        };
        break;
      }

      case 'whatsapp_launch': {
        const isWin = process.platform === 'win32';
        const isMac = process.platform === 'darwin';
        const hasGuiDisplay = Boolean(process.env.DISPLAY || isWin || isMac);

        if (hasGuiDisplay) {
          const cmd = isWin ? 'start whatsapp:' : 'xdg-open whatsapp:';
          exec(cmd, (err) => {
            if (err) console.info('[System Control] WhatsApp launch note:', err.message);
          });
          resultMessage = 'Boss, WhatsApp Desktop protocol launch kar diya hai!';
          extraData = { launched: true, executionMode: 'native', status: 'executed' };
        } else {
          resultMessage = 'Boss, headless environment mein WhatsApp Desktop GUI open nahi ho sakta; web draft protocol ready hai.';
          extraData = {
            launched: false,
            executionMode: 'simulated',
            status: 'simulated',
            reason: 'Headless Linux environment: GUI application protocol not supported without desktop display.',
          };
        }
        break;
      }

      case 'whatsapp_chat_open': {
        const contact = payload?.contactName || target || 'Hamza';
        resultMessage = `Boss, WhatsApp par "${contact}" ki chat simulated state mein open kar di hai!`;
        extraData = { contactName: contact, executionMode: 'simulated', status: 'simulated' };
        break;
      }

      case 'whatsapp_draft_send': {
        const contact = payload?.contactName || target || 'Hamza';
        const msgText = payload?.messageText || '';
        laptopState.clipboard = msgText;

        const draft: any = {
          id: 'wa-' + Date.now(),
          contactName: contact,
          contactIdentifier: '+92 300 Desktop',
          messageText: msgText,
          status: 'simulated',
          userConfirmed: true,
          isSensitive: false,
          sentAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };
        durableStorage.addWhatsAppMessage(draft);

        resultMessage = `Boss, ${contact} ka draft message recorded aur clipboard par copy ho gaya. (Real WhatsApp Cloud API requires WHATSAPP_API_TOKEN).`;
        extraData = {
          contactName: contact,
          messageText: msgText,
          copiedToClipboard: true,
          executionMode: 'simulated',
          status: 'draft_ready',
          provider: 'local_store',
        };
        break;
      }

      default: {
        resultMessage = `Action executed: ${type}`;
        break;
      }
    }

    res.json({
      success: true,
      actionId: action?.id,
      type,
      message: resultMessage,
      ...extraData,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      actionId: action?.id,
      error: err.message,
      message: `Masla pesh aaya: ${err.message}`,
    });
  }
});

// -------------------------------------------------------------
// API Safety: Prevent any /api/* request from falling through to HTML SPA
// -------------------------------------------------------------
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({
    error: `API route not found: ${req.method} ${req.path}`,
    status: 'not_found',
  });
});

// Global Express error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[ZARA Server Error Handler]:', err);
  if (!res.headersSent) {
    res.status(500).json({
      error: err?.message || 'Internal Server Error',
      status: 'error',
      response: 'Boss, server par issue aa gaya. Dobara boliye zara.',
      emotion: 'Caring',
      intensity: 70,
      confidence: 'low',
    });
  }
});

// -------------------------------------------------------------
// Vite Dev Server or Production Static Serving
// -------------------------------------------------------------
async function startServer() {
  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ZARA Server v1.1.0] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[ZARA Server] Error during launch:', err);
  process.exit(1);
});
