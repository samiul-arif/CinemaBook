import { redis } from '../redis/client';
import { holdTtlSeconds } from '../config/env';
import { logger } from '../utils/logger';

export function seatLockKey(showtimeId: string, seatId: string): string {
  return `seat:lock:${showtimeId}:${seatId}`;
}

/**
 * Acquire a distributed seat lock in Redis using SET key value NX EX ttlSeconds.
 *
 * Requirements:
 * - Key: seat:lock:{showtimeId}:{seatId}
 * - Value: bookingRef
 * - Fast concurrency gate to shed traffic before hitting PostgreSQL
 * - If lock acquisition fails (key exists): returns false, logs LOCK_REJECTED
 * - If lock acquired: returns true, logs LOCK_ACQUIRED
 * - Graceful degradation: If Redis is unavailable or errors out, returns true so
 *   PostgreSQL remains the final authority and handles the request.
 */
export async function acquireSeatLock(
  showtimeId: string,
  seatId: string,
  bookingRef: string,
  ttlSeconds?: number
): Promise<boolean> {
  const key = seatLockKey(showtimeId, seatId);
  const ttl = ttlSeconds ?? holdTtlSeconds();

  try {
    if (redis.status !== 'ready') {
      logger.warn('redis unavailable for seat lock (falling back to postgres)', {
        showtimeId,
        seatId,
        bookingRef,
      });
      return true;
    }

    const res = await redis.set(key, bookingRef, 'EX', ttl, 'NX');
    if (res === 'OK') {
      logger.info('LOCK_ACQUIRED', { showtimeId, seatId, bookingRef, ttl });
      return true;
    }

    logger.warn('LOCK_REJECTED', { showtimeId, seatId, bookingRef });
    return false;
  } catch (err: any) {
    logger.warn('redis lock acquire error (falling back to postgres)', {
      showtimeId,
      seatId,
      bookingRef,
      error: err?.message,
    });
    // Graceful fallback to PostgreSQL
    return true;
  }
}

/**
 * Safely release a seat lock in Redis.
 * Uses a Lua script to ensure we only delete the lock if its value matches the target bookingRef
 * (or deletes unconditionally if no bookingRef is passed).
 */
export async function releaseSeatLock(
  showtimeId: string,
  seatId: string,
  bookingRef?: string
): Promise<boolean> {
  const key = seatLockKey(showtimeId, seatId);

  try {
    if (redis.status !== 'ready') {
      return false;
    }

    if (bookingRef) {
      const luaScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      const res = await redis.eval(luaScript, 1, key, bookingRef);
      if (res === 1) {
        logger.info('LOCK_RELEASED', { showtimeId, seatId, bookingRef });
        return true;
      }
      return false;
    } else {
      const res = await redis.del(key);
      if (res > 0) {
        logger.info('LOCK_RELEASED', { showtimeId, seatId });
        return true;
      }
      return false;
    }
  } catch (err: any) {
    logger.warn('redis lock release error', { showtimeId, seatId, error: err?.message });
    return false;
  }
}

/**
 * Check if a seat is currently locked in Redis.
 */
export async function isSeatLocked(showtimeId: string, seatId: string): Promise<boolean> {
  const key = seatLockKey(showtimeId, seatId);
  try {
    if (redis.status !== 'ready') return false;
    const val = await redis.get(key);
    return val !== null;
  } catch {
    return false;
  }
}

/**
 * Log LOCK_EXPIRED when a background sweep or test reclaims an expired hold.
 */
export function logLockExpired(showtimeId: string, seatId: string, bookingRef: string): void {
  logger.info('LOCK_EXPIRED', { showtimeId, seatId, bookingRef });
}
