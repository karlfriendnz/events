// Permission registry + helpers (RBAC foundation).
//
// PERMISSION_RESOURCES is the single source of truth for the "functions" the
// permission grid can grant. **Extend this list as we build features** — the
// grid renders whatever is here, and group grants are stored as jsonb keyed by
// resource key, so adding a resource just makes it appear (defaulting to off).

export type PermAction = 'create' | 'read' | 'update' | 'delete'
export const PERM_ACTIONS: { key: PermAction; short: string; label: string }[] = [
  { key: 'create', short: 'C', label: 'Create' },
  { key: 'read', short: 'R', label: 'Read' },
  { key: 'update', short: 'U', label: 'Update' },
  { key: 'delete', short: 'D', label: 'Delete' },
]

export interface PermResource {
  key: string
  label: string
  area: string
  actions?: PermAction[] // defaults to all four
}

export const PERMISSION_RESOURCES: PermResource[] = [
  // Members
  { key: 'people', label: 'People / Members', area: 'Members' },
  { key: 'groups', label: 'Squads / Groups', area: 'Members' },
  { key: 'terms', label: 'Terms', area: 'Members' },
  { key: 'attendance', label: 'Attendance', area: 'Members' },
  // Activities
  { key: 'events', label: 'Events', area: 'Activities' },
  { key: 'bookings', label: 'Bookings', area: 'Activities' },
  { key: 'activities', label: 'Activities', area: 'Activities' },
  { key: 'competitions', label: 'Competitions', area: 'Activities' },
  { key: 'programmes', label: 'Programmes', area: 'Activities' },
  // Finance
  { key: 'fees', label: 'Fees / Invoices', area: 'Finance' },
  { key: 'transactions', label: 'Payments / Transactions', area: 'Finance' },
  { key: 'discounts', label: 'Discounts / Vouchers', area: 'Finance' },
  // Content
  { key: 'awards', label: 'Awards', area: 'Content' },
  { key: 'resources', label: 'Resources', area: 'Content' },
  { key: 'uniforms', label: 'Uniforms / Assets', area: 'Content' },
  { key: 'communications', label: 'Communications / Mailer', area: 'Content' },
  // Admin
  { key: 'organisations', label: 'Organisations', area: 'Admin' },
  { key: 'settings', label: 'Settings', area: 'Admin' },
  { key: 'permissions', label: 'Permission Groups', area: 'Admin' },
  { key: 'custom_fields', label: 'Custom Fields', area: 'Admin' },
  { key: 'integrations', label: 'Integrations', area: 'Admin' },
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
