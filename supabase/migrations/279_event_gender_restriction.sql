-- ============================================================
-- Event gender restriction
--
-- An event can be restricted to one gender ("you must be this gender to attend")
-- — e.g. a Girls-only holiday programme. NULL = open to all (mixed). Pairs with
-- the age restriction (events.age_min / age_max, migration 264) so a club can say
-- "12–16, female only". Values mirror persons.gender: MALE | FEMALE | NON_BINARY.
-- ============================================================

alter table events add column if not exists gender_restriction text;
