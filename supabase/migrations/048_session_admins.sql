alter table sessions add column if not exists admins jsonb not null default '[]'::jsonb;
