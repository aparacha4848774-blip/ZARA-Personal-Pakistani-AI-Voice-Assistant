/**
 * Centralized authenticated API Client for ZARA.
 * Handles authentication headers, tokens, and error handling.
 */

export function getStoredAuthToken(): string | null {
  if (typeof window === 'undefined') return null;

  // 1. Check URL query parameters for token handoff (?token=... or ?auth_token=...)
  try {
    const params = new URLSearchParams(window.location.search);
    const queryToken = params.get('token') || params.get('auth_token') || params.get('zara_token');
    if (queryToken && queryToken.trim()) {
      localStorage.setItem('zara_auth_token', queryToken.trim());
      // Clean up URL without reload
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);
      return queryToken.trim();
    }
  } catch {
    // Ignore URL errors
  }

  // 2. Check localStorage
  try {
    const stored = localStorage.getItem('zara_auth_token');
    if (stored && stored.trim()) {
      return stored.trim();
    }
  } catch {
    // Ignore localStorage errors
  }

  // 3. Check Vite build-time environment variable
  const envToken = (import.meta as any).env?.VITE_ZARA_AUTH_TOKEN;
  if (typeof envToken === 'string' && envToken.trim()) {
    return envToken.trim();
  }

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
    // Ignore storage errors
  }
}

/**
 * Authenticated fetch wrapper.
 * Automatically attaches Authorization and X-ZARA-AUTH headers
 * and ensures same-origin credentials are sent.
 */
export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
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

  return fetch(input, {
    ...init,
    headers,
  });
}
