import { acquireSeatLock } from '../backend/src/services/redisLockService';

async function testRedisFallback(): Promise<void> {
  console.log('=================================================================');
  console.log('  Testing Redis Lock Fallback Behavior');
  console.log('=================================================================\n');

  // Test acquireSeatLock when Redis status is disconnected
  const showtimeId = 'test-showtime-fallback';
  const seatId = 'test-seat-fallback';
  const bookingRef = 'bk_fallback_test';

  console.log('[Test] Invoking acquireSeatLock with dummy params...');
  const lockResult = await acquireSeatLock(showtimeId, seatId, bookingRef);

  console.log(`[Result] acquireSeatLock returned: ${lockResult}`);

  if (lockResult !== true) {
    console.error('❌ FAILURE: acquireSeatLock did not fall back gracefully to true');
    process.exit(1);
  }

  console.log('\n SUCCESS: Redis Lock Fallback Test Passed Cleanly!\n');
  process.exit(0);
}

testRedisFallback().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
