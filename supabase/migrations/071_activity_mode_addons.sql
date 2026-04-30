alter table activity_modes
  add column if not exists addons jsonb not null default '[]'::jsonb;
