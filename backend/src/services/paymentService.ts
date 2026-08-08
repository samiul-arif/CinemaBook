import { PoolClient } from 'pg';
import { pool, withTransaction } from '../db/pool';
import { env } from '../config/env';
import { chargeViaGateway, MockForce, MockMode } from '../gateway/gatewayClient';
import { getBookingByRef, assertHoldActive } from './bookingService';
import { markSeatBooked, releaseSeatForBooking, invalidateSeatMapCache } from './seatService';
import { ApiError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

/**
 * Kick off payment for a booking.
 *
 * Design point (see problem statement): "/pay cannot wait for the
 * gateway." The gateway's /charge endpoint itself is fast by spec (only the
 * callback is delayed 2-15s), so we do await the POST - but with a hard
 * timeout, and we NEVER wait for the callback. If /charge itself times out
 * or 500s (2% of the time), we mark the attempt recoverable and let the
 * client retry /pay; we do not fail the booking outright, since the
 * gateway may have actually accepted the charge.
 */
export async function initiatePayment(
  bookingRef: string,
  opts?: { mode?: MockMode; force?: MockForce }
): Promise<{ paymentId: string; status: string }> {
  const booking = await getBookingByRef(bookingRef);
  assertHoldActive(booking);

  if (booking.status !== 'OTP_VERIFIED' && booking.status !== 'PAYMENT_PENDING') {
    throw new ApiError(409, 'INVALID_STATE', `Cannot initiate payment from status ${booking.status}`);
  }

  // One active (INITIATING/PENDING) payment attempt per booking, enforced by
  // a partial unique index - guards against a double-click on "Pay" firing
  // two charges.
  const existingActive = await pool.query(
    `SELECT * FROM payments WHERE booking_id = $1 AND status IN ('INITIATING', 'PENDING')`,
    [booking.id]
  );
  if (existingActive.rowCount && existingActive.rowCount > 0) {
    const p = existingActive.rows[0];
    return { paymentId: p.payment_id ?? 'pending', status: p.status };
  }

  await pool.query(
    `INSERT INTO payments (booking_id, amount, currency, status) VALUES ($1, $2, $3, 'INITIATING')`,
    [booking.id, booking.amount, booking.currency]
  );
  await pool.query(
    `UPDATE bookings SET status = 'PAYMENT_PENDING', updated_at = now() WHERE booking_ref = $1`,
    [bookingRef]
  );

  const callbackUrl = `${env.PUBLIC_BASE_URL}/api/payments/callback`;

  try {
    const chargeRes = await chargeViaGateway(
      {
        amount: Number(booking.amount),
        currency: booking.currency,
        booking_ref: bookingRef,
        callback_url: callbackUrl,
      },
      opts
    );

    // Clear the placeholder INITIATING row first - the partial unique index
    // (one active payment per booking) would otherwise reject the insert
    // below while the placeholder still exists.
    await pool.query(
      `DELETE FROM payments WHERE booking_id = $1 AND status = 'INITIATING'`,
      [booking.id]
    );

    // The callback may already have arrived and inserted this payment_id
    // (X-Mock-Force: race). ON CONFLICT DO NOTHING makes this idempotent
    // either way - whichever of {charge response, callback} arrives first
    // creates the row, the other is a no-op.
    await pool.query(
      `INSERT INTO payments (payment_id, booking_id, amount, currency, status)
       VALUES ($1, $2, $3, $4, 'PENDING')
       ON CONFLICT (payment_id) DO NOTHING`,
      [chargeRes.payment_id, booking.id, booking.amount, booking.currency]
    );

    logger.info('payment initiated', { bookingRef, paymentId: chargeRes.payment_id });
    return { paymentId: chargeRes.payment_id, status: chargeRes.status };
  } catch (err: any) {
    logger.warn('charge request failed (timeout/5xx) - leaving booking retryable', {
      bookingRef,
      message: err?.message,
    });
    // Do not touch seat/booking state - the gateway may still process this
    // charge and call back later, or the user can retry /pay.
    throw new ApiError(
      502,
      'CHARGE_UNAVAILABLE',
      'Could not reach payment gateway. You can safely retry payment.'
    );
  }
}

export interface GatewayCallbackPayload {
  event_id: string;
  payment_id: string;
  booking_ref: string;
  status: 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
  amount: number;
}

/**
 * Process a gateway callback. MUST be idempotent and MUST always let the
 * caller respond 200 (the route layer handles that; this function simply
 * makes side effects run at most once per event_id/payment terminal state).
 *
 * Idempotency has two layers:
 *  1. payment_events.event_id is a primary key - a byte-for-byte duplicate
 *     callback (same event_id) hits a conflict and we return immediately
 *     with the already-known outcome, no business logic re-runs.
 *  2. payments.status only transitions out of {INITIATING, PENDING} once,
 *     guarded by the WHERE clause in the terminal UPDATE below - even a
 *     callback with a *different* event_id but the same payment_id (a
 *     real-world gateway retry with a fresh envelope) cannot double-apply
 *     the effect.
 */
export async function processGatewayCallback(
  payload: GatewayCallbackPayload
): Promise<{ duplicate: boolean }> {
  return withTransaction(async (client: PoolClient) => {
    const eventInsert = await client.query(
      `INSERT INTO payment_events (event_id, payment_id, booking_ref, status, amount, raw_payload)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (event_id) DO NOTHING
       RETURNING event_id`,
      [
        payload.event_id,
        payload.payment_id,
        payload.booking_ref,
        payload.status,
        payload.amount,
        JSON.stringify(payload),
      ]
    );

    if (eventInsert.rowCount === 0) {
      logger.info('duplicate callback ignored', { eventId: payload.event_id });
      return { duplicate: true };
    }

    // Find (or upsert) the payment row. It may not exist yet if the
    // callback raced ahead of our own /charge response (X-Mock-Force: race).
    const bookingRes = await client.query(
      `SELECT * FROM bookings WHERE booking_ref = $1 FOR UPDATE`,
      [payload.booking_ref]
    );
    if (bookingRes.rowCount === 0) {
      logger.warn('callback for unknown booking_ref', { bookingRef: payload.booking_ref });
      return { duplicate: false };
    }
    const booking = bookingRes.rows[0];

    const upsert = await client.query(
      `INSERT INTO payments (payment_id, booking_id, amount, currency, status)
       VALUES ($1, $2, $3, 'BDT', $4)
       ON CONFLICT (payment_id) DO UPDATE
         SET status = EXCLUDED.status, updated_at = now()
         WHERE payments.status IN ('INITIATING', 'PENDING')
       RETURNING *`,
      [payload.payment_id, booking.id, payload.amount, payload.status]
    );

    if (upsert.rowCount === 0) {
      // Payment already reached a terminal state previously - this callback
      // (different event_id, same payment_id) is a no-op retry.
      logger.info('callback for already-settled payment ignored', {
        paymentId: payload.payment_id,
      });
      return { duplicate: true };
    }

    // Clean up any leftover INITIATING placeholder for this booking.
    await client.query(
      `DELETE FROM payments WHERE booking_id = $1 AND status = 'INITIATING' AND payment_id IS NULL`,
      [booking.id]
    );

    if (payload.status === 'SUCCEEDED') {
      const confirmed = await markSeatBooked(client, booking.seat_id, booking.booking_ref);
      if (!confirmed) {
        // Hold had already expired before payment succeeded - refund path.
        logger.error('payment succeeded but hold had expired; needs refund', {
          bookingRef: booking.booking_ref,
          paymentId: payload.payment_id,
        });
        await client.query(
          `UPDATE bookings SET status = 'FAILED', updated_at = now() WHERE id = $1`,
          [booking.id]
        );
      } else {
        await client.query(
          `UPDATE bookings SET status = 'CONFIRMED', updated_at = now() WHERE id = $1`,
          [booking.id]
        );
      }
    } else if (payload.status === 'FAILED') {
      await releaseSeatForBooking(client, booking.seat_id, booking.booking_ref);
      await client.query(
        `UPDATE bookings SET status = 'FAILED', updated_at = now() WHERE id = $1`,
        [booking.id]
      );
    } else if (payload.status === 'REFUNDED') {
      await releaseSeatForBooking(client, booking.seat_id, booking.booking_ref);
      await client.query(
        `UPDATE bookings SET status = 'REFUNDED', updated_at = now() WHERE id = $1`,
        [booking.id]
      );
    }

    await invalidateSeatMapCache(booking.showtime_id);
    return { duplicate: false };
  });
}
