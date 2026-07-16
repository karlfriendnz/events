-- Allow event discounts to SET the price (override to a fixed amount X), not only
-- take a % or $ off. 'REPLACE' already exists on fee_rules; add it to discounts.

alter table discounts drop constraint if exists discounts_modifier_type_check;
alter table discounts add constraint discounts_modifier_type_check
  check (modifier_type in ('FLAT', 'PERCENT', 'REPLACE'));
