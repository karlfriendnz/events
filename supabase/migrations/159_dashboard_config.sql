-- ============================================================
-- 159_dashboard_config.sql
-- Per-club dashboard configuration: which widgets show and in what order.
-- Stored as an ordered jsonb array of { key, enabled }. null = use defaults
-- (every widget enabled, registry order). Widget keys are defined in code
-- (pages/dashboard.vue DASHBOARD_WIDGETS) and reconciled on load, so adding a
-- new widget just appends it (enabled) without a migration.
-- ============================================================

alter table organisations
  add column if not exists dashboard_config jsonb;
