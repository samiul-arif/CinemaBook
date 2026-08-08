import { PoolClient } from 'pg';
import { pool, withTransaction } from '../db/pool';
import { redis, safeDel, safeGet, safeSetEx } from '../redis/client';
import { acquireSeatLock, releaseSeatLock, logLockExpired } from './redisLockService';
import { holdTtlSeconds, env } from '../config/env';
import { ApiError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export interface Seat {
  id: string;
  showtime_id: string;
  seat_row: string;
  seat_col: number;
  seat_label: string;
  seat_type: string;
  price: string;
  status: 'AVAILABLE' | 'HELD' | 'BOOKED';
  hold_expires_at: string | null;
  held_by_booking_ref: string | null;
}

function seatMapCacheKey(showtimeId: string) {
  return `seatmap:${showtimeId}`;
}

/**
 * Returns the full seat map for a showtime. Backed by a short-lived Redis
 * cache to absorb "thousands of users refresh the seat map at once" -
 * Postgres is never hit more than once per SEAT_MAP_CACHE_TTL_SECONDS window
 * per showtime, no matter how many browsers are polling.
 *
 * Redis is best-effort: if it is down we just fall through to Postgres,
 * which is still correct (only slower).
 */
export async function getSeatMap(showtimeId: string): Promise<Seat[]> {
  const cacheKey = seatMapCacheKey(showtimeId);
  const cached = await safeGet(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const { rows } = await pool.query<Seat>(
    `SELECT id, showtime_id, seat_row, seat_col, seat_label, seat_type, price,
            status, hold_expires_at, held_by_booking_ref
     FROM seats WHERE showtime_id = $1
     ORDER BY seat_row, seat_col`,
    [showtimeId]
  );

  await safeSetEx(cacheKey, env.SEAT_MAP_CACHE_TTL_SECONDS, JSON.stringify(rows));
  return rows;
}

export async function invalidateSeatMapCache(showtimeId: string): Promise<void> {
  await safeDel(seatMapCacheKey(showtimeId));
}

/**
 * Attempt to place a hold on one seat for one showtime.
 *
 * Architecture Strategy:
 * 1. Redis First (Fast Concurrency Gate):
 *    Attempts to acquire an atomic Redis lock (`SET seat:lock:{showtimeId}:{seatId} {bookingRef} NX EX {ttl}`).
 *    If lock acquisition fails (seat is locked by another request), immediately returns HTTP 409
 *    WITHOUT reaching PostgreSQL.
 *
 * 2. PostgreSQL Final Authority (Source of Truth):
 *    If Redis lock is acquired (or if Redis is offline/degraded), executes a single atomic UPDATE
 *    WHERE status = 'AVAILABLE' (or expired HELD). If PostgreSQL hold creation fails for any reason
 *    (e.g., seat already held/booked in DB), the Redis lock is immediately released.
 */
export async function holdSeat(params: {
  showtimeId: string;
  seatId: string;
  phone: string;
  bookingRef: string;
  userId?: string;
}): Promise<{ seat: Seat; holdExpiresAt: Date }> {
  const { showtimeId, seatId, phone, bookingRef, userId } = params;
  const ttl = holdTtlSeconds();

  // 1. Acquire Redis lock as fast concurrency gate
  const lockAcquired = await acquireSeatLock(showtimeId, seatId, bookingRef, ttl);
  if (!lockAcquired) {
    throw new ApiError(409, 'SEAT_UNAVAILABLE', 'Seat is currently being reserved by another user');
  }

  let result: { seat: Seat; booking: any; holdExpiresAt: Date };

  try {
    // 2. PostgreSQL transaction for final correctness guarantee
    result = await withTransaction(async (client: PoolClient) => {
      const holdExpiresAt = new Date(Date.now() + ttl * 1000);

      const updateResult = await client.query<Seat>(
        `UPDATE seats
         SET status = 'HELD',
             hold_expires_at = $1,
             held_by_booking_ref = $2,
             version = version + 1
         WHERE id = $3
           AND showtime_id = $4
           AND (
                 status = 'AVAILABLE'
              OR (status = 'HELD' AND hold_expires_at < now())
           )
         RETURNING *`,
        [holdExpiresAt.toISOString(), bookingRef, seatId, showtimeId]
      );

      if (updateResult.rowCount === 0) {
        // Either the seat does not exist, or (far more likely under load)
        // someone else's UPDATE already won the race and committed first.
        const existing = await client.query<Seat>(
          `SELECT * FROM seats WHERE id = $1 AND showtime_id = $2`,
          [seatId, showtimeId]
        );
        if (existing.rowCount === 0) {
          throw new ApiError(404, 'SEAT_NOT_FOUND', 'Seat does not exist for this showtime');
        }
        throw new ApiError(409, 'SEAT_UNAVAILABLE', 'Seat is already held or booked');
      }

      const seat = updateResult.rows[0];

      const bookingInsert = await client.query(
        `INSERT INTO bookings (booking_ref, showtime_id, seat_id, phone, user_id, amount, hold_expires_at, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'HOLD')
         RETURNING *`,
        [bookingRef, showtimeId, seatId, phone, userId ?? null, seat.price, holdExpiresAt.toISOString()]
      );

      return { seat, booking: bookingInsert.rows[0], holdExpiresAt };
    });
  } catch (err) {
    // Failure safety: If PostgreSQL hold creation fails after Redis lock succeeded,
    // immediately release the Redis lock before propagating the error.
    await releaseSeatLock(showtimeId, seatId, bookingRef);
    throw err;
  }

  await invalidateSeatMapCache(showtimeId);
  logger.info('seat held', { showtimeId, seatId, bookingRef });

  return { seat: result.seat, holdExpiresAt: result.holdExpiresAt };
}

/** Release a seat back to AVAILABLE. Only releases if still held by this booking ref (idempotent, safe to call multiple times). */
export async function releaseSeatForBooking(
  client: PoolClient,
  seatId: string,
  bookingRef: string,
  showtimeId?: string
): Promise<void> {
  const res = await client.query(
    `UPDATE seats
     SET status = 'AVAILABLE', hold_expires_at = NULL, held_by_booking_ref = NULL, version = version + 1
     WHERE id = $1 AND held_by_booking_ref = $2 AND status = 'HELD'
     RETURNING showtime_id`,
    [seatId, bookingRef]
  );
  const targetShowtimeId = showtimeId ?? res.rows[0]?.showtime_id;
  if (targetShowtimeId) {
    await releaseSeatLock(targetShowtimeId, seatId, bookingRef);
  }
}

/** Confirm a seat as booked (payment succeeded). Only transitions if currently held by this booking. */
export async function markSeatBooked(
  client: PoolClient,
  seatId: string,
  bookingRef: string
): Promise<boolean> {
  const res = await client.query(
    `UPDATE seats
     SET status = 'BOOKED', hold_expires_at = NULL, version = version + 1
     WHERE id = $1 AND held_by_booking_ref = $2 AND status IN ('HELD', 'BOOKED')
     RETURNING id`,
    [seatId, bookingRef]
  );
  return (res.rowCount ?? 0) > 0;
}

/**
 * Sweep every showtime for holds whose TTL has passed and release them.
 * Runs on an interval from a background job; also safe to call directly
 * from a test. Returns the list of (showtime_id, booking_ref) pairs that
 * were released, so callers can expire the matching bookings and bust
 * caches.
 */
export async function releaseExpiredHolds(): Promise<
  { seatId: string; showtimeId: string; bookingRef: string }[]
> {
  // RETURNING reflects the row *after* the UPDATE, so held_by_booking_ref
  // would come back NULL if we cleared it in the same statement. A CTE
  // captures the pre-update rows first, then the outer UPDATE clears them.
  const { rows } = await pool.query(
    `WITH expired AS (
       SELECT id, showtime_id, held_by_booking_ref
       FROM seats
       WHERE status = 'HELD' AND hold_expires_at < now()
       FOR UPDATE
     )
     UPDATE seats s
     SET status = 'AVAILABLE', hold_expires_at = NULL, held_by_booking_ref = NULL, version = version + 1
     FROM expired e
     WHERE s.id = e.id
     RETURNING s.id AS "seatId", e.showtime_id AS "showtimeId", e.held_by_booking_ref AS "bookingRef"`
  );

  for (const r of rows) {
    if (r.bookingRef) {
      await releaseSeatLock(r.showtimeId, r.seatId, r.bookingRef);
      logLockExpired(r.showtimeId, r.seatId, r.bookingRef);
    }
  }

  return rows;
}
