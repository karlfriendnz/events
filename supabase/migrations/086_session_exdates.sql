-- Excluded dates for recurring sessions (YYYY-MM-DD strings).
-- A date in this array is skipped when expanding the session's recurrence_rule.
alter table sessions add column if not exists exdates text[] not null default '{}';

-- Same idea for top-level recurring events.
alter table events add column if not exists exdates text[] not null default '{}';
