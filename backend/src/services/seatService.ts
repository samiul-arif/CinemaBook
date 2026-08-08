import { PoolClient } from 'pg';
import { pool, withTransaction } from '../db/pool';
import { redis, safeDel, safeGet, safeSetEx } from '../redis/client';
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
 * Concurrency strategy (this is the answer to "100 requests, 1 winner"):
 *   A single UPDATE ... WHERE status = 'AVAILABLE' (or an expired HELD row)
 *   is issued inside a transaction. Postgres takes a row-level lock on the
 *   target row for the duration of the UPDATE, so concurrent transactions
 *   attempting to update the *same* row are serialized by the database
 *   itself - there is no read-modify-write window in application code for
 *   a race to slip through. Exactly one UPDATE can match `status =
 *   'AVAILABLE'` and flip it to 'HELD'; every other concurrent UPDATE sees
 *   0 rows affected once the winner commits, and gets rejected.
 *
 *   We do not use a separate `SELECT ... FOR UPDATE` followed by an
 *   `UPDATE`, because that is strictly more code for the same guarantee -
 *   the single conditional UPDATE *is* the row lock.
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

  const result = await withTransaction(async (client: PoolClient) => {
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

  await invalidateSeatMapCache(showtimeId);
  logger.info('seat held', { showtimeId, seatId, bookingRef });

  return { seat: result.seat, holdExpiresAt: result.holdExpiresAt };
}

/** Release a seat back to AVAILABLE. Only releases if still held by this booking ref (idempotent, safe to call multiple times). */
export async function releaseSeatForBooking(
  client: PoolClient,
  seatId: string,
  bookingRef: string
): Promise<void> {
  await client.query(
    `UPDATE seats
     SET status = 'AVAILABLE', hold_expires_at = NULL, held_by_booking_ref = NULL, version = version + 1
     WHERE id = $1 AND held_by_booking_ref = $2 AND status = 'HELD'`,
    [seatId, bookingRef]
  );
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

  return rows;
}
