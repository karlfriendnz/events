-- ============================================================
-- 269_backfill_requirement_purpose.sql
-- 268 added `purpose` with a default of 'data', then the wizard learned to DERIVE
-- it from the operator. Rows written in between kept the default — so a real rule
-- like "Gender Equals MALE" is sitting there marked `data`, and its flag would read
-- "Gender must be MALE" (go chase them) instead of "doesn't match Male" (they're in
-- the wrong discipline).
--
-- Same rule the editor now applies (derivePurpose in useDisciplineRequirements):
--   a PRESENCE test ("must be recorded" / "must be blank") → data
--   a VALUE test    ("must be Female", "must be at most 15") → identity
--   an exemption asserts nothing → data (the weaker claim)
--
-- Idempotent: re-running only ever re-asserts the same mapping.
-- ============================================================

update discipline_requirements
   set purpose = 'identity'
 where exempt = false
   and operator not in ('Is Not Empty', 'Is Empty')
   and purpose <> 'identity';

update discipline_requirements
   set purpose = 'data'
 where (exempt = true or operator in ('Is Not Empty', 'Is Empty'))
   and purpose <> 'data';
