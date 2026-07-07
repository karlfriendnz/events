-- WHAT A PERSON TYPE SEES (configured per type on Settings → Types & fields →
-- Dashboard tab):
--   landing_path       — where this type lands after login (null = /dashboard)
--   profile_dashboard  — the member-profile Dashboard-tab layout for this type
--                        (null = the org-wide organisations.profile_dashboard)
-- The club dashboard per type reuses dashboard_templates (user_type now also
-- accepts a person-type key alongside permission-group ids and '_default').
alter table person_target_types add column if not exists landing_path text;
alter table person_target_types add column if not exists profile_dashboard jsonb;
