-- organisations.people_columns — per-person-type-tab visible columns on the
-- /people directory table. Shape: { [tabKey]: string[] } where tabKey is
-- 'all' or a person_target_types.key, and each string is a column key
-- ('email'|'phone'|'roles'|'membership'|'age' or 'cf:<field_definition_id>').
-- null / missing tab = code defaults.
alter table organisations add column if not exists people_columns jsonb;
