const BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

async function runConcurrencyTest() {
  console.log('=== Starting Problem 1 & 2 Concurrency Test (100 parallel requests on 1 seat) ===');

  try {
    // 1. Fetch movies to get a valid showtime
    const moviesRes = await fetch(`${BASE_URL}/api/movies`).then((r) => r.json());
    if (!moviesRes || moviesRes.length === 0) {
      throw new Error('No movies found');
    }
    const movieId = moviesRes[0].id;

    // 2. Fetch showtimes for movie
    const showtimesRes = await fetch(`${BASE_URL}/api/movies/${movieId}/showtimes`).then((r) => r.json());
    if (!showtimesRes || showtimesRes.length === 0) {
      throw new Error('No showtimes found');
    }
    const showtimeId = showtimesRes[0].id;

    // 3. Fetch seat map to select 1 specific available seat
    const seatsRes = await fetch(`${BASE_URL}/api/showtimes/${showtimeId}/seats`).then((r) => r.json());
    const availableSeats = seatsRes.filter((s: any) => s.status === 'AVAILABLE');
    if (availableSeats.length === 0) {
      throw new Error('No available seats found for testing');
    }
    const targetSeat = availableSeats[0];

    console.log(`Targeting Seat: ${targetSeat.seat_label} (ID: ${targetSeat.id}) on Showtime ID: ${showtimeId}`);

    // 4. Fire 100 concurrent hold requests
    const CONCURRENCY_COUNT = 100;
    const promises: Promise<{ status: number; data?: any }>[] = [];

    console.log(`Launching ${CONCURRENCY_COUNT} simultaneous hold requests...`);
    const startTime = Date.now();

    for (let i = 0; i < CONCURRENCY_COUNT; i++) {
      const p = fetch(`${BASE_URL}/api/showtimes/${showtimeId}/seats/${targetSeat.id}/hold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: `+88017${Math.floor(10000000 + Math.random() * 9000000)}`,
        }),
      }).then(async (res) => ({
        status: res.status,
        data: await res.json().catch(() => ({})),
      }));
      promises.push(p);
    }

    const results = await Promise.all(promises);
    const durationMs = Date.now() - startTime;

    const successfulHolds = results.filter((r) => r.status === 201 || r.status === 200);
    const rejectedHolds = results.filter((r) => r.status === 409);
    const otherErrors = results.filter((r) => r.status !== 200 && r.status !== 201 && r.status !== 409);

    console.log('\n=== Concurrency Test Results ===');
    console.log(`Duration: ${durationMs} ms`);
    console.log(`Total Requests Sent: ${CONCURRENCY_COUNT}`);
    console.log(`Successful Holds (HTTP 200/201): ${successfulHolds.length}`);
    console.log(`Rejected Holds (HTTP 409 Conflict): ${rejectedHolds.length}`);
    console.log(`Other Errors: ${otherErrors.length}`);

    // 5. Verify Seat Map state
    const updatedSeatsRes = await fetch(`${BASE_URL}/api/showtimes/${showtimeId}/seats`).then((r) => r.json());
    const updatedTargetSeat = updatedSeatsRes.find((s: any) => s.id === targetSeat.id);

    console.log(`Updated Seat Status: ${updatedTargetSeat.status}`);

    if (successfulHolds.length === 1 && rejectedHolds.length === CONCURRENCY_COUNT - 1 && updatedTargetSeat.status === 'HELD') {
      console.log('\n SUCCESS: Exactly 1 hold succeeded, 99 cleanly rejected. ZERO overselling confirmed!');
      process.exit(0);
    } else {
      console.error('\n FAILURE: Concurrency assertion failed!');
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Test execution failed:', err.message);
    process.exit(1);
  }
}

runConcurrencyTest();
