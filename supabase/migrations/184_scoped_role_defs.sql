-- Configurable catalogue for scoped (per-resource) ROLE DEFINITIONS.
-- Until now the vocabulary of roles a person can hold ON a group/event (Coach,
-- Manager, Member, Captain…) lived ONLY as a hard-coded code registry
-- (composables/useScopedRoles.ts SCOPED_ROLES). This lifts it into a per-org,
-- editable catalogue so a club can define a role once (e.g. "Manager") and have
-- it assignable across ALL groups (or ALL events) — configured at the COMPONENT
-- level, not per group/event instance.
--
-- The code registry stays the DEFAULT/fallback: when an org has no rows for a
-- resource_type the composable uses the built-in defaults, and the settings page
-- seeds those defaults into this table on first edit.

create table if not exists scoped_role_defs (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null,
  resource_type text not null check (resource_type in ('group', 'event')),
  key           text not null,                         -- stable slug stored in roles[]
  label         text not null,                         -- display name (rename-safe; key stays put)
  role_group    text not null default 'member' check (role_group in ('member', 'staff')),
  capabilities  text[] not null default '{}'::text[],  -- subset of view/manage/take_attendance
  field_type    text,                                  -- person_target_types.key driving this role's fields
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  unique (org_id, resource_type, key)
);

create index if not exists scoped_role_defs_org_idx
  on scoped_role_defs (org_id, resource_type, sort_order);
