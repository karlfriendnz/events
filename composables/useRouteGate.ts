// Route → permission gating (the "read gates").
//
// MODEL
//   Two layers of enforcement sit on top of the permission grid (usePermissions
//   + useCan):
//     1. ROUTE READ-GATES (this file + middleware/permissions.global.ts):
//        visiting a page whose area maps to a PERMISSION_RESOURCES key requires
//        can(resource, 'read'). A route NOT in ROUTE_RESOURCES is UNGATED.
//     2. ACTION GATES (<Can resource action>): wrap a Create/Edit/Delete control
//        so it only renders when the user can(resource, action). Building block
//        for the per-page button sweep (a follow-up — this pass only ships the
//        route gates + the <Can> primitive, it does not yet wrap buttons).
//
//   Both resolve through the SAME useCan() logic, so supers bypass everything and
//   the never-lock-out fallback (no access-type + no legacy group -> unrestricted)
//   is preserved. Everything fails OPEN — a resolution error or unloaded state
//   never blocks navigation.
//
//   Matching is on route.path prefixes at SEGMENT boundaries (path === prefix or
//   path.startsWith(prefix + '/')), so '/bookings' never swallows '/booking' and
//   vice-versa. List more specific prefixes first; the first match wins.
//
//   Every `resource` below is a verbatim key from PERMISSION_RESOURCES. Areas with
//   no clean key match (e.g. /organisations entity records, /disciplines, /gnz,
//   /mobile-app) are intentionally left UNGATED rather than mapped to an
//   ill-fitting key.

import type { PermAction } from './usePermissions'

export interface RouteResource {
  /** Route path prefix, matched at a segment boundary. */
  prefix: string
  /** A verbatim PERMISSION_RESOURCES key. */
  resource: string
}

export const ROUTE_RESOURCES: RouteResource[] = [
  // Members
  { prefix: '/people', resource: 'people' },
  { prefix: '/groups', resource: 'groups' },
  { prefix: '/attendance', resource: 'attendance' },
  // Activities
  { prefix: '/events', resource: 'events' },
  { prefix: '/registration', resource: 'events' }, // event/group registration management
  { prefix: '/activities', resource: 'activities' },
  { prefix: '/bookables', resource: 'activities' }, // configuring venues/activities
  { prefix: '/bookings', resource: 'bookings' },
  { prefix: '/programme', resource: 'programmes' },
  // Finance / reporting
  { prefix: '/finances', resource: 'fees' },
  { prefix: '/fm-invoices', resource: 'fees' },
  { prefix: '/reporting', resource: 'fees' }, // no 'reporting' key — gate as finance-read
  // Content
  { prefix: '/communications', resource: 'communications' },
  { prefix: '/resources', resource: 'resources' },
  { prefix: '/assets', resource: 'uniforms' },
  { prefix: '/forms', resource: 'custom_fields' }, // registration form library
  // Admin
  { prefix: '/settings/field-catalogue', resource: 'custom_fields' },
  { prefix: '/settings/locations', resource: 'locations' },
  { prefix: '/settings/integrations', resource: 'integrations' },
  { prefix: '/settings/xero', resource: 'integrations' },
  { prefix: '/settings', resource: 'settings' },
]

// Never gated — every user can reach these regardless of grid.
export const UNGATED_PREFIXES = ['/dashboard', '/help', '/account', '/admin', '/switch-role', '/onboarding']

// Public / guest-accessible (embed layout) — mirrors auth.global.ts's allow-list.
export const PUBLIC_PREFIXES = ['/book', '/booking', '/r/', '/login']

export function isUngatedPath(path: string): boolean {
  return UNGATED_PREFIXES.some(p => path === p || path.startsWith(p + '/'))
}

export function isPublicPath(path: string): boolean {
  // '/r/' carries a trailing slash on purpose; the rest match at a boundary.
  return path.startsWith('/r/') ||
    PUBLIC_PREFIXES.some(p => p !== '/r/' && (path === p || path.startsWith(p + '/')))
}

/** The PERMISSION_RESOURCES key gating a path, or null when the route is ungated. */
export function routeResourceForPath(path: string): string | null {
  if (isPublicPath(path) || isUngatedPath(path)) return null
  for (const { prefix, resource } of ROUTE_RESOURCES) {
    if (path === prefix || path.startsWith(prefix + '/')) return resource
  }
  return null
}

/** Convenience so callers don't hardcode 'read'. */
export const ROUTE_GATE_ACTION: PermAction = 'read'
