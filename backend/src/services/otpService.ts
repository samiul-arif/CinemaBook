import { pool } from '../db/pool';
import { newOtpRef } from '../utils/ids';
import { sendOtpViaGateway, verifyOtpViaGateway } from '../gateway/gatewayClient';
import { getBookingByRef, assertHoldActive } from './bookingService';
import { ApiError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const MAX_OTP_ATTEMPTS = 5;

export async function sendOtp(bookingRef: string): Promise<{ otpRef: string }> {
  const booking = await getBookingByRef(bookingRef);
  assertHoldActive(booking);

  const otpRef = booking.otp_ref ?? newOtpRef();

  await pool.query(
    `UPDATE bookings SET otp_ref = $1, updated_at = now() WHERE booking_ref = $2`,
    [otpRef, bookingRef]
  );

  try {
    await sendOtpViaGateway(booking.phone, otpRef);
  } catch (err: any) {
    logger.warn('otp send failed - gateway unreachable, allow retry', {
      bookingRef,
      message: err?.message,
    });
    throw new ApiError(502, 'OTP_GATEWAY_ERROR', 'Could not reach OTP gateway, please retry');
  }

  return { otpRef };
}

export async function verifyOtp(
  bookingRef: string,
  code: string
): Promise<{ verified: boolean }> {
  const booking = await getBookingByRef(bookingRef);
  assertHoldActive(booking);

  if (!booking.otp_ref) {
    throw new ApiError(400, 'OTP_NOT_SENT', 'Send an OTP before verifying');
  }
  if (booking.otp_attempts >= MAX_OTP_ATTEMPTS) {
    throw new ApiError(429, 'OTP_ATTEMPTS_EXCEEDED', 'Too many incorrect attempts');
  }

  let ok: boolean;
  try {
    ({ ok } = await verifyOtpViaGateway(booking.otp_ref, code));
  } catch (err: any) {
    logger.warn('otp verify failed - gateway unreachable, allow retry', {
      bookingRef,
      message: err?.message,
    });
    throw new ApiError(502, 'OTP_GATEWAY_ERROR', 'Could not reach OTP gateway, please retry');
  }

  if (ok) {
    await pool.query(
      `UPDATE bookings SET otp_verified = TRUE, status = 'OTP_VERIFIED', updated_at = now()
       WHERE booking_ref = $1`,
      [bookingRef]
    );
    return { verified: true };
  }

  await pool.query(
    `UPDATE bookings SET otp_attempts = otp_attempts + 1, updated_at = now() WHERE booking_ref = $1`,
    [bookingRef]
  );
  return { verified: false };
}
