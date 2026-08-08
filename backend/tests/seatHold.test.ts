/**
 * Integration test against a real Postgres instance (set DATABASE_URL,
 * e.g. via `docker compose up postgres` locally or the CI service
 * container). Proves the core requirement: N concurrent hold attempts on
 * the same seat -> exactly 1 success, N-1 clean rejections, 0 oversell.
 */
import * as fs from 'fs';
import * as path from 'path';
import { pool } from '../src/db/pool';
import { redis } from '../src/redis/client';
import { holdSeat, releaseExpiredHolds } from '../src/services/seatService';
import { newBookingRef } from '../src/utils/ids';
import { verifyOtp } from '../src/services/otpService';
import { initiatePayment } from '../src/services/paymentService';

jest.mock('../src/gateway/gatewayClient', () => {
  const original = jest.requireActual('../src/gateway/gatewayClient');
  return {
    ...original,
    verifyOtpViaGateway: jest.fn().mockResolvedValue({ ok: true }),
    chargeViaGateway: jest.fn().mockImplementation(async () => {
      return { payment_id: 'pay_test_123', status: 'PENDING' };
    }),
  };
});

let showtimeId: string;
let seatId: string;

beforeAll(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now());
  `);
  const dir = path.join(__dirname, '../src/db/migrations');
  for (const file of fs.readdirSync(dir).sort()) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf-8');
    await pool.query(sql);
  }

  // Truncate tables to ensure tests run in a clean environment
  await pool.query('TRUNCATE TABLE payment_events, payments, bookings, seats, showtimes, theatres, movies CASCADE');

  const movie = await pool.query(
    `INSERT INTO movies (title, duration_min) VALUES ('Test Movie', 120) RETURNING id`
  );
  const theatre = await pool.query(
    `INSERT INTO theatres (name, city) VALUES ('Test Theatre', 'Chattogram') RETURNING id`
  );
  const showtime = await pool.query(
    `INSERT INTO showtimes (movie_id, theatre_id, screen_name, start_time, base_price)
     VALUES ($1, $2, 'Screen 1', now() + interval '1 day', 400) RETURNING id`,
    [movie.rows[0].id, theatre.rows[0].id]
  );
  showtimeId = showtime.rows[0].id;

  const seat = await pool.query(
    `INSERT INTO seats (showtime_id, seat_row, seat_col, seat_label, price)
     VALUES ($1, 'F', 12, 'F12', 400) RETURNING id`,
    [showtimeId]
  );
  seatId = seat.rows[0].id;
});

afterAll(async () => {
  await pool.end();
  await redis.quit();
});

test('100 concurrent holds on the same seat: exactly 1 success, 0 oversell', async () => {
  const attempts = Array.from({ length: 100 }, (_, i) =>
    holdSeat({
      showtimeId,
      seatId,
      phone: `+8801700000${String(i).padStart(3, '0')}`,
      bookingRef: newBookingRef(),
    })
      .then(() => ({ ok: true as const }))
      .catch((err) => ({ ok: false as const, status: err.status }))
  );

  const results = await Promise.all(attempts);
  const successes = results.filter((r) => r.ok);
  const rejections = results.filter((r) => !r.ok);

  expect(successes.length).toBe(1);
  expect(rejections.length).toBe(99);
  expect(rejections.every((r: any) => r.status === 409)).toBe(true);

  const seatRow = await pool.query(`SELECT status FROM seats WHERE id = $1`, [seatId]);
  expect(seatRow.rows[0].status).toBe('HELD');
});

test('hold expiry sweep releases an abandoned hold back to AVAILABLE', async () => {
  const seat = await pool.query(
    `INSERT INTO seats (showtime_id, seat_row, seat_col, seat_label, price)
     VALUES ($1, 'F', 13, 'F13', 400) RETURNING id`,
    [showtimeId]
  );
  const otherSeatId = seat.rows[0].id;
  const ref = newBookingRef();

  await holdSeat({ showtimeId, seatId: otherSeatId, phone: '+8801711111111', bookingRef: ref });

  // Force the hold into the past to simulate TTL expiry without waiting.
  await pool.query(`UPDATE seats SET hold_expires_at = now() - interval '1 second' WHERE id = $1`, [
    otherSeatId,
  ]);

  const released = await releaseExpiredHolds();
  expect(released.some((r) => r.seatId === otherSeatId)).toBe(true);

  const after = await pool.query(`SELECT status FROM seats WHERE id = $1`, [otherSeatId]);
  expect(after.rows[0].status).toBe('AVAILABLE');

  // A second user can now successfully hold the freed seat.
  const secondRef = newBookingRef();
  const result = await holdSeat({
    showtimeId,
    seatId: otherSeatId,
    phone: '+8801722222222',
    bookingRef: secondRef,
  });
  expect(result.seat.id).toBe(otherSeatId);
});

test('hold expiry is refreshed on OTP verification and background sweep does not reclaim the seat', async () => {
  const seat = await pool.query(
    `INSERT INTO seats (showtime_id, seat_row, seat_col, seat_label, price)
     VALUES ($1, 'F', 14, 'F14', 400) RETURNING id`,
    [showtimeId]
  );
  const otherSeatId = seat.rows[0].id;
  const ref = newBookingRef();

  await holdSeat({ showtimeId, seatId: otherSeatId, phone: '+8801733333333', bookingRef: ref });
  await pool.query(`UPDATE bookings SET otp_ref = 'test_otp_ref_1' WHERE booking_ref = $1`, [ref]);

  const verifyRes = await verifyOtp(ref, '123456');
  expect(verifyRes.verified).toBe(true);

  const seatAfterVerify = await pool.query(`SELECT hold_expires_at FROM seats WHERE id = $1`, [otherSeatId]);
  const bookingAfterVerify = await pool.query(`SELECT hold_expires_at FROM bookings WHERE booking_ref = $1`, [ref]);
  
  const seatHoldExpires = new Date(seatAfterVerify.rows[0].hold_expires_at).getTime();
  const bookingHoldExpires = new Date(bookingAfterVerify.rows[0].hold_expires_at).getTime();

  expect(seatHoldExpires).toBeGreaterThan(Date.now());
  expect(bookingHoldExpires).toBeGreaterThan(Date.now());

  const released = await releaseExpiredHolds();
  expect(released.some((r) => r.seatId === otherSeatId)).toBe(false);

  const seatStatus = await pool.query(`SELECT status FROM seats WHERE id = $1`, [otherSeatId]);
  expect(seatStatus.rows[0].status).toBe('HELD');
});

test('expired hold cannot be verified via OTP', async () => {
  const seat = await pool.query(
    `INSERT INTO seats (showtime_id, seat_row, seat_col, seat_label, price)
     VALUES ($1, 'F', 15, 'F15', 400) RETURNING id`,
    [showtimeId]
  );
  const otherSeatId = seat.rows[0].id;
  const ref = newBookingRef();

  await holdSeat({ showtimeId, seatId: otherSeatId, phone: '+8801744444444', bookingRef: ref });
  await pool.query(`UPDATE bookings SET otp_ref = 'test_otp_ref_2' WHERE booking_ref = $1`, [ref]);

  await pool.query(`UPDATE seats SET hold_expires_at = now() - interval '1 second' WHERE id = $1`, [otherSeatId]);
  await pool.query(`UPDATE bookings SET hold_expires_at = now() - interval '1 second' WHERE booking_ref = $1`, [ref]);

  await expect(verifyOtp(ref, '123456')).rejects.toThrow();
});

test('hold expiry is refreshed on payment initiation and background sweep does not reclaim the seat', async () => {
  const seat = await pool.query(
    `INSERT INTO seats (showtime_id, seat_row, seat_col, seat_label, price)
     VALUES ($1, 'F', 16, 'F16', 400) RETURNING id`,
    [showtimeId]
  );
  const otherSeatId = seat.rows[0].id;
  const ref = newBookingRef();

  await holdSeat({ showtimeId, seatId: otherSeatId, phone: '+8801755555555', bookingRef: ref });
  await pool.query(`UPDATE bookings SET otp_ref = 'test_otp_ref_3', otp_verified = true, status = 'OTP_VERIFIED' WHERE booking_ref = $1`, [ref]);

  const payRes = await initiatePayment(ref);
  expect(payRes.status).toBe('PENDING');

  const seatAfterPay = await pool.query(`SELECT hold_expires_at FROM seats WHERE id = $1`, [otherSeatId]);
  const bookingAfterPay = await pool.query(`SELECT hold_expires_at FROM bookings WHERE booking_ref = $1`, [ref]);
  
  const seatHoldExpires = new Date(seatAfterPay.rows[0].hold_expires_at).getTime();
  const bookingHoldExpires = new Date(bookingAfterPay.rows[0].hold_expires_at).getTime();

  expect(seatHoldExpires).toBeGreaterThan(Date.now());
  expect(bookingHoldExpires).toBeGreaterThan(Date.now());

  const released = await releaseExpiredHolds();
  expect(released.some((r) => r.seatId === otherSeatId)).toBe(false);

  const seatStatus = await pool.query(`SELECT status FROM seats WHERE id = $1`, [otherSeatId]);
  expect(seatStatus.rows[0].status).toBe('HELD');
});

test('expired hold cannot initiate payment', async () => {
  const seat = await pool.query(
    `INSERT INTO seats (showtime_id, seat_row, seat_col, seat_label, price)
     VALUES ($1, 'F', 17, 'F17', 400) RETURNING id`,
    [showtimeId]
  );
  const otherSeatId = seat.rows[0].id;
  const ref = newBookingRef();

  await holdSeat({ showtimeId, seatId: otherSeatId, phone: '+8801766666666', bookingRef: ref });
  await pool.query(`UPDATE bookings SET otp_ref = 'test_otp_ref_4', otp_verified = true, status = 'OTP_VERIFIED' WHERE booking_ref = $1`, [ref]);

  await pool.query(`UPDATE seats SET hold_expires_at = now() - interval '1 second' WHERE id = $1`, [otherSeatId]);
  await pool.query(`UPDATE bookings SET hold_expires_at = now() - interval '1 second' WHERE booking_ref = $1`, [ref]);

  await expect(initiatePayment(ref)).rejects.toThrow();
});
