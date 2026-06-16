-- ============================================================
-- 135_permission_groups.sql
-- Role-based access: permission groups (named CRUD permission sets) that
-- people can be assigned to. The list of "functions"/resources is defined in
-- code (composables/usePermissions.ts PERMISSION_RESOURCES) and extends as we
-- build — the grid renders whatever the registry contains; grants are stored
-- per group as jsonb keyed by resource, so new resources just default to off.
-- ============================================================

create table if not exists permission_groups (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organisations(id) on delete cascade,
  name        text not null,
  description text,
  -- { "<resourceKey>": { "create": bool, "read": bool, "update": bool, "delete": bool }, ... }
  permissions jsonb not null default '{}',
  is_system   boolean not null default false,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists permission_groups_org_idx on permission_groups(org_id);

create table if not exists permission_group_members (
  group_id   uuid not null references permission_groups(id) on delete cascade,
  person_id  uuid not null references persons(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, person_id)
);
create index if not exists permission_group_members_person_idx on permission_group_members(person_id);
