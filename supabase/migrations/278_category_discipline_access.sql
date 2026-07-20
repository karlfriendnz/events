-- Event categories gain two club-managed controls (managed in Settings → Events):
--   default_discipline_id — the category's default governing-body discipline. Events
--     created in the category start linked to it (a convenience default; the club can
--     still change per event). References disciplines(id); SET NULL if that discipline
--     is removed so the category never points at a dead row.
--   WHO CAN ACCESS — a permission target is a person TYPE or a specific PERSON (the
--     system-wide rule: any access control may name a people type or an individual):
--       access_type_keys  — jsonb array of person_target_types.key.
--       access_person_ids — jsonb array of persons.id.
--     Both NULL / empty = everyone.
-- Additive; existing categories are untouched (all null).
alter table categories add column if not exists default_discipline_id uuid references disciplines(id) on delete set null;
alter table categories add column if not exists access_type_keys jsonb;
alter table categories add column if not exists access_person_ids jsonb;
