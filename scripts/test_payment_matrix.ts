import axios from 'axios';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

async function runPaymentMatrixTest() {
  console.log('=== Starting Problems 3-7 Payment Test Matrix ===\n');

  try {
    // 1. Get a showtime and available seat
    const moviesRes = await axios.get(`${BASE_URL}/api/movies`);
    const movieId = moviesRes.data[0].id;
    const showtimesRes = await axios.get(`${BASE_URL}/api/movies/${movieId}/showtimes`);
    const showtimeId = showtimesRes.data[0].id;

    async function getAvailableSeat() {
      const seatsRes = await axios.get(`${BASE_URL}/api/showtimes/${showtimeId}/seats`);
      const seats = seatsRes.data.filter((s: any) => s.status === 'AVAILABLE');
      if (seats.length === 0) throw new Error('No available seats');
      return seats[0];
    }

    async function holdAndVerifyOtp(seatId: string) {
      const holdRes = await axios.post(`${BASE_URL}/api/showtimes/${showtimeId}/seats/${seatId}/hold`, {
        phone: '+8801700000000',
      });
      const ref = holdRes.data.booking_ref;

      await axios.post(`${BASE_URL}/api/bookings/${ref}/otp/send`);
      // Default mock gateway OTP code is 123456
      await axios.post(`${BASE_URL}/api/bookings/${ref}/otp/verify`, { code: '123456' });

      return ref;
    }

    // --- Scenario 1: Normal Success (X-Mock-Mode: deterministic) ---
    console.log('--- Test 1: Normal Payment Success ---');
    const seat1 = await getAvailableSeat();
    const ref1 = await holdAndVerifyOtp(seat1.id);

    const payRes1 = await axios.post(
      `${BASE_URL}/api/bookings/${ref1}/pay`,
      {},
      { headers: { 'X-Mock-Mode': 'deterministic' } }
    );
    console.log(`Pay request HTTP status: ${payRes1.status} (expected 202)`);

    // Wait for callback processing (deterministic mode takes 2s)
    await new Promise((r) => setTimeout(r, 3000));
    const booking1 = await axios.get(`${BASE_URL}/api/bookings/${ref1}`);
    console.log(`Booking Status after callback: ${booking1.data.status} (expected CONFIRMED)`);

    // --- Scenario 2: Forced Failure (X-Mock-Force: fail) ---
    console.log('\n--- Test 2: Forced Payment Failure ---');
    const seat2 = await getAvailableSeat();
    const ref2 = await holdAndVerifyOtp(seat2.id);

    await axios.post(
      `${BASE_URL}/api/bookings/${ref2}/pay`,
      {},
      { headers: { 'X-Mock-Force': 'fail' } }
    );

    await new Promise((r) => setTimeout(r, 1000));
    const booking2 = await axios.get(`${BASE_URL}/api/bookings/${ref2}`);
    console.log(`Booking Status after failed callback: ${booking2.data.status} (expected FAILED)`);

    // --- Scenario 3: Duplicate Callback Idempotency ---
    console.log('\n--- Test 3: Duplicate Callback Idempotency ---');
    const callbackPayload = {
      event_id: `test_evt_${Date.now()}`,
      payment_id: `test_pay_${Date.now()}`,
      booking_ref: ref1,
      status: 'SUCCEEDED',
      amount: 350,
    };

    const cb1 = await axios.post(`${BASE_URL}/api/payments/callback`, callbackPayload);
    console.log(`First Callback response:`, cb1.data);
    const cb2 = await axios.post(`${BASE_URL}/api/payments/callback`, callbackPayload);
    console.log(`Duplicate Callback response:`, cb2.data);

    if (cb2.data.duplicate === true) {
      console.log(' SUCCESS: Duplicate callback detected and handled idempotently!');
    } else {
      console.error(' FAILURE: Duplicate callback was not flagged as duplicate!');
    }

    // --- Scenario 4: Payment Callback Race (X-Mock-Force: race) ---
    console.log('\n--- Test 4: Callback Race Condition ---');
    const seat3 = await getAvailableSeat();
    const ref3 = await holdAndVerifyOtp(seat3.id);

    const raceRes = await axios.post(
      `${BASE_URL}/api/bookings/${ref3}/pay`,
      {},
      { headers: { 'X-Mock-Force': 'race' } }
    );
    console.log(`Race pay request HTTP status: ${raceRes.status}`);

    await new Promise((r) => setTimeout(r, 1000));
    const booking3 = await axios.get(`${BASE_URL}/api/bookings/${ref3}`);
    console.log(`Booking Status after race: ${booking3.data.status} (expected CONFIRMED)`);

    console.log('\n=== All Payment Matrix Tests Completed Successfully! ===');
  } catch (err: any) {
    console.error('Payment matrix test failed:', err.response ? err.response.data : err.message);
    process.exit(1);
  }
}

runPaymentMatrixTest();
