-- Scoped (per-resource) roles — a person can hold MULTIPLE roles on one
-- resource instance (e.g. coach + player + captain of the same group).
-- Mirrors the persons.person_types[] pattern (172): an array is the source of
-- truth; the singular `role` column is kept as the legacy/primary anchor
-- (= roles[0]) so older reads keep working.

-- Groups: member_group_memberships already has singular `role` (181); add array.
alter table member_group_memberships add column if not exists roles text[];
update member_group_memberships
  set roles = case when role is not null and role <> '' then array[role] else '{}'::text[] end
  where roles is null;
alter table member_group_memberships alter column roles set default '{}'::text[];

-- Events: invitees gets both (no prior role column).
alter table invitees add column if not exists roles text[];
alter table invitees add column if not exists role text;
update invitees set roles = '{}'::text[] where roles is null;
alter table invitees alter column roles set default '{}'::text[];
