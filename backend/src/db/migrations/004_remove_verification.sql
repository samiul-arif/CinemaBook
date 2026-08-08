-- Remove verification and check-in tracking columns to align with simplified scope
ALTER TABLE bookings
DROP COLUMN IF EXISTS hmac_signature,
DROP COLUMN IF EXISTS checked_in,
DROP COLUMN IF EXISTS checked_in_at,
DROP COLUMN IF EXISTS check_in_gate;

DROP INDEX IF EXISTS idx_bookings_checked_in;
