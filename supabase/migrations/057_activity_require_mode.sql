-- When true, the wizard hides the "No specific mode" fallback option for this activity
alter table activities add column if not exists require_mode boolean not null default false;
