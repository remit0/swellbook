-- Add GPS coordinates captured at recording time to sessions
ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
