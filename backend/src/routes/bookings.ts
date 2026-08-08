import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../middleware/errorHandler';
import { holdSeat } from '../services/seatService';
import { newBookingRef } from '../utils/ids';
import { getBookingByRef } from '../services/bookingService';
import { sendOtp, verifyOtp } from '../services/otpService';
import { initiatePayment } from '../services/paymentService';
import { generateTicket } from '../services/ticketService';
import { holdTtlSeconds } from '../config/env';
import { rateLimiter } from '../middleware/rateLimiter';
import { requireAuth } from '../middleware/auth';
import { getUserBookings } from '../services/authService';

export const bookingsRouter = Router();

/**
 * GET /api/bookings/me
 * Retrieves all bookings for the currently authenticated user
 */
bookingsRouter.get(
  '/bookings/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const bookings = await getUserBookings(userId);
    res.json(bookings);
  })
);

/**
 * POST /api/showtimes/:showtimeId/seats/:seatId/hold
 *
 * Phone number is derived from the authenticated user's JWT payload — no phone
 * field is accepted from the request body. After a successful hold the OTP is
 * dispatched automatically so the client lands directly on the verify screen.
 */
bookingsRouter.post(
  '/showtimes/:showtimeId/seats/:seatId/hold',
  rateLimiter,
  requireAuth,
  asyncHandler(async (req, res) => {
    const { showtimeId, seatId } = req.params;

    // Phone comes from the authenticated user record — never from the client
    const phone = req.user!.phone;
    if (!phone) {
      throw new ApiError(400, 'PHONE_MISSING', 'No phone number on file. Please update your profile.');
    }

    const bookingRef = newBookingRef();
    const { seat, holdExpiresAt } = await holdSeat({
      showtimeId,
      seatId,
      phone,
      bookingRef,
      userId: req.user!.id,
    });

    // Auto-send OTP immediately — client skips the "Send OTP" step
    let otpCode: string | undefined;
    try {
      const otpRes = await sendOtp(bookingRef);
      otpCode = otpRes.code;
    } catch {
      // Non-fatal: client can resend from the booking page if gateway is down
    }

    res.status(201).json({
      booking_ref: bookingRef,
      seat: { id: seat.id, label: seat.seat_label, price: seat.price },
      hold_ttl_seconds: holdTtlSeconds(),
      hold_expires_at: holdExpiresAt.toISOString(),
      otp_code: otpCode,
    });
  })
);

bookingsRouter.get(
  '/bookings/:ref',
  requireAuth,
  asyncHandler(async (req, res) => {
    const booking = await getBookingByRef(req.params.ref);
    if (booking.user_id && booking.user_id !== req.user!.id) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to view this booking');
    }

    let otpCode: string | undefined;
    if (booking.status === 'HOLD' && booking.otp_ref) {
      const { fetchOtpCodeFromGateway } = await import('../gateway/gatewayClient');
      const code = await fetchOtpCodeFromGateway(booking.otp_ref);
      if (code) {
        otpCode = code;
      }
    }

    res.json({
      ...booking,
      otp_code: otpCode,
    });
  })
);

bookingsRouter.post(
  '/bookings/:ref/otp/send',
  requireAuth,
  asyncHandler(async (req, res) => {
    const booking = await getBookingByRef(req.params.ref);
    if (booking.user_id && booking.user_id !== req.user!.id) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to modify this booking');
    }
    res.status(202).json(await sendOtp(req.params.ref));
  })
);

bookingsRouter.post(
  '/bookings/:ref/otp/verify',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { code } = req.body ?? {};
    if (!code) throw new ApiError(400, 'CODE_REQUIRED', 'code is required');
    const booking = await getBookingByRef(req.params.ref);
    if (booking.user_id && booking.user_id !== req.user!.id) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to modify this booking');
    }
    const result = await verifyOtp(req.params.ref, code);
    if (!result.verified) {
      return res.status(400).json({ verified: false, message: 'Incorrect or expired code' });
    }
    res.json({ verified: true });
  })
);

/**
 * Kicks off payment and returns immediately (202) without waiting on the
 * gateway callback. The client should poll GET /bookings/:ref for the
 * booking to flip to CONFIRMED / FAILED.
 *
 * Optional testing headers X-Mock-Mode / X-Mock-Force are forwarded
 * straight through to the gateway (see README "Testing with the mock
 * gateway").
 */
bookingsRouter.post(
  '/bookings/:ref/pay',
  requireAuth,
  asyncHandler(async (req, res) => {
    const booking = await getBookingByRef(req.params.ref);
    if (booking.user_id && booking.user_id !== req.user!.id) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to pay for this booking');
    }
    const mode = req.header('X-Mock-Mode') as any;
    const force = req.header('X-Mock-Force') as any;
    const result = await initiatePayment(req.params.ref, { mode, force });
    res.status(202).json(result);
  })
);

/**
 * Generate Printable E-Ticket with QR Code Payload
 * POST /api/bookings/:ref/ticket
 */
bookingsRouter.post(
  '/bookings/:ref/ticket',
  requireAuth,
  asyncHandler(async (req, res) => {
    const booking = await getBookingByRef(req.params.ref);
    if (booking.user_id && booking.user_id !== req.user!.id) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to generate a ticket for this booking');
    }
    const ticket = await generateTicket(req.params.ref);
    res.json(ticket);
  })
);
