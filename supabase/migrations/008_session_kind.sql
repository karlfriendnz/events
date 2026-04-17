ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS session_kind text NOT NULL DEFAULT 'regular'
    CHECK (session_kind IN ('regular', 'pre_event', 'post_event'));
