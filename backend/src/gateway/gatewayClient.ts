import axios from 'axios';
import { env } from '../config/env';

const client = axios.create({
  baseURL: env.GATEWAY_BASE_URL,
  timeout: env.GATEWAY_TIMEOUT_MS,
});

export type MockForce = 'fail' | 'duplicate' | 'timeout' | 'race' | 'success';
export type MockMode = 'deterministic';

export interface ChargeRequest {
  amount: number;
  currency: string;
  booking_ref: string;
  callback_url: string;
}

export interface ChargeResponse {
  payment_id: string;
  status: 'PENDING';
}

export interface RefundResponse {
  status: 'PENDING';
}

function controlHeaders(opts?: { mode?: MockMode; force?: MockForce }) {
  const headers: Record<string, string> = {};
  if (opts?.mode) headers['X-Mock-Mode'] = opts.mode;
  if (opts?.force) headers['X-Mock-Force'] = opts.force;
  return headers;
}

/**
 * Fire the charge request. This call itself is expected to return quickly
 * (the gateway's slowness lives in the *callback*, not this response) so we
 * are allowed to await it - but we still guard with a timeout and treat
 * network failure/500/timeout as "could not initiate", never as "failed
 * payment". The booking is left recoverable (client can retry /pay).
 */
export async function chargeViaGateway(
  req: ChargeRequest,
  opts?: { mode?: MockMode; force?: MockForce }
): Promise<ChargeResponse> {
  const res = await client.post('/charge', req, { headers: controlHeaders(opts) });
  return res.data;
}

export async function refundViaGateway(paymentId: string): Promise<RefundResponse> {
  const res = await client.post('/refund', { payment_id: paymentId });
  return res.data;
}

export async function sendOtpViaGateway(phone: string, ref: string): Promise<void> {
  const callbackUrl = `${env.PUBLIC_BASE_URL}/api/payments/otp-callback`;
  await client.post('/otp/send', { phone, ref, callback_url: callbackUrl });
}

export async function fetchOtpCodeFromGateway(ref: string): Promise<string | null> {
  try {
    const res = await client.get(`/debug/otp/${ref}`);
    return res.data?.code ?? null;
  } catch {
    return null;
  }
}

export async function verifyOtpViaGateway(
  ref: string,
  code: string
): Promise<{ ok: boolean }> {
  try {
    await client.post('/otp/verify', { ref, code });
    return { ok: true };
  } catch (err: any) {
    if (err.response && err.response.status === 400) {
      return { ok: false };
    }
    throw err;
  }
}

export async function gatewayHealthy(): Promise<boolean> {
  try {
    await client.get('/health', { timeout: 1000 });
    return true;
  } catch {
    return false;
  }
}
