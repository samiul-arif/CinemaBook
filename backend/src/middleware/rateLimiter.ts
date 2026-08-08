import { Request, Response, NextFunction } from 'express';
import { redis } from '../redis/client';
import { ApiError } from './errorHandler';
import { logger } from '../utils/logger';

// In-memory fallback if Redis is down
const memoryCache = new Map<string, { count: number; expiresAt: number }>();

export async function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const key = `ratelimit:hold:${ip}`;
  const now = Math.floor(Date.now() / 1000);

  // Apply limit of 5 requests per second
  const limit = 5;
  const windowSeconds = 1;

  try {
    if (redis.status === 'ready') {
      const current = await redis.get(key);
      if (current && parseInt(current, 10) >= limit) {
        logger.warn('rate limit exceeded', { ip, key, requestId: req.requestId });
        return next(new ApiError(429, 'RATE_LIMIT_EXCEEDED', 'Too many hold requests. Limit is 5 requests per second.'));
      }

      await redis.multi()
        .incr(key)
        .expire(key, windowSeconds)
        .exec();
    } else {
      // In-memory fallback
      const cached = memoryCache.get(ip);
      if (cached && cached.expiresAt > Date.now()) {
        if (cached.count >= limit) {
          logger.warn('rate limit exceeded (memory fallback)', { ip, requestId: req.requestId });
          return next(new ApiError(429, 'RATE_LIMIT_EXCEEDED', 'Too many hold requests. Limit is 5 requests per second.'));
        }
        cached.count += 1;
      } else {
        memoryCache.set(ip, {
          count: 1,
          expiresAt: Date.now() + (windowSeconds * 1000)
        });
      }
    }
  } catch (err) {
    // Graceful degradation: log errors but allow request to continue if rate limiting engine breaks
    logger.warn('rate limiter warning (bypassed)', { error: (err as Error).message });
  }

  next();
}
