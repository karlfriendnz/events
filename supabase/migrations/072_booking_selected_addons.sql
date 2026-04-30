alter table bookings
  add column if not exists selected_addons jsonb not null default '[]'::jsonb;
