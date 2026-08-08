import { pool } from '../db/pool';
import { ApiError } from '../middleware/errorHandler';

export interface Booking {
  id: string;
  booking_ref: string;
  showtime_id: string;
  seat_id: string;
  phone: string;
  amount: string;
  currency: string;
  status: string;
  otp_ref: string | null;
  otp_verified: boolean;
  otp_attempts: number;
  hold_expires_at: string;
  user_id?: string | null;
  created_at: string;
  updated_at: string;
}

export async function getBookingByRef(bookingRef: string): Promise<Booking> {
  const { rows } = await pool.query<Booking>(
    `SELECT * FROM bookings WHERE booking_ref = $1`,
    [bookingRef]
  );
  if (rows.length === 0) {
    throw new ApiError(404, 'BOOKING_NOT_FOUND', 'No booking with that reference');
  }
  return rows[0];
}

/** Throws if the hold backing this booking has already expired. */
export function assertHoldActive(booking: Booking) {
  if (booking.status === 'EXPIRED') {
    throw new ApiError(410, 'HOLD_EXPIRED', 'This seat hold has expired. Please select a seat again.');
  }
  if (new Date(booking.hold_expires_at).getTime() < Date.now() && booking.status === 'HOLD') {
    throw new ApiError(410, 'HOLD_EXPIRED', 'This seat hold has expired. Please select a seat again.');
  }
}

export async function updateBookingStatus(bookingRef: string, status: string): Promise<void> {
  await pool.query(
    `UPDATE bookings SET status = $1, updated_at = now() WHERE booking_ref = $2`,
    [status, bookingRef]
  );
}
