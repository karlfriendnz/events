-- ============================================================
-- 149_affiliation_names.sql
-- Club-overridable affiliation names.
--
-- A governing body declares a DEFAULT sport name (e.g. New Zealand Cricket →
-- "Cricket"). A club connecting to it inherits that as the canonical sport
-- (org_sports.sport, used to match disciplines) but can OVERRIDE the label it
-- shows locally (org_sports.display_name, e.g. "Cricky").
-- ============================================================

-- Governing body's default sport name (shown/seeded when a club connects).
alter table organisations
  add column if not exists default_sport_name text;

-- Club's local label override for an affiliation. NULL = use the canonical sport.
alter table org_sports
  add column if not exists display_name text;
