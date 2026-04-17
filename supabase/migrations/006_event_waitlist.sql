ALTER TABLE events ADD COLUMN IF NOT EXISTS has_waitlist boolean NOT NULL DEFAULT false;
