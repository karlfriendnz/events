-- Per-rule concurrent booking limit (null = unlimited)
alter table availability_rules
  add column if not exists max_concurrent smallint default null;
