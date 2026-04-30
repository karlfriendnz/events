-- Track which rule a soft-deleted (deactivated) rule was replaced by, so it can
-- auto-restore when the replacer is deleted.
alter table availability_rules add column if not exists replaced_by_rule_id uuid references availability_rules(id) on delete set null;

create index if not exists availability_rules_replaced_by_idx on availability_rules(replaced_by_rule_id);
