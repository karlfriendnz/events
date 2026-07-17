-- ============================================================
-- 268_discipline_requirement_purpose.sql
-- A requirement says one of two DIFFERENT things, and only the author knows which:
--
--   identity → "this is who is IN the discipline"   (Gender = Male, Age 10–14,
--              "must have a blue top to be part of this discipline")
--   data     → "this is what we must have RECORDED about them"  (School, GNZ Number)
--
-- Both are still flags and both evaluate identically. The difference is what the
-- flag MEANS to the club, and therefore what they should do about it:
--   identity unmet → "Sam is female — she shouldn't be in Male"      (wrong group)
--   data unmet     → "Sam is missing her school"                      (chase Sam)
--
-- NOT derivable from the field: a top colour is data, yet "must have a blue top to
-- be part of this discipline" is identity. Gender is usually identity, but "we must
-- record everyone's gender" is data. Only the person writing the rule can say.
--
-- Defaults to 'data' — the safe read for the rows that already exist, and the
-- weaker claim (chase someone for information, rather than assert they don't
-- belong here).
-- ============================================================

alter table discipline_requirements add column if not exists purpose text not null default 'data';

alter table discipline_requirements drop constraint if exists discipline_requirements_purpose_check;
alter table discipline_requirements add constraint discipline_requirements_purpose_check
  check (purpose in ('identity', 'data'));

create index if not exists discipline_requirements_purpose_idx on discipline_requirements(discipline_id, purpose);
