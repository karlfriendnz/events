alter table activity_modes
  add column if not exists price_per_hour   numeric(10,2),
  add column if not exists price_per_slot   numeric(10,2),
  add column if not exists flat_fee         numeric(10,2),
  add column if not exists price_per_person numeric(10,2);
