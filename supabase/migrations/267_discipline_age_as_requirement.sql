-- ============================================================
-- 267_discipline_age_as_requirement.sql
-- Age becomes an ORDINARY REQUIREMENT rather than a special column.
--
-- 266 gave disciplines an age_min/age_max band. That band did two jobs, and only
-- one of them justified being different from a requirement:
--   1. SELECT which child discipline a person falls into (structural — has to run
--      before requirements, since you can't test Junior Football's rules until you
--      know the person is a Junior).
--   2. FLAG someone outside it (just a test — identical in kind to "must be female").
-- Job 2 is the one that was actually asked for. Job 1 only matters if a class links
-- to a PARENT discipline and expects the system to sort juniors from seniors by
-- DOB — and classes link to the specific discipline instead. So the band collapses
-- into a requirement row ("Age is at most 15"), and the derivation machinery
-- (overlapping-band tie-breaks, out-of-band fallback, recursion) goes away.
--
-- Dropping columns added one migration ago rather than leaving them: nothing reads
-- them, no data was ever written, and a dead column that looks meaningful is
-- exactly the disciplines.sport mistake this codebase just finished cleaning up.
--
-- Age is a VIRTUAL core field (field_column = 'age') computed from persons.dob at
-- evaluation time — the same trick useCustomReports already uses for its 'age'
-- report field. There is no persons.age column and there should not be one.
-- ============================================================

alter table disciplines drop constraint if exists disciplines_age_band_order;
alter table disciplines drop column if exists age_min;
alter table disciplines drop column if exists age_max;

-- Requirements are now a deliberate SUPERSET of the visibility_conditions
-- vocabulary. The extra operators are numeric, and they are principled rather than
-- drift: condPasses tests FORM ANSWERS matched by label, while a requirement tests
-- STORED PERSON DATA including a computed age — a thing form answers have no
-- concept of. Keep the shared five identical in both places; these three are ours.
alter table discipline_requirements drop constraint if exists discipline_requirements_operator_check;
alter table discipline_requirements add constraint discipline_requirements_operator_check
  check (operator in (
    'Equals', 'Is Not', 'Contains', 'Is Empty', 'Is Not Empty',   -- shared with visibility_conditions
    'Is At Least', 'Is At Most', 'Is Between'                     -- numeric; requirements only
  ));
