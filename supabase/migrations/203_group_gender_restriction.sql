-- ============================================================
-- Group gender restriction
--
-- A group can be restricted to one gender ("you must be this gender to be in
-- this group") — e.g. a Girls' squad. NULL = open to all (mixed).
-- Values mirror persons.gender: MALE | FEMALE | NON_BINARY.
-- ============================================================

alter table member_groups add column if not exists gender_restriction text;
