alter table bookings
  add column if not exists purpose  text,
  add column if not exists is_all_day boolean not null default false;
