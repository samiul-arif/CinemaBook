/**
 * Integration test against a real Postgres instance (set DATABASE_URL,
 * e.g. via `docker compose up postgres` locally or the CI service
 * container). Proves the core requirement: N concurrent hold attempts on
 * the same seat -> exactly 1 success, N-1 clean rejections, 0 oversell.
 */
import { pool } from '../src/db/pool';
import { redis } from '../src/redis/client';
import { holdSeat, releaseExpiredHolds } from '../src/services/seatService';
import { newBookingRef } from '../src/utils/ids';

let showtimeId: string;
let seatId: string;

beforeAll(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now());
  `);
  const fs = require('fs');
  const path = require('path');
  const dir = path.join(__dirname, '../src/db/migrations');
  for (const file of fs.readdirSync(dir).sort()) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf-8');
    await pool.query(sql);
  }

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
