-- ============================================================
-- 164_dashboard_templates.sql
-- Club dashboard DEFAULT templates, keyed by user type (= permission group).
-- An admin saves the current /dashboard layout as the template for a role
-- (permission_groups.id) or for everyone ('_default'). A user with no personal
-- user_dashboards row (163) starts from the template matching their role, else
-- the '_default' template, else organisations.dashboard_config (159), else code.
-- Same jsonb shape as the rest: ordered { key, enabled, x, y, w, h, opts? }[].
-- ============================================================

create table if not exists dashboard_templates (
  org_id     uuid not null references organisations(id) on delete cascade,
  -- a permission_groups.id (as text), or '_default' for the all-users fallback
  user_type  text not null,
  config     jsonb,
  updated_at timestamptz not null default now(),
  primary key (org_id, user_type)
);
