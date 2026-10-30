import type { Env } from './env';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
const ALLOWED_HEADERS = new Set(['content-type', 'authorization', 'x-zara-auth']);

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS,
  });
}

function getAllowedOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get('Origin');
  const configured = env.ALLOWED_ORIGIN?.trim();

  if (!origin || !configured) return null;
  return origin === configured ? origin : null;
}

function handlePreflight(request: Request, env: Env): Response {
  const origin = getAllowedOrigin(request, env);
  const requestedMethod = request.headers.get('Access-Control-Request-Method')?.toUpperCase();
  const requestedHeaders = (request.headers.get('Access-Control-Request-Headers') || '')
    .split(',')
    .map((header) => header.trim().toLowerCase())
    .filter(Boolean);

  if (
    !origin ||
    !requestedMethod ||
    !ALLOWED_METHODS.has(requestedMethod) ||
    requestedHeaders.some((header) => !ALLOWED_HEADERS.has(header))
  ) {
    return new Response(null, { status: 403, headers: { vary: 'Origin' } });
  }

  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': [...ALLOWED_METHODS].join(','),
      'access-control-allow-headers': [...ALLOWED_HEADERS].join(','),
      'access-control-max-age': '86400',
      vary: 'Origin',
    },
  });
}

async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === 'GET' && url.pathname === '/api/health') {
    return json({
      status: 'ok',
      service: 'zara-worker',
      runtime: 'cloudflare-workers',
      timestamp: new Date().toISOString(),
      capabilities: {
        staticAssets: true,
        workersAI: Boolean(env.AI),
        chat: 'not_migrated',
        persistence: 'not_migrated',
        voice: 'browser_features_preserved',
        desktopControl: 'electron_local_runtime',
      },
    });
  }

  return json({ error: 'API route not found.' }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      if (request.method === 'OPTIONS') {
        return handlePreflight(request, env);
      }

      const response = await handleApi(request, env);
      const origin = getAllowedOrigin(request, env);
      if (!origin) return response;

      const headers = new Headers(response.headers);
      headers.set('access-control-allow-origin', origin);
      headers.set('vary', 'Origin');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    return env.ASSETS.fetch(request);
  },
};
