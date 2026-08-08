import { releaseExpiredHolds, invalidateSeatMapCache } from '../services/seatService';
import { releaseSeatLock, logLockExpired } from '../services/redisLockService';
import { pool } from '../db/pool';
import { env } from '../config/env';
import { logger } from '../utils/logger';

let timer: NodeJS.Timeout | null = null;

async function sweepOnce(): Promise<number> {
  const released = await releaseExpiredHolds();

  if (released.length === 0) return 0;

  const showtimeIds = new Set<string>();
  for (const r of released) {
    showtimeIds.add(r.showtimeId);
    if (r.bookingRef) {
      // Release Redis lock and log LOCK_EXPIRED
      await releaseSeatLock(r.showtimeId, r.seatId, r.bookingRef);
      logLockExpired(r.showtimeId, r.seatId, r.bookingRef);

      // Only expire bookings still sitting in HOLD - a booking that already
      // progressed to CONFIRMED/FAILED/PAYMENT_PENDING must not be touched
      // even if its original hold_expires_at has passed.
      await pool.query(
        `UPDATE bookings SET status = 'EXPIRED', updated_at = now()
         WHERE booking_ref = $1 AND status = 'HOLD'`,
        [r.bookingRef]
      );
    }
  }

  await Promise.all([...showtimeIds].map((id) => invalidateSeatMapCache(id)));

  logger.info('hold expiry sweep released seats', { count: released.length });
  return released.length;
}

export function startHoldExpiryJob(): void {
  if (timer) return;
  const intervalMs = env.HOLD_EXPIRY_SWEEP_INTERVAL_MS;
  timer = setInterval(() => {
    sweepOnce().catch((err) => logger.error('hold expiry sweep failed', { message: err?.message }));
  }, intervalMs);
  logger.info('hold expiry job started', { intervalMs });
}

export function stopHoldExpiryJob(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

// exported for tests
export { sweepOnce };
