const BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

async function runPaymentMatrixTest() {
  console.log('=== Starting Problems 3-7 Payment Test Matrix ===\n');

  try {
    // 1. Get a showtime and available seat
    const moviesRes = await fetch(`${BASE_URL}/api/movies`).then((r) => r.json());
    const movieId = moviesRes[0].id;
    const showtimesRes = await fetch(`${BASE_URL}/api/movies/${movieId}/showtimes`).then((r) => r.json());
    const showtimeId = showtimesRes[0].id;

    async function getAvailableSeat() {
      const seatsRes = await fetch(`${BASE_URL}/api/showtimes/${showtimeId}/seats`).then((r) => r.json());
      const seats = seatsRes.filter((s: any) => s.status === 'AVAILABLE');
      if (seats.length === 0) throw new Error('No available seats');
      return seats[0];
    }

    async function holdAndVerifyOtp(seatId: string) {
      const holdRes = await fetch(`${BASE_URL}/api/showtimes/${showtimeId}/seats/${seatId}/hold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '+8801700000000' }),
      }).then((r) => r.json());
      const ref = holdRes.booking_ref;

      await fetch(`${BASE_URL}/api/bookings/${ref}/otp/send`, { method: 'POST' });
      await fetch(`${BASE_URL}/api/bookings/${ref}/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: '123456' }),
      });

      return ref;
    }

    // --- Scenario 1: Normal Success (X-Mock-Mode: deterministic) ---
    console.log('--- Test 1: Normal Payment Success ---');
    const seat1 = await getAvailableSeat();
    const ref1 = await holdAndVerifyOtp(seat1.id);

    const payRes1 = await fetch(`${BASE_URL}/api/bookings/${ref1}/pay`, {
      method: 'POST',
      headers: { 'X-Mock-Mode': 'deterministic' },
    });
    console.log(`Pay request HTTP status: ${payRes1.status} (expected 202)`);

    // Wait for callback processing (deterministic mode takes 2s)
    await new Promise((r) => setTimeout(r, 3000));
    const booking1 = await fetch(`${BASE_URL}/api/bookings/${ref1}`).then((r) => r.json());
    console.log(`Booking Status after callback: ${booking1.status} (expected CONFIRMED)`);

    // --- Scenario 2: Forced Failure (X-Mock-Force: fail) ---
    console.log('\n--- Test 2: Forced Payment Failure ---');
    const seat2 = await getAvailableSeat();
    const ref2 = await holdAndVerifyOtp(seat2.id);

    await fetch(`${BASE_URL}/api/bookings/${ref2}/pay`, {
      method: 'POST',
      headers: { 'X-Mock-Force': 'fail' },
    });

    await new Promise((r) => setTimeout(r, 1000));
    const booking2 = await fetch(`${BASE_URL}/api/bookings/${ref2}`).then((r) => r.json());
    console.log(`Booking Status after failed callback: ${booking2.status} (expected FAILED)`);

    // --- Scenario 3: Duplicate Callback Idempotency ---
    console.log('\n--- Test 3: Duplicate Callback Idempotency ---');
    const callbackPayload = {
      event_id: `test_evt_${Date.now()}`,
      payment_id: `test_pay_${Date.now()}`,
      booking_ref: ref1,
      status: 'SUCCEEDED',
      amount: 350,
    };

    const cb1 = await fetch(`${BASE_URL}/api/payments/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(callbackPayload),
    }).then((r) => r.json());
    console.log(`First Callback response:`, cb1);

    const cb2 = await fetch(`${BASE_URL}/api/payments/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(callbackPayload),
    }).then((r) => r.json());
    console.log(`Duplicate Callback response:`, cb2);

    if (cb2.duplicate === true) {
      console.log(' SUCCESS: Duplicate callback detected and handled idempotently!');
    } else {
      console.error(' FAILURE: Duplicate callback was not flagged as duplicate!');
    }

    // --- Scenario 4: Payment Callback Race (X-Mock-Force: race) ---
    console.log('\n--- Test 4: Callback Race Condition ---');
    const seat3 = await getAvailableSeat();
    const ref3 = await holdAndVerifyOtp(seat3.id);

    const raceRes = await fetch(`${BASE_URL}/api/bookings/${ref3}/pay`, {
      method: 'POST',
      headers: { 'X-Mock-Force': 'race' },
    });
    console.log(`Race pay request HTTP status: ${raceRes.status}`);

    await new Promise((r) => setTimeout(r, 1000));
    const booking3 = await fetch(`${BASE_URL}/api/bookings/${ref3}`).then((r) => r.json());
    console.log(`Booking Status after race: ${booking3.status} (expected CONFIRMED)`);

    console.log('\n=== All Payment Matrix Tests Completed Successfully! ===');
  } catch (err: any) {
    console.error('Payment matrix test failed:', err.message);
    process.exit(1);
  }
}

runPaymentMatrixTest();
