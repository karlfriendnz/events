-- Event visibility: who can see this event.
--   visibility: 'public' | 'internal' | 'all_members' | 'custom' (null = internal).
-- For 'custom', the three json arrays name the extra audience that can also see it —
-- a PEOPLE TYPE, a specific PERSON, and/or a member GROUP (the target-person-or-type
-- rule). All null/empty = nobody extra. Nullable, no default (TiDB-safe). Captured only.
ALTER TABLE `events` ADD `visibility` varchar(20);
ALTER TABLE `events` ADD `visibility_type_keys` json;
ALTER TABLE `events` ADD `visibility_person_ids` json;
ALTER TABLE `events` ADD `visibility_group_ids` json;
