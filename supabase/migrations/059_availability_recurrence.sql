-- Multiple time slots per rule (e.g. "2-4pm and 6-8pm")
alter table availability_rules
  add column if not exists time_slots jsonb not null default '[]'::jsonb;

-- Recurrence: every N weeks with an anchor date
alter table availability_rules
  add column if not exists week_interval smallint not null default 1,
  add column if not exists week_anchor date;

-- Nth weekday of month (1=first, 2=second, 3=third, 4=fourth, -1=last; null=every week)
alter table availability_rules
  add column if not exists month_week smallint;
