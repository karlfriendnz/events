/**
 * Club setup — which parts (modules) of the system this club runs.
 *
 * The registry below is the single source of truth for what a "module" is.
 * A club's choice lives in organisations.enabled_modules (jsonb array of
 * enabled keys, migration 226). null = every module on (default for existing
 * clubs). `core` modules (Dashboard, People, Settings) can never be turned off.
 *
 * Consumers:
 *  - /settings/modules — the toggle screen
 *  - layouts/default.vue — filters the icon rail, mobile tab bar + More sheet
 */
export interface ModuleDef {
  key: string
  label: string
  icon: string          // pi-* icon, matches the nav
  description: string
  core?: boolean        // always on, not toggleable
}

export const MODULE_DEFS: ModuleDef[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'pi-th-large', core: true,
    description: 'The club home screen with stats, quick actions and widgets.' },
  { key: 'people', label: 'People', icon: 'pi-users', core: true,
    description: 'Your member directory and person profiles.' },
  { key: 'groups', label: 'Classes & groups', icon: 'pi-sitemap',
    description: 'Classes, squads and teams — timetables, terms, fees, waitlists and rollover.' },
  { key: 'events', label: 'Events', icon: 'pi-calendar',
    description: 'Events, sessions, registration forms and event reporting.' },
  { key: 'bookings', label: 'Bookings', icon: 'pi-bookmark',
    description: 'Venues, courts, items and coaches that members can book.' },
  { key: 'attendance', label: 'Attendance', icon: 'pi-check-square',
    description: 'Roll-taking for trainings and events.' },
  { key: 'finances', label: 'Fees & finances', icon: 'pi-dollar',
    description: 'Invoices, payments and financial reporting.' },
  { key: 'communications', label: 'Mailer', icon: 'pi-envelope',
    description: 'Email and message members and their contacts.' },
  { key: 'resources', label: 'Resources', icon: 'pi-video',
    description: 'Shared files, videos and documents for members.' },
  { key: 'assets', label: 'Assets', icon: 'pi-shopping-cart',
    description: 'Club equipment and asset tracking.' },
  { key: 'mobile_app', label: 'Mobile app', icon: 'pi-mobile',
    description: 'The member-facing mobile app.' },
  { key: 'programme', label: 'Programme', icon: 'pi-flag',
    description: 'Skills programmes and progress tracking.' },
  { key: 'gnz', label: 'GNZ', icon: 'pi-user',
    description: 'Governing-body affiliation tools.' },
  { key: 'fm_invoices', label: 'Invoices', icon: 'pi-file',
    description: 'Your FriendlyManager subscription invoices.' },
]

export const useOrgModules = () => {
  const api = useAdminApi()
  const { orgId } = useOrg()

  // null = not yet loaded OR club has no saved config (= everything on)
  const enabledKeys = useState<string[] | null>('org-modules', () => null)
  const loaded = useState<string | null>('org-modules-loaded-for', () => null)

  async function loadModules(force = false) {
    if (!orgId.value) return
    if (!force && loaded.value === orgId.value) return
    const keys = await api.orgModules(orgId.value)
    enabledKeys.value = Array.isArray(keys) ? keys : null
    loaded.value = orgId.value
  }

  /** Is a module on for this club? Unknown keys and core modules are always on. */
  function isEnabled(key?: string | null): boolean {
    if (!key) return true
    const def = MODULE_DEFS.find(d => d.key === key)
    if (!def || def.core) return true
    if (enabledKeys.value === null) return true   // no saved config = all on
    return enabledKeys.value.includes(key)
  }

  /** Persist the full set of enabled (non-core) keys. Pass null to reset to "all on". */
  async function saveModules(keys: string[] | null) {
    if (!orgId.value) return
    enabledKeys.value = keys
    await api.setOrgModules(orgId.value, keys)
  }

  return { MODULE_DEFS, enabledKeys, loadModules, isEnabled, saveModules }
}
