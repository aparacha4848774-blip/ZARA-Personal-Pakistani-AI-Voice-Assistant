/**
 * Centralized authenticated API Client for ZARA.
 * Handles authentication headers, tokens, and error handling.
 *
 * Security note: authentication tokens must not be accepted from URL
 * parameters or Vite build-time environment variables. VITE_* values are
 * included in client-side bundles and are not secrets.
 */

export function getStoredAuthToken(): string | null {
  if (typeof window === 'undefined') return null;

  // Remove legacy token parameters from the address bar without using them.
  // This reduces accidental exposure if an old token-handoff URL is opened.
  try {
    const url = new URL(window.location.href);
    let changed = false;

    for (const key of ['token', 'auth_token', 'zara_token']) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }

    if (changed) {
      const cleanUrl = url.pathname + url.search + url.hash;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  } catch {
    // Ignore URL cleanup errors; never use URL tokens for authentication.
  }

  // Backward-compatible token lookup for existing sign-in flows.
  // Prefer a server-managed HttpOnly, Secure, SameSite cookie in a future
  // migration so JavaScript cannot read the session token.
  try {
    const stored = localStorage.getItem('zara_auth_token');
    if (stored && stored.trim()) {
      return stored.trim();
    }
  } catch {
    // Ignore storage errors.
  }

  // Do not read VITE_ZARA_AUTH_TOKEN here: Vite exposes VITE_* values
  // to browser code, so they must never contain authentication secrets.
  return null;
}

export function setStoredAuthToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (token && token.trim()) {
      localStorage.setItem('zara_auth_token', token.trim());
    } else {
      localStorage.removeItem('zara_auth_token');
    }
  } catch {
    // Ignore storage errors.
  }
}

/**
 * Authenticated fetch wrapper.
 * Automatically attaches Authorization and X-ZARA-AUTH headers.
 * Keep parsed JSON as any for compatibility with TypeScript 7's unknown Response.json() result.
 */
export type ApiResponse = Omit<Response, 'json'> & { json(): Promise<any> };

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<ApiResponse> {
  const token = getStoredAuthToken();
  const headers = new Headers(init.headers || {});

  if (token) {
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    if (!headers.has('X-ZARA-AUTH')) {
      headers.set('X-ZARA-AUTH', token);
    }
  }

  return (await fetch(input, {
    ...init,
    headers,
    credentials: init.credentials || 'same-origin',
  })) as ApiResponse;
}
