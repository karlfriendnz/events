-- CLUB TYPE DEFAULTS. A club type (super-admin catalogue, club_types) becomes a
-- setup TEMPLATE: it can carry the modules a club of that type runs, the people
-- types it starts with, and its terminology overrides. When a new club is created
-- with a type, these seed the org (organisations.enabled_modules / .terminology +
-- person_target_types rows). Existing clubs are untouched. All null = no default.
--
--   default_modules       jsonb  -- array of enabled module keys (useOrgModules MODULE_DEFS). null = leave all on.
--   default_person_types  jsonb  -- [{ key, label, is_access }]  (person_target_types seed rows)
--   default_terminology   jsonb  -- { termKey: { singular?, plural? } }  (useTerminology overrides shape)
alter table club_types add column if not exists default_modules jsonb;
alter table club_types add column if not exists default_person_types jsonb;
alter table club_types add column if not exists default_terminology jsonb;
