import type { D1Database } from './d1.types';

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export async function checkRateLimit(
  db: D1Database,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / windowSeconds) * windowSeconds;
  const id = `${key}:${bucket}`;
  await db.prepare(
    'INSERT INTO rate_limits (bucket_key, window_start, request_count, expires_at) VALUES (?, ?, 1, ?) ON CONFLICT(bucket_key) DO UPDATE SET request_count = request_count + 1'
  ).bind(id, bucket, bucket + windowSeconds * 2).run();
  const row = await db.prepare('SELECT request_count FROM rate_limits WHERE bucket_key = ?')
    .bind(id).first<{ request_count: number }>();
  return {
    allowed: (row?.request_count ?? limit + 1) <= limit,
    retryAfterSeconds: Math.max(1, bucket + windowSeconds - now),
  };
}

export async function cleanupRateLimits(db: D1Database): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(now).run();
}

export async function createMemoryBackup(db: D1Database): Promise<number> {
  const result = await db.prepare('SELECT * FROM memories ORDER BY created_at').all<Record<string, unknown>>();
  const rows = result.results ?? [];
  await db.prepare('INSERT INTO memory_backups (id, created_at, memory_count, payload_json) VALUES (?, ?, ?, ?)')
    .bind(crypto.randomUUID(), new Date().toISOString(), rows.length, JSON.stringify(rows)).run();
  return rows.length;
}
