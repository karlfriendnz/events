alter table availability_rules
  drop column if exists price,
  drop column if exists price_type,
  add column if not exists price_tiers jsonb not null default '[]';
