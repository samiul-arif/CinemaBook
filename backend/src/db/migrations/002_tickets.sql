-- Add ticket generation and QR verification columns to bookings table
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS ticket_generated BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS qr_payload TEXT,
ADD COLUMN IF NOT EXISTS pdf_url TEXT;
