const BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

async function testTicketGeneration() {
  console.log('=== Testing E-Ticket Generation & Verification Endpoints ===\n');

  try {
    // 1. Get showtime and available seat
    const movies = await fetch(`${BASE_URL}/api/movies`).then((r) => r.json());
    const showtimes = await fetch(`${BASE_URL}/api/movies/${movies[0].id}/showtimes`).then((r) => r.json());
    const seats = await fetch(`${BASE_URL}/api/showtimes/${showtimes[0].id}/seats`).then((r) => r.json());
    const avail = seats.filter((s: any) => s.status === 'AVAILABLE')[0];

    // 2. Hold seat
    const hold = await fetch(`${BASE_URL}/api/showtimes/${showtimes[0].id}/seats/${avail.id}/hold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+8801784738289' }),
    }).then((r) => r.json());

    const ref = hold.booking_ref;
    console.log(`[Step 1] Created Hold: ${ref}`);

    // 3. OTP send & verify
    await fetch(`${BASE_URL}/api/bookings/${ref}/otp/send`, { method: 'POST' });
    await fetch(`${BASE_URL}/api/bookings/${ref}/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '123456' }),
    });
    console.log('[Step 2] OTP Verified');

    // 4. Directly mark booking as CONFIRMED for testing ticket generation
    const payRes = await fetch(`${BASE_URL}/api/payments/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: `t_evt_${Date.now()}`,
        payment_id: `t_pay_${Date.now()}`,
        booking_ref: ref,
        status: 'SUCCEEDED',
        amount: 450,
      }),
    }).then((r) => r.json());
    console.log('[Step 3] Payment Callback Processed:', payRes);

    // 5. POST /api/bookings/:ref/ticket
    console.log('[Step 4] Calling POST /api/bookings/:ref/ticket...');
    const ticketRes = await fetch(`${BASE_URL}/api/bookings/${ref}/ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    console.log(`Ticket endpoint status: ${ticketRes.status}`);
    const ticketData = await ticketRes.json();

    if (ticketRes.status === 200) {
      console.log(' SUCCESS: Ticket generated successfully!');
      console.log('Ticket Details:', {
        booking_ref: ticketData.booking_ref,
        movie: ticketData.movie.title,
        seat: ticketData.seat.seat_label,
        qr_payload: ticketData.booking.qr_payload,
      });

      console.log('\n=== E-Ticket Generation Test PASSED! ===');
      process.exit(0);
    } else {
      console.error('FAILURE:', ticketData);
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Test error:', err.message);
    process.exit(1);
  }
}

testTicketGeneration();
