import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * Milestone 4 Scenario C: Breakpoint & Performance Load Test
 *
 * Usage:
 *   k6 run loadtest/k6_loadtest.js
 *
 * Ramps virtual users (VUs) from 10 to 200 to measure p95 latency,
 * throughput (RPS), connection pool stability, and error thresholds.
 */

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Ramp up to 20 VUs (light load)
    { duration: '1m', target: 50 },   // Ramp up to 50 VUs (medium rush)
    { duration: '1m', target: 100 },  // Ramp up to 100 VUs (heavy rush)
    { duration: '30s', target: 150 }, // Push to 150 VUs (breakpoint search)
    { duration: '30s', target: 0 },   // Cool down
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],    // Under 5% error rate expected
    http_req_duration: ['p(95)<1000'], // p95 latency under 1000ms
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:4000';

export default function () {
  // 1. Browse Movies Catalog
  const moviesRes = http.get(`${BASE_URL}/api/movies`);
  check(moviesRes, {
    'movies status is 200': (r) => r.status === 200,
  });

  const movies = moviesRes.json();
  if (!movies || movies.length === 0) return;
  const movieId = movies[0].id;

  // 2. Fetch Showtimes
  const showtimesRes = http.get(`${BASE_URL}/api/movies/${movieId}/showtimes`);
  check(showtimesRes, {
    'showtimes status is 200': (r) => r.status === 200,
  });

  const showtimes = showtimesRes.json();
  if (!showtimes || showtimes.length === 0) return;
  const showtimeId = showtimes[0].id;

  // 3. Fetch Seat Map (heavy read endpoint - tests Redis / Postgres performance)
  const seatsRes = http.get(`${BASE_URL}/api/showtimes/${showtimeId}/seats`);
  check(seatsRes, {
    'seatmap status is 200': (r) => r.status === 200,
  });

  const seats = seatsRes.json();
  if (!seats || seats.length === 0) return;

  // 4. Attempt Hold on an available seat
  const availableSeats = seats.filter((s) => s.status === 'AVAILABLE');
  if (availableSeats.length > 0) {
    const randomSeat = availableSeats[Math.floor(Math.random() * availableSeats.length)];
    const payload = JSON.stringify({
      phone: `+88017${Math.floor(10000000 + Math.random() * 9000000)}`,
    });

    const holdRes = http.post(
      `${BASE_URL}/api/showtimes/${showtimeId}/seats/${randomSeat.id}/hold`,
      payload,
      { headers: { 'Content-Type': 'application/json' } }
    );

    check(holdRes, {
      'hold status is 200/201 or 409 conflict': (r) =>
        r.status === 200 || r.status === 201 || r.status === 409,
    });
  }

  sleep(1);
}
