-- 172_person_types_multi.sql — multi-role people.
-- A person can hold several "types" (roles) at once: Member + Coach + Parent…
-- Mirrors the field_definitions.targets[]/target pattern (migration 169):
--   • person_types text[] is the multi store (each entry = a person_target_types.key).
--   • persons.person_type (migration 166) is KEPT as the PRIMARY/legacy anchor
--     (= person_types[0]) so the designed profile layout + dashboard catalogue,
--     which key off a single type, keep working unchanged.
-- /people type tabs + the profile's custom-field visibility honour the full array.

alter table public.persons
  add column if not exists person_types text[];

-- Backfill the array from the existing single type.
update public.persons
  set person_types = array[person_type]
  where person_type is not null and (person_types is null or person_types = '{}');

create index if not exists persons_person_types_idx
  on public.persons using gin (person_types);
