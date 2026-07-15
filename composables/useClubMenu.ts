// The canonical left-menu registry, shared by layouts/default.vue (renders it)
// and Settings → People & Entities → Menu Items (configures which items each
// person type sees). Each item's `href` is its stable KEY. Keep this in sync
// with clubMenu in layouts/default.vue — the layout imports CLUB_MENU from here.
export interface ClubMenuChild { label: string; icon: string; href: string }
export interface ClubMenuItem {
  label: string
  icon: string
  href: string
  chevron?: boolean
  module?: string
  resource?: string
  // flyout sub-links (the items shown when this menu item is hovered)
  children?: ClubMenuChild[]
  // nav-flyout markers used by the layout
  people?: boolean
  groups?: boolean
  fees?: boolean
  events?: boolean
  bookings?: boolean
}

export const CLUB_MENU: ClubMenuItem[] = [
  { label: 'Dashboard',   icon: 'pi-th-large',      href: '/dashboard',               chevron: false },
  { label: 'People',      icon: 'pi-users',         href: '/people',                  chevron: true, people: true, resource: 'people', children: [
    { label: 'People', icon: 'pi-users', href: '/people?view=people' },
    { label: 'Admins', icon: 'pi-shield', href: '/people?view=admins' },
    { label: 'Organisations', icon: 'pi-building', href: '/people?view=organisations' },
  ] },
  { label: 'Classes',     icon: 'pi-sitemap',       href: '/groups',                  chevron: true, groups: true, module: 'groups', resource: 'groups' },
  { label: 'Fees',        icon: 'pi-dollar',        href: '/finances',                chevron: true, fees: true, module: 'finances', resource: 'fees', children: [
    { label: 'Finances', icon: 'pi-dollar', href: '/finances' },
    { label: 'Group fees', icon: 'pi-sitemap', href: '/groups/fees' },
  ] },
  { label: 'Memberships', icon: 'pi-id-card',       href: '/memberships',             chevron: true, module: 'finances', resource: 'fees' },
  { label: 'Events',      icon: 'pi-calendar',      href: '/events',                  chevron: true, events: true, module: 'events', resource: 'events', children: [
    { label: 'View Events', icon: 'pi-calendar', href: '/events' },
  ] },
  { label: 'Bookings',    icon: 'pi-bookmark',      href: '/bookables?tab=bookings',  chevron: true, bookings: true, module: 'bookings', resource: 'bookings', children: [
    { label: 'Bookings', icon: 'pi-bookmark', href: '/bookables?tab=bookings' },
    { label: 'Venues', icon: 'pi-building', href: '/bookables/venues' },
    { label: 'Persons', icon: 'pi-user', href: '/bookables/persons' },
    { label: 'Items', icon: 'pi-box', href: '/bookables/items' },
    { label: 'Activities', icon: 'pi-flag', href: '/bookables?tab=activities' },
  ] },
  { label: 'Programme',   icon: 'pi-flag',          href: '/programme',               chevron: true, module: 'programme', resource: 'programmes' },
  { label: 'Attendance',  icon: 'pi-check-square',  href: '/attendance',              chevron: true, module: 'attendance', resource: 'attendance' },
  { label: 'Reports',     icon: 'pi-chart-bar',     href: '/reports',                 chevron: false },
  { label: 'Mailer',      icon: 'pi-envelope',      href: '/settings/communications', chevron: true, module: 'communications', resource: 'communications' },
  { label: 'Resources',   icon: 'pi-video',         href: '/resources',               chevron: false, module: 'resources', resource: 'resources' },
  { label: 'Assets',      icon: 'pi-shopping-cart', href: '/assets',                  chevron: true, module: 'assets', resource: 'uniforms' },
  { label: 'Mobile App',  icon: 'pi-mobile',        href: '/mobile-app',              chevron: true, module: 'mobile_app' },
  { label: 'GNZ',         icon: 'pi-user',          href: '/gnz',                     chevron: true, module: 'gnz' },
]

// Every href a menu config can reference — top-level items + their flyout children.
export const CLUB_MENU_HREFS: string[] = CLUB_MENU.flatMap(i => [i.href, ...(i.children ?? []).map(c => c.href)])

export function useClubMenu() {
  // A type's configured menu = the CLUB_MENU items whose href is in `menuItems`.
  // NULL/undefined config = not configured (caller falls back to permissions).
  function menuForType(menuItems: string[] | null | undefined): ClubMenuItem[] | null {
    if (!Array.isArray(menuItems)) return null
    const set = new Set(menuItems)
    return CLUB_MENU.filter(i => set.has(i.href))
  }
  return { CLUB_MENU, CLUB_MENU_HREFS, menuForType }
}
