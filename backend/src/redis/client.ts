import Redis from 'ioredis';
import { env } from '../config/env';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 2,
  retryStrategy: (times) => Math.min(times * 200, 2000),
  lazyConnect: false,
});

redis.on('error', (err) => {
  // Redis is a cache/perf layer here, not the source of truth for seat
  // status, so a Redis outage must never take booking correctness down
  // with it. We only log.
  // eslint-disable-next-line no-console
  console.error('[redis] connection error (continuing in degraded mode):', err.message);
});

/** Best-effort get; never throws, returns null on any failure. */
export async function safeGet(key: string): Promise<string | null> {
  try {
    return await redis.get(key);
  } catch {
    return null;
  }
}

/** Best-effort set with TTL; never throws. */
export async function safeSetEx(key: string, ttlSeconds: number, value: string): Promise<void> {
  try {
    await redis.setex(key, ttlSeconds, value);
  } catch {
    // swallow - cache is optional
  }
}

/** Best-effort delete; never throws. */
export async function safeDel(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch {
    // swallow
  }
}
