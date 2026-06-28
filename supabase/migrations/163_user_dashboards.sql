-- ============================================================
-- 162_user_dashboards.sql
-- Per-person dashboard layout. Each (user, org) keeps their own widget config;
-- organisations.dashboard_config (migration 159) stays as the CLUB DEFAULT that
-- a user starts from when they have no personal row yet. Same jsonb shape:
-- ordered { key, enabled, x, y, w, h, opts? }[].
-- ============================================================

create table if not exists user_dashboards (
  user_id    uuid not null,
  org_id     uuid not null references organisations(id) on delete cascade,
  config     jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, org_id)
);
