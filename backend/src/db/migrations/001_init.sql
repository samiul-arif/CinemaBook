-- CinemaSeat initial schema
-- Design notes:
--  * seats.status is the single source of truth for seat availability.
--    Transitions: AVAILABLE -> HELD -> BOOKED
--                 HELD -> AVAILABLE (expiry or payment failure)
--  * The hold/booking race is resolved with a single atomic UPDATE
--    (compare-and-set on seats.status), never a read-then-write from the app.
--  * payments.payment_id has a UNIQUE constraint so a duplicate gateway
--    callback can never create a second payment row.
--  * payment_events stores every raw callback keyed by event_id so retries
--    / duplicates are detected before any side effect runs twice.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS movies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  poster_url TEXT,
  duration_min INT NOT NULL,
  language TEXT,
  genre TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS theatres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS showtimes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  theatre_id UUID NOT NULL REFERENCES theatres(id) ON DELETE CASCADE,
  screen_name TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  base_price NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_showtimes_movie ON showtimes(movie_id);
CREATE INDEX IF NOT EXISTS idx_showtimes_theatre ON showtimes(theatre_id);
CREATE INDEX IF NOT EXISTS idx_showtimes_start_time ON showtimes(start_time);

-- One row per physical seat per showtime. This is what gets locked.
CREATE TABLE IF NOT EXISTS seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  showtime_id UUID NOT NULL REFERENCES showtimes(id) ON DELETE CASCADE,
  seat_row TEXT NOT NULL,
  seat_col INT NOT NULL,
  seat_label TEXT NOT NULL, -- e.g. F12
  seat_type TEXT NOT NULL DEFAULT 'STANDARD', -- STANDARD | PREMIUM | RECLINER
  price NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'AVAILABLE', -- AVAILABLE | HELD | BOOKED
  hold_expires_at TIMESTAMPTZ,
  held_by_booking_ref TEXT,
  version INT NOT NULL DEFAULT 0,
  UNIQUE (showtime_id, seat_label)
);

CREATE INDEX IF NOT EXISTS idx_seats_showtime ON seats(showtime_id);
CREATE INDEX IF NOT EXISTS idx_seats_showtime_status ON seats(showtime_id, status);
-- Sweeper job scans for expired holds; keep this cheap.
CREATE INDEX IF NOT EXISTS idx_seats_hold_expiry ON seats(status, hold_expires_at)
  WHERE status = 'HELD';

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_ref TEXT NOT NULL UNIQUE, -- human/gateway-facing reference, e.g. bk_xxxxx
  showtime_id UUID NOT NULL REFERENCES showtimes(id),
  seat_id UUID NOT NULL REFERENCES seats(id),
  phone TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BDT',
  status TEXT NOT NULL DEFAULT 'HOLD',
  -- HOLD -> OTP_VERIFIED -> PAYMENT_PENDING -> CONFIRMED
  --                                        \-> FAILED
  -- HOLD -> EXPIRED
  otp_ref TEXT,
  otp_verified BOOLEAN NOT NULL DEFAULT FALSE,
  otp_attempts INT NOT NULL DEFAULT 0,
  hold_expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_showtime ON bookings(showtime_id);
CREATE INDEX IF NOT EXISTS idx_bookings_seat ON bookings(seat_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id TEXT UNIQUE, -- gateway payment_id; NULL until /charge responds
  booking_id UUID NOT NULL REFERENCES bookings(id),
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BDT',
  status TEXT NOT NULL DEFAULT 'INITIATING',
  -- INITIATING -> PENDING -> SUCCEEDED | FAILED -> REFUNDED
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_booking_active
  ON payments(booking_id)
  WHERE status IN ('INITIATING', 'PENDING');

CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);

-- Every gateway callback, keyed by its event_id, so duplicates are a cheap
-- primary-key conflict rather than re-running business logic.
CREATE TABLE IF NOT EXISTS payment_events (
  event_id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL,
  booking_ref TEXT NOT NULL,
  status TEXT NOT NULL,
  amount NUMERIC(10, 2),
  raw_payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_events_payment_id ON payment_events(payment_id);
