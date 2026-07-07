// ACTIVE LOCATION — the club-wide location LENS (migration 237). A compact
// switcher in the top bar sets it; location-aware pages (Classes board,
// attendance, week view…) filter by it. null = "All locations".
//
// Mirrors useActiveOrg's persistence: sessionStorage per tab (two tabs can
// watch two sites), localStorage as the seed for fresh tabs — keyed PER ORG so
// switching clubs never leaks a stale location. Progressive disclosure: the
// switcher renders only when the club has 2+ locations.
import type { ClubLocation, LocationStaff } from '~/composables/useLocations'

export function useActiveLocation() {
  const { orgId } = useOrg()
  const loc = useLocations()

  const locations = useState<ClubLocation[]>('fm-locations', () => [])
  // The signed-in person's ACCESS GRANTS (mig 238): scope tuples
  // (location?, sport?) — null = all. Empty = unrestricted (never-lock-out);
  // super admins are never restricted.
  const myGrants = useState<LocationStaff[]>('fm-my-grants', () => [])
  // Whether the grant set actually RESTRICTS this user. Explicit grants always
  // do; derived class-staff scopes only restrict people with no org-wide
  // permission group (same rule as scoped roles — a Club Admin who also
  // coaches one class keeps the whole club).
  const grantsRestrict = useState<boolean>('fm-my-grants-restrict', () => false)
  const grantsLoaded = useState<string | null>('fm-my-grants-org', () => null)
  const loadedFor = useState<string | null>('fm-locations-org', () => null)
  const activeLocationId = useState<string | null>('fm-active-location', () => null)

  const key = () => `fm_active_location_${orgId.value}`

  async function ensureLocations(force = false) {
    if (!orgId.value) return
    if (!force && loadedFor.value === orgId.value) return
    loadedFor.value = orgId.value
    locations.value = await loc.loadLocations()
    // Restore this tab's lens (session first, then last-used), validated
    // against the current club's locations…
    let saved: string | null = null
    try { saved = sessionStorage.getItem(key()) || localStorage.getItem(key()) } catch { /* ignore */ }
    activeLocationId.value = saved && locations.value.some(l => l.id === saved) ? saved : null
    // …then grants get the last word (restricted users snap into an allowed lens).
    await loadMyGrants()
  }

  function setActiveLocation(id: string | null) {
    activeLocationId.value = id
    try {
      if (id) { sessionStorage.setItem(key(), id); localStorage.setItem(key(), id) }
      else { sessionStorage.removeItem(key()); localStorage.removeItem(key()) }
    } catch { /* ignore */ }
  }

  async function loadMyGrants() {
    if (grantsLoaded.value === orgId.value) return
    grantsLoaded.value = orgId.value
    myGrants.value = []
    grantsRestrict.value = false
    try {
      const db = useDb()
      const user = useSupabaseUser()
      let u = user.value
      if (!u) { const { data: { session } } = await db.auth.getSession(); u = session?.user ?? null }
      if (!u?.email) return
      if ((u as any).app_metadata?.role === 'super_admin') return   // supers unrestricted
      const { data: me } = await (db.from as any)('persons')
        .select('id').eq('org_id', orgId.value).ilike('email', u.email).maybeSingle()
      if (!me) return
      const { data: grants } = await (db.from as any)('location_staff')
        .select('id, location_id, sport_id, person_id, role_key')
        .eq('org_id', orgId.value).eq('person_id', me.id)
      const explicit = (grants ?? []) as LocationStaff[]
      // DERIVED scopes: being STAFF ON A CLASS automatically carries access to
      // that class's (location, sport) — no explicit grant needed. The grants
      // page is only for access BEYOND your classes (location managers etc.).
      const derived: LocationStaff[] = []
      try {
        const scoped = useScopedRoles()
        const gc = useGroupCodes()
        const [{ data: mships }, codes] = await Promise.all([
          (db.from as any)('member_group_memberships')
            .select('roles, role, group:member_groups!inner(org_id, location_id, code_id)')
            .eq('person_id', me.id).eq('group.org_id', orgId.value),
          gc.loadCodes(),
        ])
        const codesById: Record<string, any> = Object.fromEntries((codes ?? []).map((c: any) => [c.id, c]))
        for (const m of (mships ?? [])) {
          const roles = ((m.roles?.length ? m.roles : [m.role]) as string[]).filter(Boolean)
          if (!roles.length || !scoped.isStaff('group', roles)) continue
          const locId = m.group?.location_id
          if (!locId) continue
          derived.push({
            id: `derived-${locId}-${m.group?.code_id ?? ''}`,
            location_id: locId,
            sport_id: gc.effectiveSportId({ code_id: m.group?.code_id }, codesById),
            person_id: me.id,
            role_key: 'class_staff',
          })
        }
      } catch { /* derivation is additive — never blocks */ }
      myGrants.value = [...explicit, ...derived]
      let inPermGroup = false
      try {
        const { count } = await (db.from as any)('permission_group_members')
          .select('id', { count: 'exact', head: true }).eq('person_id', me.id)
        inPermGroup = (count ?? 0) > 0
      } catch { /* fail open */ }
      grantsRestrict.value = explicit.length > 0 || (derived.length > 0 && !inPermGroup)
      // Restricted users can't sit on a lens they don't hold: snap to their first location.
      if (restricted.value && activeLocationId.value && !allowedLocationIds.value.includes(activeLocationId.value)) {
        setActiveLocation(allowedLocationIds.value[0] ?? null)
      }
      if (restricted.value && !activeLocationId.value && !hasAllLocationsGrant.value) {
        setActiveLocation(allowedLocationIds.value[0] ?? null)
      }
    } catch { /* fail open */ }
  }

  const restricted = computed(() => grantsRestrict.value && myGrants.value.length > 0)
  const hasAllLocationsGrant = computed(() => myGrants.value.some(g => g.location_id == null))
  const allowedLocationIds = computed(() => {
    if (!restricted.value || hasAllLocationsGrant.value) return locations.value.map(l => l.id)
    return [...new Set(myGrants.value.filter(g => g.location_id).map(g => g.location_id as string))]
  })
  /** Does the signed-in person's grant set cover (location, sport)? */
  function canAccess(locationId: string | null, sportId: string | null): boolean {
    if (!restricted.value) return true
    return myGrants.value.some(g =>
      (g.location_id == null || g.location_id === locationId) &&
      (g.sport_id == null || g.sport_id === sportId))
  }

  const activeLocation = computed(() => locations.value.find(l => l.id === activeLocationId.value) ?? null)
  const multiSite = computed(() => locations.value.length > 1)

  /** Filter helper: does this row (with a location_id) pass the current lens? */
  function inActiveLocation(locationId: string | null | undefined): boolean {
    if (!activeLocationId.value) return true
    return locationId === activeLocationId.value
  }

  return { locations, activeLocationId, activeLocation, multiSite, ensureLocations, setActiveLocation, inActiveLocation, myGrants, restricted, hasAllLocationsGrant, allowedLocationIds, canAccess }
}
