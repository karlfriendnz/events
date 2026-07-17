-- A GOVERNING BODY'S PERSON TYPES ARE TWO DIFFERENT THINGS (17 Jul 2026, per Karl).
--
-- Karl, looking at Football's People & Entities screen: "the people type on clubs
-- vs the people types in parent orgs are different — on the parent org you're
-- simply setting the rules and the data we need to track, whereas the club needs
-- to configure layout etc."
--
-- He's right, and one table was wearing both hats. At a CLUB a person type is an
-- operational thing: a form layout, permissions, a landing page, a dashboard, a
-- menu — real humans who log in. At a BODY, "Player" is a STANDARD: what must be
-- recorded about a player. Nobody at Football IS a Player. Yet the screen offered
-- Football a profile dashboard and menu items to configure for people it does not
-- have, under a heading reading "the kinds of people your CLUB tracks".
--
-- But it is NOT an org-level split: Football has its own real people too (admins,
-- club managers) who do log in and do need the full toolkit. The difference is
-- PURPOSE, not place:
--
--   is_published = false → OUR people. Full toolkit. They log in here.
--   is_published = true  → a STANDARD for the orgs beneath us. Fields + rules
--                          only; clubs link their own types to it.
--
-- Also fixes a leak from 272: loadLinkableTypes offered a club EVERY type its
-- governing bodies own, so a club was being invited to link its Member to
-- Football's internal Admin type. Only published types are linkable.
--
-- Default false is the safe end: an existing type keeps behaving exactly as it
-- does today, and a body opts a type in when it means to publish it.
alter table person_target_types add column if not exists is_published boolean not null default false;

comment on column person_target_types.is_published is
  'true = a STANDARD this org publishes to the orgs beneath it (fields/rules only; linkable via person_type_links). false = this org''s OWN people (layout, permissions, menu, dashboard). Only meaningful on a governing body — a club has nobody beneath it to publish to.';

-- The linker's question is always "what may I link to?", which is exactly this.
create index if not exists person_target_types_published_idx
  on person_target_types(org_id, is_published) where is_published;

-- Backfill: a type owned by a GOVERNING body that a club has ALREADY linked to is,
-- by definition, a published standard — the link is the proof. Anything else stays
-- false, including a body's un-linked types, which it can publish deliberately.
update person_target_types pt set is_published = true
where exists (select 1 from person_type_links l where l.source_type_id = pt.id);
