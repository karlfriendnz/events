alter table availability_rules
  add column if not exists price numeric(10,2),
  add column if not exists price_type text check (price_type in ('per_hour', 'per_session', 'free'));
