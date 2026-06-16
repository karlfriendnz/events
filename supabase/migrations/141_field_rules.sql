-- ============================================================
-- 141_field_rules.sql
-- Rules engine on field definitions: conditional parameters, e.g.
--   * required when discipline = "Premier"
--   * required when registrant age < 16
-- Stored as jsonb on the field:
--   rules = [ { subject:'discipline'|'age'|'gender', op:'is'|'is_not'|'lt'|'gt'|'lte'|'gte', value:<any> }, ... ]
-- Field is required when is_required is true OR any rule matches the registrant context.
-- ============================================================

alter table field_definitions add column if not exists rules jsonb not null default '[]';
