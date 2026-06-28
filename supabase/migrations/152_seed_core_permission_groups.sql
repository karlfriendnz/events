-- ============================================================
-- 152_seed_core_permission_groups.sql
-- Seed the default super-admin CORE permission templates (is_core=true,
-- org_id=null) so every club inherits the same starting role ladder as the
-- legacy FriendlyManager platform. Clubs override/reset these via
-- /settings/permissions; super-admin edits them at /admin/permissions.
--
-- Legacy role ladder (numeric): 0 none · 1 user · 2 basic · 3 manager ·
--   4 coord · 5 fadmin · 6 admin · (9 root = FM super-admin, not a club role).
-- User-facing names (People profile "role" dropdown): No Login / Standard User /
--   Roll Taker / Manager / Committee / Financial Admin / Club Admin.
-- We seed the 6 functional club roles (No Login = no group = no access; root =
-- super-admin, handled out-of-band).
--
-- Permission keys must match composables/usePermissions.ts PERMISSION_RESOURCES.
-- Grant shorthand used below:
--   full  = create+read+update+delete   crud = create+read+update (no delete)
--   read  = read only
-- Idempotent: only seeds when no core templates exist yet.
-- ============================================================

insert into permission_groups (org_id, is_core, name, description, permissions, sort_order)
select * from (values
  -- 1. Standard User (role 1) — a member with a login; views club content only.
  (
    null::uuid, true, 'Standard User',
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
    null::uuid, true, 'Roll Taker',
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
    null::uuid, true, 'Manager',
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
    null::uuid, true, 'Committee',
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
    null::uuid, true, 'Financial Admin',
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
    null::uuid, true, 'Club Admin',
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
  )
) as seed(org_id, is_core, name, description, permissions, sort_order)
where not exists (select 1 from permission_groups where is_core);
