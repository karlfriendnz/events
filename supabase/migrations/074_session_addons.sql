alter table sessions add column if not exists addons jsonb not null default '[]';
