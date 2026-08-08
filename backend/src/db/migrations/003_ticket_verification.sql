-- Add HMAC signatures and Check-In tracking to bookings
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS hmac_signature TEXT,
ADD COLUMN IF NOT EXISTS checked_in BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS check_in_gate TEXT;
