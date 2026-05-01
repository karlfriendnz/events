-- Per-bookable flag controlling whether the booker sees this bookable's
-- children as separate columns (false) or whether the system auto-picks
-- a child slot at booking time (true).
--
-- Used by:
--   • Wizard-built courts (Tennis Court 1, Football Field 1) → true.
--     Their children are alternative slicings (halves/quarters) — the
--     system resolves which slot to occupy based on the mode's
--     configuration_key, the booker just clicks the court.
--   • Top-level facilities (Tennis Courts, Football Fields) → false.
--     Their children are physically distinct courts/fields the booker
--     genuinely picks between.
--   • Standalone bookables (Hall, Lane 1, Locker N) → false (default).
--     Either no children or each child is a real distinct unit.
alter table bookables
  add column if not exists auto_resolve_children boolean not null default false;
