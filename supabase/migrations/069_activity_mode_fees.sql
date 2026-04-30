alter table activity_modes
  add column if not exists fees jsonb not null default '[]'::jsonb;
