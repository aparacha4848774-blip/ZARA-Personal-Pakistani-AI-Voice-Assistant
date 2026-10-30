import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './index.ts';
import type { Env } from './env';

function createEnv(overrides: Partial<Env> = {}): Env {
  return {
    ASSETS: {
      fetch: async () => new Response('static asset', { status: 200 }),
    },
    AI: {
      run: async () => ({ response: 'test' }),
    },
    ALLOWED_ORIGIN: 'https://zara.example',
    ...overrides,
  };
}

test('health endpoint returns truthful Worker scaffold capabilities', async () => {
  const response = await worker.fetch(
    new Request('https://zara.example/api/health'),
    createEnv(),
  );
  const body = await response.json() as {
    status: string;
    service: string;
    capabilities: Record<string, unknown>;
  };

  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(body.service, 'zara-worker');
  assert.equal(body.capabilities.chat, 'not_migrated');
  assert.equal(body.capabilities.persistence, 'not_migrated');
  assert.equal(body.capabilities.desktopControl, 'electron_local_runtime');
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('API unknown routes return JSON 404 and do not fall through to SPA assets', async () => {
  const response = await worker.fetch(
    new Request('https://zara.example/api/missing'),
    createEnv(),
  );

  assert.equal(response.status, 404);
  assert.match(response.headers.get('content-type') || '', /application\/json/);
  assert.deepEqual(await response.json(), { error: 'API route not found.' });
});

test('configured origin receives CORS headers on API responses', async () => {
  const response = await worker.fetch(
    new Request('https://zara.example/api/health', {
      headers: { Origin: 'https://zara.example' },
    }),
    createEnv(),
  );

  assert.equal(response.headers.get('access-control-allow-origin'), 'https://zara.example');
  assert.equal(response.headers.get('vary'), 'Origin');
});

test('unconfigured or untrusted origin is not reflected in CORS responses', async () => {
  const response = await worker.fetch(
    new Request('https://zara.example/api/health', {
      headers: { Origin: 'https://attacker.example' },
    }),
    createEnv(),
  );

  assert.equal(response.headers.get('access-control-allow-origin'), null);
});

test('valid CORS preflight is accepted only for configured origin and allowed headers', async () => {
  const response = await worker.fetch(
    new Request('https://zara.example/api/chat', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://zara.example',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type, authorization',
      },
    }),
    createEnv(),
  );

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://zara.example');
});

test('CORS preflight rejects unknown origins, methods, and headers', async () => {
  const env = createEnv();
  const cases = [
    new Request('https://zara.example/api/chat', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://attacker.example',
        'Access-Control-Request-Method': 'POST',
      },
    }),
    new Request('https://zara.example/api/chat', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://zara.example',
        'Access-Control-Request-Method': 'TRACE',
      },
    }),
    new Request('https://zara.example/api/chat', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://zara.example',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'x-evil-header',
      },
    }),
  ];

  for (const request of cases) {
    const response = await worker.fetch(request, env);
    assert.equal(response.status, 403);
  }
});

test('non-API paths are delegated to Cloudflare Static Assets', async () => {
  const response = await worker.fetch(
    new Request('https://zara.example/settings/profile'),
    createEnv(),
  );

  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'static asset');
});
