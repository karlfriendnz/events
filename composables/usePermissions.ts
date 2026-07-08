// Permission registry + helpers (RBAC foundation).
//
// PERMISSION_RESOURCES is the single source of truth for the "functions" the
// permission grid can grant. **Extend this list as we build features** — the
// grid renders whatever is here, and group grants are stored as jsonb keyed by
// resource key, so adding a resource just makes it appear (defaulting to off).

export type PermAction = 'create' | 'read' | 'update' | 'delete'
export const PERM_ACTIONS: { key: PermAction; short: string; label: string }[] = [
  { key: 'create', short: 'C', label: 'Create' },
  { key: 'read', short: 'V', label: 'View' },
  { key: 'update', short: 'E', label: 'Edit' },
  { key: 'delete', short: 'D', label: 'Delete' },
]

export interface PermResource {
  key: string
  label: string
  area: string
  /** Plain-English note on what access to this function grants. */
  description?: string
  actions?: PermAction[] // defaults to all four
}

export const PERMISSION_RESOURCES: PermResource[] = [
  // Members
  { key: 'people', label: 'People / Members', area: 'Members', description: 'View and manage member, staff and contact records and their profiles.' },
  { key: 'groups', label: 'Squads / Groups', area: 'Members', description: 'Create squads/groups, set their codes and limits, and manage who belongs to them.' },
  { key: 'terms', label: 'Terms', area: 'Members', description: 'Define registration terms and their signup/priority windows.' },
  { key: 'attendance', label: 'Attendance', area: 'Members', description: 'Take and edit attendance rolls for training sessions and events.' },
  // Activities
  { key: 'events', label: 'Events', area: 'Activities', description: 'Create and run events — sessions, registration forms, tickets and invitees.' },
  { key: 'bookings', label: 'Bookings', area: 'Activities', description: 'Make and manage venue, court and equipment bookings.' },
  { key: 'activities', label: 'Activities', area: 'Activities', description: 'Configure bookable activities and their modes, pricing and availability.' },
  { key: 'competitions', label: 'Competitions', area: 'Activities', description: 'Run competitions — draws, divisions, games, officials and results.' },
  { key: 'programmes', label: 'Programmes', area: 'Activities', description: 'Manage holiday programmes and their bookings and discounts.' },
  // Finance
  { key: 'fees', label: 'Fees / Invoices', area: 'Finance', description: 'Raise and manage invoices, fees and credit notes.' },
  { key: 'transactions', label: 'Payments / Transactions', area: 'Finance', description: 'Record, reconcile and refund payments.' },
  { key: 'discounts', label: 'Discounts / Vouchers', area: 'Finance', description: 'Create and manage discount codes and vouchers.' },
  // Content
  { key: 'awards', label: 'Awards', area: 'Content', description: 'Define awards/badges and assign them to members.' },
  { key: 'resources', label: 'Resources', area: 'Content', description: 'Manage the document/resource library shared with members.' },
  { key: 'uniforms', label: 'Uniforms / Assets', area: 'Content', description: 'Manage uniform and asset inventory, stock and issue/return.' },
  { key: 'communications', label: 'Communications / Mailer', area: 'Content', description: 'Send bulk emails and manage communication topics and history.' },
  { key: 'notes', label: 'Notes', area: 'Content', description: 'Create, edit and delete notes on people across rosters, attendance and profiles.' },
  // Admin
  { key: 'locations', label: 'Locations', area: 'Admin', description: 'Manage the club\u2019s locations \u2014 add sites and assign staff access to them.' },
  { key: 'organisations', label: 'Organisations', area: 'Admin', description: 'Manage organisation details and the org hierarchy/affiliations.' },
  { key: 'settings', label: 'Settings', area: 'Admin', description: 'Change club settings, branding, terminology and season.' },
  { key: 'permissions', label: 'Permission Groups', area: 'Admin', description: 'Manage permission groups and assign members to them.' },
  { key: 'custom_fields', label: 'Custom Fields', area: 'Admin', description: 'Define custom fields captured on members and registration forms.' },
  { key: 'integrations', label: 'Integrations', area: 'Admin', description: 'Connect and configure third-party integrations such as Xero.' },
]

export const PERMISSION_AREAS = [...new Set(PERMISSION_RESOURCES.map(r => r.area))]

export function resourceActions(r: PermResource): PermAction[] {
  return r.actions ?? ['create', 'read', 'update', 'delete']
}

// ── EXPLICIT PERMISSIONS ─────────────────────────────────────────────────────
// The permission grid is a curated CHECKLIST of specific, named capabilities —
// not a generic CRUD matrix. Each item toggles one or more underlying
// (resource, action) grants, so `can(resource, action)` and the permission-driven
// menu keep working unchanged. The primary "View {section}" item grants the
// resource's `read` (that's what shows the section in the left menu + gates the
// route). Add lines freely — a new item just appears in the grid, off by default.
export interface PermGrant { resource: string; action: string }
export interface PermItem {
  key: string
  label: string
  area: string
  grants: PermGrant[]
  description?: string
}

export const PERMISSION_ITEMS: PermItem[] = [
  // People & Members
  { key: 'members_view',        label: 'View members',                  area: 'People', grants: [{ resource: 'people', action: 'read' }] },
  { key: 'members_contacts',    label: 'View contact details',          area: 'People', grants: [{ resource: 'people', action: 'view_contacts' }] },
  { key: 'members_sensitive',   label: 'View medical & sensitive info', area: 'People', grants: [{ resource: 'people', action: 'view_sensitive' }] },
  { key: 'members_financials',  label: 'View member financials',        area: 'People', grants: [{ resource: 'people', action: 'view_financials' }] },
  { key: 'members_add',         label: 'Add members',                   area: 'People', grants: [{ resource: 'people', action: 'create' }] },
  { key: 'members_edit',        label: 'Edit member details',           area: 'People', grants: [{ resource: 'people', action: 'update' }] },
  { key: 'members_delete',      label: 'Delete members',                area: 'People', grants: [{ resource: 'people', action: 'delete' }] },
  { key: 'members_merge',       label: 'Merge duplicate members',       area: 'People', grants: [{ resource: 'people', action: 'merge' }] },
  { key: 'members_export',      label: 'Export members',                area: 'People', grants: [{ resource: 'people', action: 'export' }] },
  { key: 'members_import',      label: 'Import members',                area: 'People', grants: [{ resource: 'people', action: 'import' }] },
  { key: 'members_invite',      label: 'Send a login invite',           area: 'People', grants: [{ resource: 'people', action: 'invite' }] },
  { key: 'members_notes',       label: 'Manage member notes',           area: 'People', grants: [{ resource: 'notes', action: 'update' }] },
  { key: 'members_contacts_mng',label: 'Manage families & contacts',    area: 'People', grants: [{ resource: 'people', action: 'manage_contacts' }] },

  // Classes / Groups
  { key: 'classes_view',        label: 'View classes',                  area: 'Classes', grants: [{ resource: 'groups', action: 'read' }] },
  { key: 'classes_create',      label: 'Create classes',                area: 'Classes', grants: [{ resource: 'groups', action: 'create' }] },
  { key: 'classes_edit',        label: 'Edit class details',            area: 'Classes', grants: [{ resource: 'groups', action: 'update' }] },
  { key: 'classes_delete',      label: 'Delete classes',                area: 'Classes', grants: [{ resource: 'groups', action: 'delete' }] },
  { key: 'classes_members',     label: 'Add & remove members',          area: 'Classes', grants: [{ resource: 'groups', action: 'manage_members' }] },
  { key: 'classes_sessions',    label: 'Manage session / training times',area: 'Classes', grants: [{ resource: 'groups', action: 'manage_schedule' }] },
  { key: 'attendance_take',     label: 'Take attendance',               area: 'Classes', grants: [{ resource: 'attendance', action: 'update' }] },
  { key: 'attendance_edit',     label: 'Edit past attendance',          area: 'Classes', grants: [{ resource: 'attendance', action: 'edit_past' }] },
  { key: 'waitlists_manage',    label: 'Manage waitlists',              area: 'Classes', grants: [{ resource: 'groups', action: 'manage_waitlists' }] },
  { key: 'teams_allocate',      label: 'Allocate teams & sub-groups',   area: 'Classes', grants: [{ resource: 'groups', action: 'allocate' }] },
  { key: 'classes_fees',        label: 'Manage class fees',             area: 'Classes', grants: [{ resource: 'groups', action: 'manage_fees' }] },
  { key: 'terms_rollover',      label: 'Roll over a term',              area: 'Classes', grants: [{ resource: 'groups', action: 'rollover' }] },
  { key: 'codes_manage',        label: 'Manage codes / programmes',     area: 'Classes', grants: [{ resource: 'groups', action: 'manage_codes' }] },

  // Terms & Memberships
  { key: 'terms_manage',        label: 'Manage terms & seasons',        area: 'Terms & Memberships', grants: [{ resource: 'terms', action: 'update' }] },
  { key: 'memberships_manage',  label: 'Manage memberships',            area: 'Terms & Memberships', grants: [{ resource: 'fees', action: 'manage_memberships' }] },
  { key: 'membership_plans',    label: 'Manage membership plans',       area: 'Terms & Memberships', grants: [{ resource: 'fees', action: 'manage_plans' }] },

  // Events
  { key: 'events_view',         label: 'View events',                   area: 'Events', grants: [{ resource: 'events', action: 'read' }] },
  { key: 'events_create',       label: 'Create events',                 area: 'Events', grants: [{ resource: 'events', action: 'create' }] },
  { key: 'events_edit',         label: 'Edit events',                   area: 'Events', grants: [{ resource: 'events', action: 'update' }] },
  { key: 'events_delete',       label: 'Delete events',                 area: 'Events', grants: [{ resource: 'events', action: 'delete' }] },
  { key: 'events_invitees',     label: 'Manage invitees',               area: 'Events', grants: [{ resource: 'events', action: 'manage_invitees' }] },
  { key: 'events_forms',        label: 'Manage registration forms',     area: 'Events', grants: [{ resource: 'events', action: 'manage_forms' }] },
  { key: 'events_checkin',      label: 'Check-in attendees',            area: 'Events', grants: [{ resource: 'events', action: 'checkin' }] },
  { key: 'events_tickets',      label: 'Manage tickets',                area: 'Events', grants: [{ resource: 'events', action: 'manage_tickets' }] },
  { key: 'events_discounts',    label: 'Manage event discounts',        area: 'Events', grants: [{ resource: 'events', action: 'manage_discounts' }] },
  { key: 'events_reports',      label: 'View event reports',            area: 'Events', grants: [{ resource: 'events', action: 'reports' }] },
  { key: 'events_comms',        label: 'Send event communications',     area: 'Events', grants: [{ resource: 'events', action: 'communicate' }] },

  // Bookings & Venues
  { key: 'bookings_view',       label: 'View bookings',                 area: 'Bookings & Venues', grants: [{ resource: 'bookings', action: 'read' }] },
  { key: 'bookings_make',       label: 'Make bookings',                 area: 'Bookings & Venues', grants: [{ resource: 'bookings', action: 'create' }] },
  { key: 'bookings_approve',    label: 'Approve / decline bookings',    area: 'Bookings & Venues', grants: [{ resource: 'bookings', action: 'approve' }] },
  { key: 'bookings_cancel',     label: 'Cancel bookings',               area: 'Bookings & Venues', grants: [{ resource: 'bookings', action: 'cancel' }] },
  { key: 'venues_manage',       label: 'Manage venues',                 area: 'Bookings & Venues', grants: [{ resource: 'activities', action: 'manage_venues' }] },
  { key: 'activities_manage',   label: 'Manage activities & modes',     area: 'Bookings & Venues', grants: [{ resource: 'activities', action: 'update' }] },
  { key: 'availability_manage', label: 'Manage availability',           area: 'Bookings & Venues', grants: [{ resource: 'activities', action: 'manage_availability' }] },
  { key: 'access_manage',       label: 'Manage access control (doors / lights)', area: 'Bookings & Venues', grants: [{ resource: 'activities', action: 'manage_access' }] },

  // Finance
  { key: 'invoices_view',       label: 'View invoices',                 area: 'Finance', grants: [{ resource: 'fees', action: 'read' }] },
  { key: 'invoices_raise',      label: 'Raise invoices',                area: 'Finance', grants: [{ resource: 'fees', action: 'create' }] },
  { key: 'invoices_edit',       label: 'Edit / void invoices',          area: 'Finance', grants: [{ resource: 'fees', action: 'update' }] },
  { key: 'payments_record',     label: 'Record payments',               area: 'Finance', grants: [{ resource: 'transactions', action: 'create' }] },
  { key: 'payments_refund',     label: 'Issue refunds',                 area: 'Finance', grants: [{ resource: 'transactions', action: 'refund' }] },
  { key: 'fees_manage',         label: 'Manage fees',                   area: 'Finance', grants: [{ resource: 'fees', action: 'manage' }] },
  { key: 'discounts_manage',    label: 'Manage discounts / vouchers',   area: 'Finance', grants: [{ resource: 'discounts', action: 'update' }] },
  { key: 'finance_reports',     label: 'View financial reports',        area: 'Finance', grants: [{ resource: 'fees', action: 'reports' }] },
  { key: 'xero_sync',           label: 'Connect & sync Xero',           area: 'Finance', grants: [{ resource: 'integrations', action: 'xero' }] },

  // Communications
  { key: 'comms_send',          label: 'Send bulk email / SMS',         area: 'Communications', grants: [{ resource: 'communications', action: 'create' }] },
  { key: 'comms_templates',     label: 'Manage templates',              area: 'Communications', grants: [{ resource: 'communications', action: 'manage_templates' }] },
  { key: 'comms_topics',        label: 'Manage communication topics',   area: 'Communications', grants: [{ resource: 'communications', action: 'manage_topics' }] },
  { key: 'comms_history',       label: 'View communication history',    area: 'Communications', grants: [{ resource: 'communications', action: 'read' }] },

  // Content & Assets
  { key: 'resources_manage',    label: 'Manage resources library',      area: 'Content & Assets', grants: [{ resource: 'resources', action: 'update' }] },
  { key: 'awards_manage',       label: 'Manage awards / badges',        area: 'Content & Assets', grants: [{ resource: 'awards', action: 'update' }] },
  { key: 'assets_manage',       label: 'Manage uniforms / assets',      area: 'Content & Assets', grants: [{ resource: 'uniforms', action: 'update' }] },
  { key: 'assets_issue',        label: 'Issue / return assets',         area: 'Content & Assets', grants: [{ resource: 'uniforms', action: 'issue' }] },

  // Reporting
  { key: 'reports_view',        label: 'View reports',                  area: 'Reporting', grants: [{ resource: 'reports', action: 'read' }] },
  { key: 'reports_build',       label: 'Build custom reports',          area: 'Reporting', grants: [{ resource: 'reports', action: 'build' }] },
  { key: 'reports_export',      label: 'Export reports',                area: 'Reporting', grants: [{ resource: 'reports', action: 'export' }] },

  // Admin & Settings
  { key: 'settings_manage',     label: 'Manage club settings & branding',area: 'Admin & Settings', grants: [{ resource: 'settings', action: 'update' }] },
  { key: 'terminology_manage',  label: 'Manage terminology',            area: 'Admin & Settings', grants: [{ resource: 'settings', action: 'manage_terminology' }] },
  { key: 'locations_manage',    label: 'Manage locations',              area: 'Admin & Settings', grants: [{ resource: 'locations', action: 'update' }] },
  { key: 'permissions_manage',  label: 'Manage permissions & roles',    area: 'Admin & Settings', grants: [{ resource: 'permissions', action: 'update' }] },
  { key: 'integrations_manage', label: 'Manage integrations',           area: 'Admin & Settings', grants: [{ resource: 'integrations', action: 'update' }] },
  { key: 'org_manage',          label: 'Manage organisation & affiliations', area: 'Admin & Settings', grants: [{ resource: 'organisations', action: 'update' }] },
  { key: 'fields_manage',       label: 'Manage custom fields',          area: 'Admin & Settings', grants: [{ resource: 'custom_fields', action: 'update' }] },
]

export const PERM_ITEM_AREAS = [...new Set(PERMISSION_ITEMS.map(i => i.area))]

// Is an explicit permission fully granted in this map? (all its grants present)
export function permItemOn(map: any, item: PermItem): boolean {
  return item.grants.every(g => !!map?.[g.resource]?.[g.action])
}
// Toggle an explicit permission on/off (sets every underlying grant).
export function setPermItem(map: any, item: PermItem, on: boolean): any {
  const p = JSON.parse(JSON.stringify(map || {}))
  for (const g of item.grants) { p[g.resource] = { ...(p[g.resource] || {}), [g.action]: on } }
  return p
}

export type PermissionMap = Record<string, Partial<Record<PermAction, boolean>>>

/** Whether a permissions jsonb grants an action on a resource. */
export function permGrants(perms: PermissionMap | undefined, resource: string, action: PermAction): boolean {
  return !!perms?.[resource]?.[action]
}
