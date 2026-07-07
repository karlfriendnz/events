-- SPORT × LOCATION STAFF ACCESS GRANTS.
-- 1) Sport becomes a solid fact on the PROGRAMME (group_codes.sport_id),
--    inherited down the code chain like term — every class derives
--    (location, sport), the tuple grants match against.
-- 2) location_staff generalises into scope-tuple grants:
--    (person, role, location?, sport?) — null = ALL. Examples:
--      Sarah: (coach, loc HBC, sport gym) + (coach, loc Albany, sport gym)
--      Max:   (coach, loc NULL, sport gym)      -- all locations, one sport
--    Existing rows (sport null) keep meaning "all sports at that location".
-- Enforcement rule: a person with ANY grants may only touch resources where
-- some grant matches (location, sport) with nulls as wildcards; people with
-- no grants (and super admins) stay unrestricted — never-lock-out preserved.
alter table group_codes add column if not exists sport_id uuid references org_sports(id) on delete set null;

alter table location_staff add column if not exists sport_id uuid references org_sports(id) on delete cascade;
alter table location_staff alter column location_id drop not null;
alter table location_staff drop constraint if exists location_staff_location_id_person_id_role_key_key;
-- Nullable scope columns need a coalesced unique index (nulls are distinct in a plain unique)
create unique index if not exists location_staff_grant_uniq on location_staff (
  person_id, role_key,
  coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(sport_id, '00000000-0000-0000-0000-000000000000'::uuid)
);
