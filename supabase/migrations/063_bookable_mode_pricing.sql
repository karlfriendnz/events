ALTER TABLE bookable_modes
  ADD COLUMN IF NOT EXISTS price_per_hour   numeric(10,2),
  ADD COLUMN IF NOT EXISTS price_per_slot   numeric(10,2),
  ADD COLUMN IF NOT EXISTS flat_fee         numeric(10,2),
  ADD COLUMN IF NOT EXISTS price_per_person numeric(10,2);
