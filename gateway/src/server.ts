import express from 'express';
import axios from 'axios';
import { customAlphabet } from 'nanoid';

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT ?? 9000);
const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 12);

// In-memory OTP store: ref -> code
const otpStore = new Map<string, string>();

function log(msg: string, meta?: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'info', msg, ...meta }));
}

function randomDelayMs(): number {
  // Callback is intentionally delayed 2-15s to simulate real gateway async
  // settlement, per the contract gatewayClient.ts / paymentService.ts are
  // written against.
  return 2000 + Math.floor(Math.random() * 13000);
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/otp/send', (req, res) => {
  const { phone, ref } = req.body ?? {};
  if (!phone || !ref) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'phone and ref are required' });
  }
  // Fixed, deterministic code so tests/graders don't need to intercept SMS.
  const code = '123456';
  otpStore.set(ref, code);
  log('otp sent (mock)', { ref, code });
  res.status(202).json({ sent: true });
});

app.post('/otp/verify', (req, res) => {
  const { ref, code } = req.body ?? {};
  const expected = otpStore.get(ref);
  if (expected && expected === code) {
    return res.json({ ok: true });
  }
  res.status(400).json({ ok: false, message: 'Incorrect or expired code' });
});

async function fireCallback(callbackUrl: string, payload: Record<string, unknown>) {
  try {
    await axios.post(callbackUrl, payload, { timeout: 5000 });
    log('callback delivered', { eventId: payload.event_id, status: payload.status });
  } catch (err: any) {
    log('callback delivery failed', { eventId: payload.event_id, message: err?.message });
  }
}

app.post('/charge', async (req, res) => {
  const { amount, currency, booking_ref, callback_url } = req.body ?? {};
  const mode = req.header('X-Mock-Mode');
  const force = req.header('X-Mock-Force') ?? 'success';

  if (!amount || !currency || !booking_ref || !callback_url) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'amount, currency, booking_ref, callback_url are required' });
  }

  const paymentId = `pay_${nanoid()}`;
  log('charge received', { paymentId, bookingRef: booking_ref, mode, force });

  const buildEvent = (status: 'SUCCEEDED' | 'FAILED', eventSuffix = '') => ({
    event_id: `evt_${paymentId}${eventSuffix}`,
    payment_id: paymentId,
    booking_ref,
    status,
    amount,
  });

  if (force === 'timeout') {
    // Never respond within the client's GATEWAY_TIMEOUT_MS window - client
    // treats this as "could not initiate" and the booking stays retryable.
    // We still eventually respond so this connection doesn't leak forever.
    setTimeout(() => {
      res.json({ payment_id: paymentId, status: 'PENDING' });
    }, 30000);
    return;
  }

  if (force === 'race') {
    // Deliver the callback BEFORE the /charge response returns, to
    // exercise the "callback arrives before we've stored payment_id" path.
    await fireCallback(callback_url, buildEvent('SUCCEEDED'));
    return res.json({ payment_id: paymentId, status: 'PENDING' });
  }

  // Normal path: respond fast, deliver the callback async after a delay.
  res.json({ payment_id: paymentId, status: 'PENDING' });

  if (force === 'fail') {
    setTimeout(() => fireCallback(callback_url, buildEvent('FAILED')), randomDelayMs());
  } else if (force === 'duplicate') {
    const event = buildEvent('SUCCEEDED');
    setTimeout(() => {
      fireCallback(callback_url, event);
      // Same event_id sent twice - exercises payment_events idempotency.
      setTimeout(() => fireCallback(callback_url, event), 500);
    }, randomDelayMs());
  } else {
    setTimeout(() => fireCallback(callback_url, buildEvent('SUCCEEDED')), randomDelayMs());
  }
});

app.post('/refund', (req, res) => {
  const { payment_id } = req.body ?? {};
  if (!payment_id) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'payment_id is required' });
  }
  log('refund received', { paymentId: payment_id });
  res.json({ status: 'PENDING' });
});

app.listen(PORT, () => {
  log('mock gateway listening', { port: PORT });
});
