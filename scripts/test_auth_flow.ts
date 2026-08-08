const BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

async function runAuthTests() {
  console.log('=== Running CinemaSeat Authentication System E2E Tests ===\n');

  // Must meet new password validation constraints (uppercase, lowercase, number, special char, min length 8)
  const testUser = {
    name: 'Test Auth User',
    email: `auth_test_${Date.now()}@example.com`,
    phone: `+88017${Math.floor(10000000 + Math.random() * 90000000)}`,
    password: 'Password123!',
    confirmPassword: 'Password123!',
  };

  try {
    // 0. Test Weak Password Rejections
    console.log('[Step 0] Testing Password Strength Validation Rejections...');
    const weakPasses = [
      { pass: 'short', errorName: 'INVALID_PASSWORD_LENGTH' },
      { pass: 'lowercaseonly1!', errorName: 'PASSWORD_UPPERCASE_REQUIRED' },
      { pass: 'UPPERCASEONLY1!', errorName: 'PASSWORD_LOWERCASE_REQUIRED' },
      { pass: 'NoNumbersHere!', errorName: 'PASSWORD_NUMBER_REQUIRED' },
      { pass: 'NoSpecialChars123', errorName: 'PASSWORD_SPECIAL_REQUIRED' },
    ];

    for (const { pass, errorName } of weakPasses) {
      const res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...testUser,
          email: `weak_${Date.now()}_${Math.random()}@example.com`,
          phone: `+88017${Math.floor(10000000 + Math.random() * 90000000)}`,
          password: pass,
          confirmPassword: pass,
        }),
      });

      const body: any = await res.json();
      console.log(`  Password '${pass}' -> Status: ${res.status}, Error Code: ${body.error} (Expected ${errorName})`);
      if (res.status !== 400 || body.error !== errorName) {
        throw new Error(`Failed to reject weak password '${pass}'. Expected 400 and ${errorName}, got ${res.status} and ${body.error}`);
      }
    }
    console.log('  SUCCESS: All weak passwords correctly rejected with descriptive error messages.');

    // 1. Test Successful Registration (No OTP required)
    console.log('\n[Step 1] Testing POST /auth/register (Immediate registration with strong password)...');
    const regRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser),
    });

    const regData: any = await regRes.json();
    console.log(`  Response Status: ${regRes.status}`);

    if (regRes.status !== 201 || !regData.token || !regData.user?.id) {
      throw new Error(`Registration failed: ${JSON.stringify(regData)}`);
    }

    console.log('  SUCCESS: User registered immediately with ID:', regData.user.id);
    const token = regData.token;

    // 2. Test Duplicate Email Validation
    console.log('\n[Step 2] Testing Duplicate Email Validation...');
    const dupEmailRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...testUser,
        phone: `+88018${Math.floor(10000000 + Math.random() * 90000000)}`,
      }),
    });
    console.log(`  Response Status: ${dupEmailRes.status} (Expected 409)`);
    if (dupEmailRes.status !== 409) {
      throw new Error(`Duplicate email check failed: expected 409, got ${dupEmailRes.status}`);
    }
    console.log('  SUCCESS: Duplicate email correctly rejected.');

    // 3. Test Duplicate Phone Validation
    console.log('\n[Step 3] Testing Duplicate Phone Validation...');
    const dupPhoneRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...testUser,
        email: `another_${Date.now()}@example.com`,
      }),
    });
    console.log(`  Response Status: ${dupPhoneRes.status} (Expected 409)`);
    if (dupPhoneRes.status !== 409) {
      throw new Error(`Duplicate phone check failed: expected 409, got ${dupPhoneRes.status}`);
    }
    console.log('  SUCCESS: Duplicate phone correctly rejected.');

    // 4. Test Login via Email + Password
    console.log('\n[Step 4] Testing POST /auth/login with Email...');
    const loginEmailRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testUser.email,
        password: testUser.password,
      }),
    });
    const loginEmailData: any = await loginEmailRes.json();
    console.log(`  Response Status: ${loginEmailRes.status}`);
    if (loginEmailRes.status !== 200 || !loginEmailData.token) {
      throw new Error(`Login by email failed: ${JSON.stringify(loginEmailData)}`);
    }
    console.log('  SUCCESS: Email login authenticated.');

    // 5. Test Login via Phone + Password
    console.log('\n[Step 5] Testing POST /auth/login with Phone...');
    const loginPhoneRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testUser.phone,
        password: testUser.password,
      }),
    });
    const loginPhoneData: any = await loginPhoneRes.json();
    console.log(`  Response Status: ${loginPhoneRes.status}`);
    if (loginPhoneRes.status !== 200 || !loginPhoneData.token) {
      throw new Error(`Login by phone failed: ${JSON.stringify(loginPhoneData)}`);
    }
    console.log('  SUCCESS: Phone login authenticated.');

    // 6. Test GET /auth/me
    console.log('\n[Step 6] Testing GET /auth/me (Protected User Profile)...');
    const meRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const meData: any = await meRes.json();
    console.log(`  Response Status: ${meRes.status}`);
    if (meRes.status !== 200 || meData.user?.email !== testUser.email.toLowerCase()) {
      throw new Error(`GET /auth/me failed: ${JSON.stringify(meData)}`);
    }
    console.log('  SUCCESS: User profile retrieved for:', meData.user.name);

    // 7. Test Booking Integration with User ID
    console.log('\n[Step 7] Testing Seat Hold with Authenticated User...');
    const movies: any = await fetch(`${BASE_URL}/api/movies`).then((r) => r.json());
    const showtimes: any = await fetch(`${BASE_URL}/api/movies/${movies[0].id}/showtimes`).then((r) => r.json());
    const seats: any = await fetch(`${BASE_URL}/api/showtimes/${showtimes[0].id}/seats`).then((r) => r.json());
    const availableSeat = seats.find((s: any) => s.status === 'AVAILABLE');

    if (!availableSeat) {
      throw new Error('No available seats found for testing');
    }

    const holdRes = await fetch(`${BASE_URL}/api/showtimes/${showtimes[0].id}/seats/${availableSeat.id}/hold`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ phone: testUser.phone }),
    });

    const holdData: any = await holdRes.json();
    console.log(`  Hold Status: ${holdRes.status}, Booking Ref: ${holdData.booking_ref}`);
    if (holdRes.status !== 201 || !holdData.booking_ref) {
      throw new Error(`Authenticated seat hold failed: ${JSON.stringify(holdData)}`);
    }

    // 8. Test GET /auth/my-bookings
    console.log('\n[Step 8] Testing GET /auth/my-bookings...');
    const myBookingsRes = await fetch(`${BASE_URL}/auth/my-bookings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const myBookingsData: any = await myBookingsRes.json();
    console.log(`  Response Status: ${myBookingsRes.status}`);
    if (myBookingsRes.status !== 200 || !Array.isArray(myBookingsData) || myBookingsData.length === 0) {
      throw new Error(`GET /auth/my-bookings failed: ${JSON.stringify(myBookingsData)}`);
    }
    console.log(`  SUCCESS: Found ${myBookingsData.length} booking linked to user account.`);

    // 9. Test Unauthenticated Seat Hold Rejection
    console.log('\n[Step 9] Testing Unauthenticated Seat Hold (Expected 401)...');
    const guestSeat = seats.find((s: any) => s.status === 'AVAILABLE' && s.id !== availableSeat.id);
    if (guestSeat) {
      const guestHoldRes = await fetch(`${BASE_URL}/api/showtimes/${showtimes[0].id}/seats/${guestSeat.id}/hold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '+8801700000000' }),
      });
      console.log(`  Response Status: ${guestHoldRes.status} (Expected 401)`);
      if (guestHoldRes.status !== 401) {
        throw new Error(`Expected guest seat hold to fail with 401, got ${guestHoldRes.status}`);
      }
      console.log('  SUCCESS: Guest seat hold correctly blocked.');
    }

    console.log('\n======================================================');
    console.log(' ALL CINEMASEAT AUTHENTICATION TESTS PASSED CLEANLY!');
    console.log('======================================================\n');
  } catch (err: any) {
    console.error('\n AUTH TEST ERROR:', err.message);
    process.exit(1);
  }
}

runAuthTests();
