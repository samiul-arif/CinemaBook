/**
 * Milestone 4 — Scenario C: Find your breakpoint
 *
 * Ramps virtual users (VUs) on the seat-map and hold endpoints to find
 * where the system degrades: p95 latency inflects upward and errors begin.
 *
 * Usage (from project root — NOT from the same machine running the app):
 *   k6 run --env API_BASE_URL=http://localhost:4000 loadtest/k6_loadtest.js
 *
 * What each stage is testing:
 *   Warm-up  (10 VU, 30s) — establishes baseline p95 and confirms green
 *   Ramp-1   (30 VU, 30s) — typical moderate traffic
 *   Ramp-2   (60 VU, 30s) — busy evening; Postgres connection pool starts
 *                            to matter (~10 PG connections default)
 *   Ramp-3   (100 VU, 1m) — heavy rush; Redis pipeline and PG pool queuing
 *                            become visible in latency
 *   Ramp-4   (150 VU, 30s)— breakpoint search: where does p95 exceed 1s?
 *   Ramp-5   (200 VU, 30s)— stress; errors expected here if pool is exhausted
 *   Cool-down(0 VU, 20s)  — drain
 *
 * Expected bottleneck for a Node/Express app on a laptop:
 *   The Postgres connection pool (default pg pool size ~10) is typically
 *   the first bottleneck. Under heavy concurrency, `holdSeat()` transactions
 *   queue waiting for a pool connection. p95 climbs steeply at ~80-100 VUs.
 *   If Redis is the bottleneck (unlikely here since seat-map cache is 2s TTL)
 *   you would see spike on GET /seats before the hold endpoint degrades.
 *   If the Node event loop is blocked, ALL endpoints degrade simultaneously.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics for breakpoint analysis
const holdErrorRate = new Rate('hold_error_rate');
const seatmapDuration = new Trend('seatmap_duration_ms', true);
const holdDuration = new Trend('hold_duration_ms', true);

export const options = {
  stages: [
    { duration: '30s', target: 10  }, // Warm-up — baseline
    { duration: '30s', target: 30  }, // Ramp-1  — moderate
    { duration: '30s', target: 60  }, // Ramp-2  — pg pool pressure starts
    { duration: '60s', target: 100 }, // Ramp-3  — heavy rush
    { duration: '30s', target: 150 }, // Ramp-4  — breakpoint search
    { duration: '30s', target: 200 }, // Ramp-5  — stress (errors expected)
    { duration: '20s', target: 0   }, // Cool-down
  ],
  thresholds: {
    // We want to SEE where these break — set generous limits so the test
    // runs to completion and we can read the p95 inflection from output
    http_req_failed:   ['rate<0.30'],   // allow up to 30% errors before abort
    http_req_duration: ['p(95)<5000'],  // abort only if p95 > 5s
    hold_error_rate:   ['rate<0.50'],   // hold-specific error threshold
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:4000';

/**
 * setup() runs once before all VUs start.
 * Registers one user and returns their token to all VUs.
 */
export function setup() {
  const phone = `+88017${Math.floor(10000000 + Math.random() * 89999999)}`;
  const payload = JSON.stringify({
    name: 'k6 Load Tester',
    email: `k6_loadtest_${Date.now()}@test.invalid`,
    phone,
    password: 'Password123!',
    confirmPassword: 'Password123!',
  });
  const regRes = http.post(`${BASE_URL}/auth/register`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });
  const body = regRes.json();
  if (!body || !body.token) {
    console.error('setup() registration failed:', regRes.status, regRes.body);
    return { token: null };
  }
  console.log('k6 setup: registered load-test user, token starts with', body.token.substring(0, 20));
  return { token: body.token };
}

/**
 * Default function — executed by each VU on every iteration.
 * Simulates the critical booking path: browse → pick showtime → get seatmap → hold.
 */
export default function (data) {
  const authHeaders = {
    'Content-Type': 'application/json',
    ...(data.token ? { Authorization: `Bearer ${data.token}` } : {}),
  };

  // ── 1. Browse movie catalog (read-heavy, should be fast) ──────────────────
  const moviesRes = http.get(`${BASE_URL}/api/movies`);
  check(moviesRes, { 'GET /movies 200': (r) => r.status === 200 });
  const movies = moviesRes.json();
  if (!movies || !movies.length) return;
  const movieId = movies[0].id;

  // ── 2. Fetch showtimes ────────────────────────────────────────────────────
  const showtimesRes = http.get(`${BASE_URL}/api/movies/${movieId}/showtimes`);
  check(showtimesRes, { 'GET /showtimes 200': (r) => r.status === 200 });
  const showtimes = showtimesRes.json();
  if (!showtimes || !showtimes.length) return;
  const showtimeId = showtimes[0].id;

  // ── 3. Fetch seat map (Redis-cached — breakpoint if cache is busted) ──────
  const t0 = Date.now();
  const seatsRes = http.get(`${BASE_URL}/api/showtimes/${showtimeId}/seats`);
  seatmapDuration.add(Date.now() - t0);
  check(seatsRes, { 'GET /seats 200': (r) => r.status === 200 });
  const seats = seatsRes.json();
  if (!seats || !seats.length) return;

  // ── 4. Attempt hold on a random available seat ────────────────────────────
  const available = seats.filter((s) => s.status === 'AVAILABLE');
  if (available.length > 0) {
    const randomSeat = available[Math.floor(Math.random() * available.length)];
    const t1 = Date.now();
    const holdRes = http.post(
      `${BASE_URL}/api/showtimes/${showtimeId}/seats/${randomSeat.id}/hold`,
      JSON.stringify({}),
      { headers: authHeaders }
    );
    holdDuration.add(Date.now() - t1);

    const holdOk =
      holdRes.status === 200 ||
      holdRes.status === 201 ||
      holdRes.status === 409 || // conflict = another VU got it first, not an error
      holdRes.status === 429;   // rate-limited = not an oversell

    holdErrorRate.add(!holdOk);

    check(holdRes, {
      'hold: acceptable response (200/201/409/429)': () => holdOk,
    });
  }

  sleep(1);
}
