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
  // Admin
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

export type PermissionMap = Record<string, Partial<Record<PermAction, boolean>>>

/** Whether a permissions jsonb grants an action on a resource. */
export function permGrants(perms: PermissionMap | undefined, resource: string, action: PermAction): boolean {
  return !!perms?.[resource]?.[action]
}
