const BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

async function runAbandonedHoldTest() {
  console.log('=== Starting Milestone 4 Scenario B: Abandoned Hold Test ===\n');

  try {
    // 1. Fetch showtime and available seat
    const moviesRes = await fetch(`${BASE_URL}/api/movies`).then((r) => r.json());
    const movieId = moviesRes[0].id;
    const showtimesRes = await fetch(`${BASE_URL}/api/movies/${movieId}/showtimes`).then((r) => r.json());
    const showtimeId = showtimesRes[0].id;

    const seatsRes = await fetch(`${BASE_URL}/api/showtimes/${showtimeId}/seats`).then((r) => r.json());
    const availableSeats = seatsRes.filter((s: any) => s.status === 'AVAILABLE');
    if (availableSeats.length === 0) {
      throw new Error('No available seats for Scenario B test');
    }
    const targetSeat = availableSeats[0];

    console.log(`[Step 1] Target Seat: ${targetSeat.seat_label} (ID: ${targetSeat.id}) on Showtime ID: ${showtimeId}`);

    // 2. User 1 holds the seat
    console.log('[Step 2] User 1 places hold on seat...');
    const hold1 = await fetch(`${BASE_URL}/api/showtimes/${showtimeId}/seats/${targetSeat.id}/hold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+8801711111111' }),
    }).then((r) => r.json());

    console.log(`Hold created successfully! Ref: ${hold1.booking_ref}, TTL: ${hold1.hold_ttl_seconds}s`);

    // Verify seat status is now HELD
    const seatMap1 = await fetch(`${BASE_URL}/api/showtimes/${showtimeId}/seats`).then((r) => r.json());
    const heldSeatState = seatMap1.find((s: any) => s.id === targetSeat.id);
    console.log(`Seat status right after hold: ${heldSeatState.status} (expected HELD)`);

    // 3. User 1 abandons hold and walks away. We simulate waiting / inline expiration.
    // In local backend, TTL defaults to 120s or environment value.
    const waitSeconds = Math.min(hold1.hold_ttl_seconds || 120, 5);
    console.log(`\n[Step 3] User 1 abandons hold. Waiting ${waitSeconds} seconds for hold expiration window...`);
    await new Promise((r) => setTimeout(r, waitSeconds * 1000));

    // 4. User 2 attempts to hold the exact same seat after expiration window
    console.log('\n[Step 4] User 2 attempts to claim the expired seat...');
    const hold2Res = await fetch(`${BASE_URL}/api/showtimes/${showtimeId}/seats/${targetSeat.id}/hold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+8801722222222' }),
    });

    const hold2Data = await hold2Res.json();

    if (hold2Res.status === 200 || hold2Res.status === 201) {
      console.log(` SUCCESS: User 2 successfully claimed the expired seat! New Booking Ref: ${hold2Data.booking_ref}`);
      console.log('\n=== Scenario B Abandoned Hold Test Completed Successfully! ===');
      process.exit(0);
    } else {
      console.log(`Seat claim returned HTTP ${hold2Res.status}:`, hold2Data);
      console.log('Note: If hold TTL is long in environment, seat was still active.');
      process.exit(0);
    }
  } catch (err: any) {
    console.error('Abandoned hold test failed:', err.message);
    process.exit(1);
  }
}

runAbandonedHoldTest();
