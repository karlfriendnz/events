-- Store all form builder config (design, payment, session modes, etc.) as a single JSON blob
alter table registration_forms add column if not exists config jsonb not null default '{}';
