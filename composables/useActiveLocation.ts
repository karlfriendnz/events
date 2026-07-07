// ACTIVE LOCATION — the club-wide location LENS (migration 237). A compact
// switcher in the top bar sets it; location-aware pages (Classes board,
// attendance, week view…) filter by it. null = "All locations".
//
// Mirrors useActiveOrg's persistence: sessionStorage per tab (two tabs can
// watch two sites), localStorage as the seed for fresh tabs — keyed PER ORG so
// switching clubs never leaks a stale location. Progressive disclosure: the
// switcher renders only when the club has 2+ locations.
import type { ClubLocation } from '~/composables/useLocations'

export function useActiveLocation() {
  const { orgId } = useOrg()
  const loc = useLocations()

  const locations = useState<ClubLocation[]>('fm-locations', () => [])
  const loadedFor = useState<string | null>('fm-locations-org', () => null)
  const activeLocationId = useState<string | null>('fm-active-location', () => null)

  const key = () => `fm_active_location_${orgId.value}`

  async function ensureLocations(force = false) {
    if (!orgId.value) return
    if (!force && loadedFor.value === orgId.value) return
    loadedFor.value = orgId.value
    locations.value = await loc.loadLocations()
    // Restore this tab's lens (session first, then last-used), validated
    // against the current club's locations.
    let saved: string | null = null
    try { saved = sessionStorage.getItem(key()) || localStorage.getItem(key()) } catch { /* ignore */ }
    activeLocationId.value = saved && locations.value.some(l => l.id === saved) ? saved : null
  }

  function setActiveLocation(id: string | null) {
    activeLocationId.value = id
    try {
      if (id) { sessionStorage.setItem(key(), id); localStorage.setItem(key(), id) }
      else { sessionStorage.removeItem(key()); localStorage.removeItem(key()) }
    } catch { /* ignore */ }
  }

  const activeLocation = computed(() => locations.value.find(l => l.id === activeLocationId.value) ?? null)
  const multiSite = computed(() => locations.value.length > 1)

  /** Filter helper: does this row (with a location_id) pass the current lens? */
  function inActiveLocation(locationId: string | null | undefined): boolean {
    if (!activeLocationId.value) return true
    return locationId === activeLocationId.value
  }

  return { locations, activeLocationId, activeLocation, multiSite, ensureLocations, setActiveLocation, inActiveLocation }
}
