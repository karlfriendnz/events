ALTER TABLE availability_rules
  ADD COLUMN IF NOT EXISTS activity_mode_ids uuid[] DEFAULT '{}';
