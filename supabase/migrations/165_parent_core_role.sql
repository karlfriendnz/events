-- ============================================================
-- 165_parent_core_role.sql
-- Adds "Parent" as a default super-admin CORE permission group (user type), so
-- every club inherits it alongside Standard User / Roll Taker / Manager /
-- Committee / Financial Admin / Club Admin (migration 154). A parent/guardian
-- login — read-only club content for their family. Keys match
-- composables/usePermissions.ts PERMISSION_RESOURCES. Idempotent.
-- ============================================================

insert into permission_groups (org_id, is_core, name, description, permissions, sort_order)
select null, true, 'Parent',
  'Parent/guardian login. Read-only access to club events, programmes, resources and awards for their family.',
  jsonb_build_object(
    'events',     jsonb_build_object('read', true),
    'programmes', jsonb_build_object('read', true),
    'resources',  jsonb_build_object('read', true),
    'awards',     jsonb_build_object('read', true)
  ),
  7
where not exists (select 1 from permission_groups where is_core and name = 'Parent');
