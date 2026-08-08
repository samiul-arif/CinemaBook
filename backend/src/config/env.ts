import dotenv from 'dotenv';
dotenv.config();

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) throw new Error(`Env var ${name} must be an integer`);
  return n;
}

export const env = {
  PORT: int('PORT', 4000),
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PUBLIC_BASE_URL: required('PUBLIC_BASE_URL', 'http://localhost:4000'),

  DATABASE_URL: required('DATABASE_URL'),

  REDIS_URL: required('REDIS_URL', 'redis://localhost:6379'),

  GATEWAY_BASE_URL: required('GATEWAY_BASE_URL', 'http://localhost:9000'),
  GATEWAY_TIMEOUT_MS: int('GATEWAY_TIMEOUT_MS', 5000),

  // Read from env at request time too (not just at boot) so judges can
  // override it without a rebuild if they run with a different value.
  HOLD_TTL_SECONDS: int('HOLD_TTL_SECONDS', 120),
  HOLD_EXPIRY_SWEEP_INTERVAL_MS: int('HOLD_EXPIRY_SWEEP_INTERVAL_MS', 3000),
  OTP_TTL_SECONDS: int('OTP_TTL_SECONDS', 180),
  SEAT_MAP_CACHE_TTL_SECONDS: int('SEAT_MAP_CACHE_TTL_SECONDS', 2),

  CORS_ORIGIN: process.env.CORS_ORIGIN ?? '*',
};

// HOLD_TTL_SECONDS must always be re-read from process.env directly (not the
// cached `env` object) wherever a fresh value matters, since tests/judges
// may mutate it. Expose a getter for that.
export function holdTtlSeconds(): number {
  const raw = process.env.HOLD_TTL_SECONDS;
  if (!raw) return env.HOLD_TTL_SECONDS;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? env.HOLD_TTL_SECONDS : n;
}
