alter table availability_rules
  add column if not exists capacity_used int not null default 1,
  add column if not exists color text not null default '#6B7280',
  drop constraint if exists availability_rules_rule_type_check;

alter table availability_rules
  add constraint availability_rules_rule_type_check
  check (rule_type in ('OPEN', 'RESTRICTED', 'CLOSED', 'BLOCK'));

drop table if exists recurring_blocks;
