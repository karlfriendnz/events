-- ORG ONBOARDING STATE. A brand-new club's admin is walked through a setup
-- wizard (/onboarding) that teaches + actually configures the club. State is a
-- jsonb blob: which steps are done, when it started/finished, and whether the
-- optional remainder was dismissed. Null = never started (a fresh org).
--   { steps: { club:true, season:true, ... }, started_at, completed_at, dismissed }
-- "Core done" (club + season) is what gates entry to the app; the rest are
-- optional and nudged from the dashboard.
alter table organisations add column if not exists onboarding jsonb;
