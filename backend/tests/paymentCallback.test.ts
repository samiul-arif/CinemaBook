import * as fs from 'fs';
import * as path from 'path';
import { pool } from '../src/db/pool';
import { redis } from '../src/redis/client';
import { holdSeat } from '../src/services/seatService';
import { newBookingRef } from '../src/utils/ids';
import { processGatewayCallback, initiatePayment } from '../src/services/paymentService';

jest.mock('../src/gateway/gatewayClient', () => {
  const original = jest.requireActual('../src/gateway/gatewayClient');
  return {
    ...original,
    chargeViaGateway: jest.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { payment_id: 'pay_concurrent_123', status: 'PENDING' };
    }),
  };
});

let showtimeId: string;
let seatId: string;
let bookingRef: string;

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

  const movie = await pool.query(`INSERT INTO movies (title, duration_min) VALUES ('CB Movie', 100) RETURNING id`);
  const theatre = await pool.query(`INSERT INTO theatres (name, city) VALUES ('CB Theatre', 'Dhaka') RETURNING id`);
  const showtime = await pool.query(
    `INSERT INTO showtimes (movie_id, theatre_id, screen_name, start_time, base_price)
     VALUES ($1, $2, 'Screen 1', now() + interval '1 day', 400) RETURNING id`,
    [movie.rows[0].id, theatre.rows[0].id]
  );
  showtimeId = showtime.rows[0].id;

  const seat = await pool.query(
    `INSERT INTO seats (showtime_id, seat_row, seat_col, seat_label, price)
     VALUES ($1, 'C', 5, 'C5', 400) RETURNING id`,
    [showtimeId]
  );
  seatId = seat.rows[0].id;

  bookingRef = newBookingRef();
  await holdSeat({ showtimeId, seatId, phone: '+8801733333333', bookingRef });
});

afterAll(async () => {
  await pool.end();
  await redis.quit();
});

test('duplicate SUCCEEDED callback confirms the booking exactly once', async () => {
  const payload = {
    event_id: 'evt_dup_001',
    payment_id: 'pay_dup_001',
    booking_ref: bookingRef,
    status: 'SUCCEEDED' as const,
    amount: 400,
  };

  const first = await processGatewayCallback(payload);
  const second = await processGatewayCallback(payload); // exact duplicate, same event_id

  expect(first.duplicate).toBe(false);
  expect(second.duplicate).toBe(true);

  const seat = await pool.query(`SELECT status FROM seats WHERE id = $1`, [seatId]);
  expect(seat.rows[0].status).toBe('BOOKED');

  const payments = await pool.query(`SELECT * FROM payments WHERE payment_id = $1`, ['pay_dup_001']);
  expect(payments.rowCount).toBe(1);
  expect(payments.rows[0].status).toBe('SUCCEEDED');

  const booking = await pool.query(`SELECT status FROM bookings WHERE booking_ref = $1`, [bookingRef]);
  expect(booking.rows[0].status).toBe('CONFIRMED');
});

test('callback race: SUCCEEDED callback arrives before our own /charge insert (payment row created by callback)', async () => {
  const seat = await pool.query(
    `INSERT INTO seats (showtime_id, seat_row, seat_col, seat_label, price)
     VALUES ($1, 'C', 6, 'C6', 400) RETURNING id`,
    [showtimeId]
  );
  const raceSeatId = seat.rows[0].id;
  const raceRef = newBookingRef();
  await holdSeat({ showtimeId, seatId: raceSeatId, phone: '+8801744444444', bookingRef: raceRef });

  // Callback arrives first - no payments row exists yet for this payment_id.
  const result = await processGatewayCallback({
    event_id: 'evt_race_001',
    payment_id: 'pay_race_001',
    booking_ref: raceRef,
    status: 'SUCCEEDED',
    amount: 400,
  });

  expect(result.duplicate).toBe(false);
  const seatRow = await pool.query(`SELECT status FROM seats WHERE id = $1`, [raceSeatId]);
  expect(seatRow.rows[0].status).toBe('BOOKED');
});

test('FAILED callback releases the seat back to AVAILABLE', async () => {
  const seat = await pool.query(
    `INSERT INTO seats (showtime_id, seat_row, seat_col, seat_label, price)
     VALUES ($1, 'C', 7, 'C7', 400) RETURNING id`,
    [showtimeId]
  );
  const failSeatId = seat.rows[0].id;
  const failRef = newBookingRef();
  await holdSeat({ showtimeId, seatId: failSeatId, phone: '+8801755555555', bookingRef: failRef });

  await processGatewayCallback({
    event_id: 'evt_fail_001',
    payment_id: 'pay_fail_001',
    booking_ref: failRef,
    status: 'FAILED',
    amount: 400,
  });

  const seatRow = await pool.query(`SELECT status FROM seats WHERE id = $1`, [failSeatId]);
  expect(seatRow.rows[0].status).toBe('AVAILABLE');

  const booking = await pool.query(`SELECT status FROM bookings WHERE booking_ref = $1`, [failRef]);
  expect(booking.rows[0].status).toBe('FAILED');
});

test('concurrent payment initiation returns the same active payment details without throwing', async () => {
  const seat = await pool.query(
    `INSERT INTO seats (showtime_id, seat_row, seat_col, seat_label, price)
     VALUES ($1, 'C', 9, 'C9', 400) RETURNING id`,
    [showtimeId]
  );
  const testSeatId = seat.rows[0].id;
  const testRef = newBookingRef();

  // Hold the seat
  await holdSeat({ showtimeId, seatId: testSeatId, phone: '+8801777777777', bookingRef: testRef });

  // Mark OTP verified so payment can be initiated
  await pool.query(
    `UPDATE bookings SET otp_verified = true, status = 'OTP_VERIFIED' WHERE booking_ref = $1`,
    [testRef]
  );

  // Initiate payment concurrently
  const promises = [
    initiatePayment(testRef),
    initiatePayment(testRef),
  ];

  const results = await Promise.all(promises);

  // One should have initiated successfully, the other should have returned the initiating status
  const statuses = results.map(r => r.status);
  const paymentIds = results.map(r => r.paymentId);

  expect(statuses).toContain('PENDING');
  expect(statuses).toContain('INITIATING');
  expect(paymentIds).toContain('pay_concurrent_123');
  expect(paymentIds).toContain('pending');

  // Verify that only one payment record was actually created in the DB
  const payments = await pool.query(
    `SELECT * FROM payments WHERE booking_id = (SELECT id FROM bookings WHERE booking_ref = $1)`,
    [testRef]
  );
  expect(payments.rowCount).toBe(1);
});
