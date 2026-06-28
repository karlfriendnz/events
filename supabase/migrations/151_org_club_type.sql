-- ============================================================
-- 151_org_club_type.sql
-- Club types: a platform-wide catalogue managed by super-admins (in /admin),
-- assigned to a club as a MULTI-select on Settings → General.
-- ============================================================

-- Platform-global catalogue (not org-scoped — super-admin owns it).
create table if not exists club_types (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- A club can be tagged with several types.
alter table organisations
  add column if not exists club_type_ids uuid[] not null default '{}';
