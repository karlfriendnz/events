-- ============================================================
-- 154_replace_core_permission_groups.sql
-- Replace the existing hand-made core templates (Club Administrator / Coach /
-- Treasurer / Member, created via the /admin/permissions UI) with the legacy
-- FriendlyManager role ladder. Migration 152's seed was guarded by
-- `where not exists (... is_core)` and so no-op'd against those pre-existing
-- rows — this migration force-replaces them.
--
-- Club-level groups were already cleared in migration 153, so deleting the old
-- cores breaks no override links. Delete-then-insert keeps this idempotent:
-- re-running yields the same 6 rows.
--
-- Legacy ladder (numeric): 1 user · 2 basic · 3 manager · 4 coord · 5 fadmin ·
--   6 admin. (No Login=no group; root=super-admin — not seeded.)
-- Resource keys match composables/usePermissions.ts PERMISSION_RESOURCES.
-- ============================================================

delete from permission_groups where is_core;

insert into permission_groups (org_id, is_core, name, description, permissions, sort_order) values
  -- 1. Standard User (role 1) — a member with a login; views club content only.
  (
    null, true, 'Standard User',
    'Logged-in member. Read-only access to club events, programmes, resources and awards.',
    jsonb_build_object(
      'events',     jsonb_build_object('read', true),
      'programmes', jsonb_build_object('read', true),
      'resources',  jsonb_build_object('read', true),
      'awards',     jsonb_build_object('read', true)
    ),
    1
  ),

  -- 2. Roll Taker (role 2 "basic") — takes attendance for squads/sessions.
  (
    null, true, 'Roll Taker',
    'Takes attendance. Read access to people, squads and events; full attendance roll control.',
    jsonb_build_object(
      'people',     jsonb_build_object('read', true),
      'groups',     jsonb_build_object('read', true),
      'attendance', jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'events',     jsonb_build_object('read', true),
      'resources',  jsonb_build_object('read', true),
      'awards',     jsonb_build_object('read', true)
    ),
    2
  ),

  -- 3. Manager (role 3) — runs day-to-day operations. No finance, no admin.
  (
    null, true, 'Manager',
    'Day-to-day operations: members, squads, terms, events, bookings, attendance, awards, resources and comms. No finance or club settings.',
    jsonb_build_object(
      'people',         jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'groups',         jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'terms',          jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'attendance',     jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'events',         jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'bookings',       jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'activities',     jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'competitions',   jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'programmes',     jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'awards',         jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'resources',      jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'uniforms',       jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'communications', jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true)
    ),
    3
  ),

  -- 4. Committee (role 4 "coord") — Manager scope + finance visibility + settings read.
  (
    null, true, 'Committee',
    'Manager scope plus read access to finance and club settings. Sees fees, transactions and discounts without editing them.',
    jsonb_build_object(
      'people',         jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'groups',         jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'terms',          jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'attendance',     jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'events',         jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'bookings',       jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'activities',     jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'competitions',   jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'programmes',     jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'awards',         jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'resources',      jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'uniforms',       jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'communications', jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'fees',           jsonb_build_object('read', true),
      'transactions',   jsonb_build_object('read', true),
      'discounts',      jsonb_build_object('read', true),
      'settings',       jsonb_build_object('read', true),
      'custom_fields',  jsonb_build_object('read', true)
    ),
    4
  ),

  -- 5. Financial Admin (role 5 "fadmin") — owns the billing/finance side.
  (
    null, true, 'Financial Admin',
    'Owns finance: fees, invoices, payments, discounts and accounting integrations (Xero). Read access to members and squads.',
    jsonb_build_object(
      'fees',           jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'transactions',   jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'discounts',      jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'integrations',   jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'people',         jsonb_build_object('read', true),
      'groups',         jsonb_build_object('read', true),
      'terms',          jsonb_build_object('read', true),
      'events',         jsonb_build_object('read', true),
      'programmes',     jsonb_build_object('read', true),
      'uniforms',       jsonb_build_object('read', true),
      'communications', jsonb_build_object('read', true),
      'settings',       jsonb_build_object('read', true)
    ),
    5
  ),

  -- 6. Club Admin (role 6 "admin") — full control of everything within the club.
  (
    null, true, 'Club Admin',
    'Full control of the club: every module plus settings, permissions, custom fields, integrations and organisation details.',
    jsonb_build_object(
      'people',         jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'groups',         jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'terms',          jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'attendance',     jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'events',         jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'bookings',       jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'activities',     jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'competitions',   jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'programmes',     jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'fees',           jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'transactions',   jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'discounts',      jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'awards',         jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'resources',      jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'uniforms',       jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'communications', jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'organisations',  jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'settings',       jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'permissions',    jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'custom_fields',  jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'integrations',   jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true)
    ),
    6
  );
