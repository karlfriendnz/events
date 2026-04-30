ALTER TABLE availability_rules
  ADD COLUMN IF NOT EXISTS bookable_mode_id uuid REFERENCES bookable_modes(id) ON DELETE SET NULL;
