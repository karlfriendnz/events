-- WHO TAKES PART IN A DISCIPLINE (17 Jul 2026, per Karl).
--
-- Karl: "do we need to specifically say that a discipline has these people types?
-- so that when a code or group is connected to a discipline then it will use these
-- people when adding people to the group."
--
-- Yes. I argued for DERIVING the cast from the rules' applies_to — one source of
-- truth, nothing to drift. Karl pushed back and he was right, on three counts:
--   • The ordering is backwards. To tell a club Juniors involves coaches you'd
--     first have to invent a REQUIREMENT about coaches.
--   • A cast member with no rules is real: Juniors has referees, the body requires
--     nothing of them, and the club still has to be able to add one.
--   • The cast is useful on its own — "Juniors involves Players, Coaches and a Team
--     Manager" tells a club the shape of the thing with zero rules attached.
-- And explicit makes the rules better: each rule's "for" chips now scope to the
-- cast instead of offering every type the body owns.
--
-- WHY THIS FIXES A SILENT FAILURE: being a "coach" on a roster is a per-class ROLE
-- (member_group_memberships.roles[]), while discipline_requirements.applies_to
-- matches the person's GLOBAL type (persons.person_types[]). Two different fields.
-- Adding staff to a class stamps a role and NO type — so a body's "coaches need a
-- certificate" rule matched nobody, with no error. The cast is what lets the class
-- know its cast, so adding a person can stamp the type the rule actually reads.
--
-- text[] of the BODY'S OWN person_target_types.key — the same currency as
-- discipline_requirements.applies_to, on purpose. Two lists describing the same
-- people in different currencies (keys here, uuids there) is precisely the
-- "two stores wearing one name" trap that let a body ship every club a field
-- called "New field" without knowing. A key whose type is later deleted simply
-- stops resolving, which is harmless — unlike a dead FIELD reference, which would
-- flag every member forever (see 266's field_definition_id/field_column split).
--
-- NULL/empty = says nothing, and INHERITS from the parent discipline (closest-wins,
-- like requirements). Not "nobody takes part".
alter table disciplines add column if not exists person_type_keys text[];

comment on column disciplines.person_type_keys is
  'The cast: person_target_types.key[] of the OWNING BODY''s own types who take part in this discipline. NULL/empty = inherit from the parent discipline. A rule''s applies_to should be a subset. Clubs map these to their own type names via person_type_links (272) — the club''s label is free.';
