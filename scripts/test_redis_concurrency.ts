import { redis } from '../backend/src/redis/client';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';
const CONCURRENCY = 100;

function randomPhone(): string {
  return `+88017${Math.floor(10000000 + Math.random() * 89999999)}`;
}

async function registerUser(index: number): Promise<string> {
  const ts = Date.now();
  const body = {
    name: `Redis Tester ${index}`,
    email: `redis_test_${ts}_${index}@test.invalid`,
    phone: randomPhone(),
    password: 'Password123!',
    confirmPassword: 'Password123!',
  };
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Registration failed for user ${index}: HTTP ${res.status} — ${text}`);
  }
  const data = (await res.json()) as any;
  return data.token as string;
}

async function testRedisConcurrency(): Promise<void> {
  console.log('=================================================================');
  console.log('  Testing Redis Distributed Seat Locking (100 Concurrent Requests)');
  console.log('=================================================================\n');

  await redis.ping();

  // 1. Get showtime and available seat
  const movies = await fetch(`${BASE_URL}/api/movies`).then((r) => r.json() as Promise<any[]>);
  const movieId = movies[0].id;
  const showtimes = await fetch(`${BASE_URL}/api/movies/${movieId}/showtimes`).then((r) => r.json() as Promise<any[]>);
  const showtimeId = showtimes[0].id;
  const seats = await fetch(`${BASE_URL}/api/showtimes/${showtimeId}/seats`).then((r) => r.json() as Promise<any[]>);
  const available = seats.filter((s) => s.status === 'AVAILABLE');
  const target = available[0];

  console.log(`[Target] Showtime ID: ${showtimeId}`);
  console.log(`[Target] Seat       : ${target.seat_label} (ID: ${target.id})\n`);

  // 2. Register 100 users
  console.log(`Registering ${CONCURRENCY} test users...`);
  const tokens = await Promise.all(
    Array.from({ length: CONCURRENCY }, (_, i) => registerUser(i))
  );

  // 3. Fire 100 concurrent requests
  console.log(`Firing ${CONCURRENCY} simultaneous hold requests for seat ${target.seat_label}...`);
  const results = await Promise.all(
    tokens.map((token) =>
      fetch(`${BASE_URL}/api/showtimes/${showtimeId}/seats/${target.id}/hold`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }))
    )
  );

  const succeeded = results.filter((r) => r.status === 201);
  const conflicts = results.filter((r) => r.status === 409);
  const other = results.filter((r) => r.status !== 201 && r.status !== 409);

  console.log(`\n[Results] Succeeded (201): ${succeeded.length}`);
  console.log(`[Results] Conflicts (409): ${conflicts.length}`);
  console.log(`[Results] Other     (429/etc): ${other.length}`);

  // Assertions
  if (succeeded.length !== 1) {
    console.error(`❌ FAILURE: Expected exactly 1 successful hold, got ${succeeded.length}`);
    process.exit(1);
  }

  const winningBookingRef = succeeded[0].body.booking_ref;
  console.log(`Winning Booking Ref: ${winningBookingRef}`);

  // Small delay to ensure async redis set is reflected
  await new Promise((r) => setTimeout(r, 200));

  // Check Redis lock key
  const lockKey = `seat:lock:${showtimeId}:${target.id}`;
  const redisLockVal = await redis.get(lockKey);
  console.log(`Redis lock key '${lockKey}' value: ${redisLockVal}`);

  if (redisLockVal !== winningBookingRef) {
    console.error(`❌ FAILURE: Expected Redis lock value to be '${winningBookingRef}', got '${redisLockVal}'`);
    process.exit(1);
  }

  // Verify seat map state
  const updatedSeats = await fetch(`${BASE_URL}/api/showtimes/${showtimeId}/seats`).then((r) => r.json() as Promise<any[]>);
  const targetUpdated = updatedSeats.find((s) => s.id === target.id);
  const heldCount = updatedSeats.filter((s) => s.id === target.id && s.status === 'HELD').length;

  console.log(`Seat status in PostgreSQL: ${targetUpdated?.status}`);
  console.log(`Seat held count          : ${heldCount}`);

  if (heldCount !== 1) {
    console.error(`❌ FAILURE: Oversell detected! Seat held count is ${heldCount}`);
    process.exit(1);
  }

  console.log('\n SUCCESS: Redis Distributed Seat Locking Passed All Assertions!\n');
  process.exit(0);
}

testRedisConcurrency().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
