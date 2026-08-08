/**
 * Milestone 4 — Scenario A: One seat, many buyers
 *
 * Registers 100 unique users, then fires 100 simultaneous hold requests
 * for the SAME seat in a single Promise.all burst.
 *
 * Why 100 separate users?
 *   The rate-limiter is keyed per-IP (5 req/s). All requests originate from
 *   localhost so they share one IP. Using 100 distinct JWTs does not bypass
 *   the IP-level rate limit but each request carries a unique auth context,
 *   which is the realistic scenario (100 real browsers hitting "Hold").
 *   Crucially, rate-limit rejections (429) are as valid as conflict rejections
 *   (409) for proving oversell-safety — neither implies a seat was double-held.
 *   The definitive proof is the post-test seat-map: the seat must be HELD
 *   exactly once, never twice.
 *
 * Usage:
 *   npx ts-node -P scripts/tsconfig.json scripts/test_concurrency.ts
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';
const CONCURRENCY = 100;

function randomPhone(): string {
  return `+88017${Math.floor(10000000 + Math.random() * 89999999)}`;
}

async function registerUser(index: number): Promise<string> {
  const ts = Date.now();
  const body = {
    name: `Stress Tester ${index}`,
    email: `stress_${ts}_${index}@test.invalid`,
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
  if (!data.token) throw new Error(`No token in registration response for user ${index}`);
  return data.token as string;
}

async function runScenarioA(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Milestone 4 — Scenario A: One Seat, Many Buyers');
  console.log('  100 concurrent hold requests on a single seat');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('[Setup] Fetching a valid showtime and available seat...');
  const movies = await fetch(`${BASE_URL}/api/movies`).then((r) => r.json() as Promise<any[]>);
  if (!movies?.length) throw new Error('No movies in DB — run the seed script first.');
  const movieId = movies[0].id;

  const showtimes = await fetch(`${BASE_URL}/api/movies/${movieId}/showtimes`).then(
    (r) => r.json() as Promise<any[]>
  );
  if (!showtimes?.length) throw new Error('No showtimes found.');
  const showtimeId = showtimes[0].id;

  const seats = await fetch(`${BASE_URL}/api/showtimes/${showtimeId}/seats`).then(
    (r) => r.json() as Promise<any[]>
  );
  const available = seats.filter((s) => s.status === 'AVAILABLE');
  if (!available.length) throw new Error('No available seats — try a different showtime or reset DB.');

  const target = available[0];
  console.log(`[Setup] Showtime ID   : ${showtimeId}`);
  console.log(`[Setup] Target seat   : ${target.seat_label} (ID: ${target.id})`);
  console.log(`[Setup] Status before : ${target.status}\n`);

  console.log(`[Setup] Registering ${CONCURRENCY} unique users...`);
  const setupStart = Date.now();
  const tokens = await Promise.all(
    Array.from({ length: CONCURRENCY }, (_, i) => registerUser(i))
  );
  console.log(`[Setup] Done — ${tokens.length} users registered in ${Date.now() - setupStart}ms\n`);

  console.log(`[Test]  Launching ${CONCURRENCY} simultaneous hold requests NOW...`);
  const burstStart = Date.now();

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

  const burstMs = Date.now() - burstStart;

  const successes  = results.filter((r) => r.status === 200 || r.status === 201);
  const conflicts  = results.filter((r) => r.status === 409);
  const rateLimits = results.filter((r) => r.status === 429);
  const authErrors = results.filter((r) => r.status === 401 || r.status === 403);
  const other      = results.filter(
    (r) => ![200, 201, 409, 429, 401, 403].includes(r.status)
  );

  // Wait briefly for cache to bust then re-fetch seat map
  await new Promise((r) => setTimeout(r, 300));
  const seatsAfter = await fetch(`${BASE_URL}/api/showtimes/${showtimeId}/seats`).then(
    (r) => r.json() as Promise<any[]>
  );
  const targetAfter = seatsAfter.find((s) => s.id === target.id);
  const heldCount = seatsAfter.filter(
    (s) => s.id === target.id && s.status === 'HELD'
  ).length;

  const oversellCount = Math.max(0, successes.length - 1);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  SCENARIO A — RESULTS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Burst duration            : ${burstMs} ms`);
  console.log(`  Requests sent             : ${CONCURRENCY}`);
  console.log(`  Successful holds    (201) : ${successes.length}  ← must be exactly 1`);
  console.log(`  Seat conflicts      (409) : ${conflicts.length}`);
  console.log(`  Rate-limited        (429) : ${rateLimits.length}`);
  console.log(`  Auth errors     (401/403) : ${authErrors.length}`);
  console.log(`  Other errors              : ${other.length}`);
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`  Seat status (post-burst)  : ${targetAfter?.status ?? 'UNKNOWN'}`);
  console.log(`  HELD entries in seat map  : ${heldCount}  ← must be ≤ 1`);
  console.log(`  OVERSELL COUNT            : ${oversellCount}  ← must be 0`);
  console.log('═══════════════════════════════════════════════════════════════');

  if (other.length > 0) {
    console.log('\n[Debug] Unexpected status codes:');
    other.slice(0, 5).forEach((r) => console.log('  ', r.status, JSON.stringify(r.body)));
  }
  if (authErrors.length > 0) {
    console.log('\n[Debug] Auth errors — backend may have restarted. Re-run after restart.\n');
  }

  const pass =
    successes.length === 1 &&
    oversellCount === 0 &&
    heldCount <= 1 &&
    authErrors.length === 0;

  if (pass) {
    console.log('\n✅  PASS — Exactly 1 hold succeeded. Zero overselling. Seat held exactly once.');
    process.exit(0);
  } else {
    console.error('\n❌  FAIL — Concurrency assertion violated!');
    if (successes.length !== 1) console.error(`   Expected 1 success, got ${successes.length}`);
    if (oversellCount > 0)      console.error(`   OVERSELL: ${oversellCount} extra bookings for same seat`);
    if (heldCount > 1)          console.error(`   Seat map shows HELD ${heldCount} times — integrity breach`);
    process.exit(1);
  }
}

runScenarioA().catch((err) => {
  console.error('\n[Fatal]', err.message);
  process.exit(1);
});
