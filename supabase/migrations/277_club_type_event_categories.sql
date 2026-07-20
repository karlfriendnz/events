-- Club-type setup template: DEFAULT EVENT CATEGORIES.
-- The fourth sibling of default_modules / default_person_types / default_terminology
-- (migrations 248 + 255): the event categories a new club of this type is seeded with
-- (e.g. Internal, Holiday Programme, Game, Administration). Stored as a jsonb array of
-- names (text[]-shaped, string[]); null = seed nothing. Applied on new-club creation by
-- useClubTypes().applyClubTypeDefaults, inserting `categories` rows the club doesn't
-- already have (by name). Additive; existing clubs are untouched.
alter table club_types add column if not exists default_event_categories jsonb;
