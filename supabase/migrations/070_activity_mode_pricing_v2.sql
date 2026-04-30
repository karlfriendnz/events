alter table activity_modes
  add column if not exists pricing jsonb not null default '{}'::jsonb;

alter table activity_modes
  drop column if exists fees,
  drop column if exists price_per_hour,
  drop column if exists price_per_slot,
  drop column if exists flat_fee,
  drop column if exists price_per_person;
