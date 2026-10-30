import type { Env } from './env';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS,
  });
}

function getAllowedOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get('Origin');
  const configured = (env as Env & { ALLOWED_ORIGIN?: string }).ALLOWED_ORIGIN;

  if (!origin || !configured) return null;
  return origin === configured ? origin : null;
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
        const origin = getAllowedOrigin(request, env);
        if (!origin) return new Response(null, { status: 403 });

        return new Response(null, {
          status: 204,
          headers: {
            'access-control-allow-origin': origin,
            'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
            'access-control-allow-headers': 'Content-Type,Authorization,X-ZARA-AUTH',
            'access-control-max-age': '86400',
            vary: 'Origin',
          },
        });
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
