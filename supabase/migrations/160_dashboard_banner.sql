-- ============================================================
-- 160_dashboard_banner.sql
-- Per-club dashboard hero banner background image. Uploaded from the dashboard
-- hero (pencil button); rendered with a left-side fade so the club logo + name
-- stay readable over it.
-- ============================================================

alter table organisations
  add column if not exists dashboard_banner_url text;
