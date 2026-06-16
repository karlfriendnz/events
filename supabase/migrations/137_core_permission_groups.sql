-- ============================================================
-- 137_core_permission_groups.sql
-- Core (platform/super-admin) permission groups that clubs inherit.
--   * is_core = true, org_id = null  -> a global template defined by super-admin.
--   * a club "overrides" a core group by creating a local copy whose
--     source_group_id points at the core group; reset = delete the local copy.
-- ============================================================

alter table permission_groups alter column org_id drop not null;
alter table permission_groups add column if not exists is_core boolean not null default false;
alter table permission_groups add column if not exists source_group_id uuid references permission_groups(id) on delete set null;

create index if not exists permission_groups_core_idx on permission_groups(is_core) where is_core;
create index if not exists permission_groups_source_idx on permission_groups(source_group_id);
