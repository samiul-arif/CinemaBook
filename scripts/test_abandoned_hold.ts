/**
 * Milestone 4 — Scenario B: The abandoned hold
 *
 * Timeline this script proves:
 *   T+0s   User 1 places a hold → seat becomes HELD
 *   T+~3s  Seat map confirms: HELD
 *   T+TTL  Hold expires (TTL read from response)
 *   T+TTL+sweep  Background sweep job releases seat → AVAILABLE
 *   T+TTL+sweep+1  User 2 claims the same seat → new HELD booking created
 *
 * Requires HOLD_TTL_SECONDS=10 in backend/.env (already set).
 * The sweep job runs every HOLD_EXPIRY_SWEEP_INTERVAL_MS=3000ms, so
 * a 10s hold expires and is swept within ~13s total.
 *
 * Usage:
 *   npx ts-node -P scripts/tsconfig.json scripts/test_abandoned_hold.ts
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

function ts(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 23);
}

function log(msg: string): void {
  console.log(`[${ts()}] ${msg}`);
}

function randomPhone(): string {
  return `+88017${Math.floor(10000000 + Math.random() * 89999999)}`;
}

async function register(label: string): Promise<string> {
  const body = {
    name: label,
    email: `${label.toLowerCase().replace(/\s/g, '_')}_${Date.now()}@test.invalid`,
    phone: randomPhone(),
    password: 'Password123!',
    confirmPassword: 'Password123!',
  };
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as any;
  if (!data.token) throw new Error(`Registration failed for ${label}: ${JSON.stringify(data)}`);
  log(`Registered ${label} — token: ${data.token.substring(0, 20)}…`);
  return data.token as string;
}

async function getSeatStatus(showtimeId: string, seatId: string): Promise<string> {
  const seats = await fetch(`${BASE_URL}/api/showtimes/${showtimeId}/seats`).then(
    (r) => r.json() as Promise<any[]>
  );
  const seat = seats.find((s) => s.id === seatId);
  return seat?.status ?? 'UNKNOWN';
}

/** Poll until the seat reaches the expected status or timeout */
async function pollUntil(
  showtimeId: string,
  seatId: string,
  expectedStatus: string,
  timeoutMs: number
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await getSeatStatus(showtimeId, seatId);
    log(`  Polling seat status: ${status}`);
    if (status === expectedStatus) return true;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

async function runScenarioB(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Milestone 4 — Scenario B: The Abandoned Hold');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ── Register two users ───────────────────────────────────────────────────
  const token1 = await register('Abandoning User');
  const token2 = await register('Waiting User');
  console.log();

  // ── Pick target seat ─────────────────────────────────────────────────────
  log('[Setup] Fetching showtime and available seat...');
  const movies = await fetch(`${BASE_URL}/api/movies`).then((r) => r.json() as Promise<any[]>);
  if (!movies?.length) throw new Error('No movies. Run seed first.');
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
  if (!available.length) throw new Error('No available seats.');
  const target = available[0];

  log(`[Setup] Target seat: ${target.seat_label} (ID: ${target.id}) on showtime ${showtimeId}`);
  log(`[Setup] Initial status: ${target.status}\n`);

  // ── Step 1: User 1 holds the seat ────────────────────────────────────────
  log('[Step 1] User 1 places a hold...');
  const holdRes = await fetch(
    `${BASE_URL}/api/showtimes/${showtimeId}/seats/${target.id}/hold`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token1}` },
      body: JSON.stringify({}),
    }
  );
  const hold = (await holdRes.json()) as any;
  if (!holdRes.ok || !hold.booking_ref) {
    throw new Error(`User 1 hold failed: HTTP ${holdRes.status} — ${JSON.stringify(hold)}`);
  }
  const ttl: number = hold.hold_ttl_seconds ?? 10;
  log(`[Step 1] ✅ Hold placed! Booking ref: ${hold.booking_ref}, TTL: ${ttl}s`);
  log(`[Step 1]    Expires at: ${hold.hold_expires_at}`);

  // ── Step 2: Confirm seat is HELD ─────────────────────────────────────────
  const statusAfterHold = await getSeatStatus(showtimeId, target.id);
  log(`[Step 2] Seat status right after hold: ${statusAfterHold}  (expected: HELD)`);
  if (statusAfterHold !== 'HELD') {
    throw new Error('Seat did not transition to HELD immediately after hold!');
  }

  // ── Step 3: User 1 abandons (we do nothing and wait) ────────────────────
  const sweepBuffer = 5; // extra seconds for the sweep job to run
  const waitMs = (ttl + sweepBuffer) * 1000;
  console.log();
  log(`[Step 3] User 1 ABANDONS — walking away without paying.`);
  log(`[Step 3] Waiting ${ttl + sweepBuffer}s for hold to expire and sweep job to release it...`);
  log(`[Step 3] (TTL=${ttl}s + sweep buffer=${sweepBuffer}s)\n`);

  await new Promise((r) => setTimeout(r, waitMs));

  // ── Step 4: Poll for AVAILABLE ───────────────────────────────────────────
  log('[Step 4] Polling for seat to become AVAILABLE (max 30s)...');
  const released = await pollUntil(showtimeId, target.id, 'AVAILABLE', 30_000);
  if (!released) {
    const finalStatus = await getSeatStatus(showtimeId, target.id);
    throw new Error(
      `Seat did not return to AVAILABLE within 30s after TTL+sweep. Current: ${finalStatus}. ` +
      `Check HOLD_EXPIRY_SWEEP_INTERVAL_MS and that the sweep job is running.`
    );
  }
  console.log();
  log(`[Step 4] ✅ Seat is now AVAILABLE — expired hold was swept successfully!`);

  // ── Step 5: User 2 claims the released seat ──────────────────────────────
  console.log();
  log('[Step 5] User 2 claims the now-available seat...');
  const hold2Res = await fetch(
    `${BASE_URL}/api/showtimes/${showtimeId}/seats/${target.id}/hold`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token2}` },
      body: JSON.stringify({}),
    }
  );
  const hold2 = (await hold2Res.json()) as any;

  if (!hold2Res.ok || !hold2.booking_ref) {
    throw new Error(
      `User 2 could not claim the seat: HTTP ${hold2Res.status} — ${JSON.stringify(hold2)}`
    );
  }
  log(`[Step 5] ✅ User 2 successfully claimed seat! New booking ref: ${hold2.booking_ref}`);

  const finalStatus = await getSeatStatus(showtimeId, target.id);
  log(`[Step 5]    Seat status now: ${finalStatus}`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  SCENARIO B — TIMELINE SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  1. Seat started    : AVAILABLE`);
  console.log(`  2. User 1 held it  : HELD (ref: ${hold.booking_ref})`);
  console.log(`  3. User 1 abandoned: waited ${ttl + sweepBuffer}s`);
  console.log(`  4. Sweep released  : AVAILABLE (after TTL=${ttl}s + sweep buffer)`);
  console.log(`  5. User 2 claimed  : HELD (ref: ${hold2.booking_ref})`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('\n✅  PASS — Abandoned hold expired and seat was re-claimed by a different user.');
  process.exit(0);
}

runScenarioB().catch((err) => {
  console.error('\n[Fatal]', err.message);
  process.exit(1);
});
