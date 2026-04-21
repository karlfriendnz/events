-- Add automation settings JSONB column to events
alter table events add column if not exists automation jsonb default '{}';
