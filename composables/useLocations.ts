// LOCATIONS (migration 237) — a club's operational sites, distinct from the
// booking-engine venues. A staff member can hold roles at MULTIPLE locations
// (location_staff, mirrors code_staff); classes belong to one site via
// member_groups.location_id. Progressive disclosure rule: only surface
// location UI when the club has 2+ locations (hasLocations/multiSite).
export interface ClubLocation {
  id: string
  org_id?: string
  name: string
  address: string | null
  color: string | null
  sort_order: number
}

export interface LocationStaff {
  id: string
  location_id: string | null   // null = ALL locations (scope-tuple grant, mig 238)
  sport_id: string | null      // null = ALL sports
  person_id: string
  role_key: string
  person?: { id: string; first_name: string | null; last_name: string | null; email: string | null }
}

export const LOCATION_STAFF_ROLES = [
  { key: 'manager', label: 'Location manager' },
  { key: 'staff', label: 'Staff' },
]

export function useLocations() {
  const { orgId } = useOrg()
  const api = useAffiliationsApi()

  async function loadLocations(org = orgId.value): Promise<ClubLocation[]> {
    if (!org) return []
    const rows = await api.locations(org)
    // Seam returns camelCase; this screen speaks snake_case.
    return rows.map(r => ({ id: r.id, org_id: r.orgId, name: r.name, address: r.address, color: r.color, sort_order: r.sortOrder }))
  }

  async function createLocation(patch: Partial<ClubLocation>): Promise<ClubLocation | null> {
    if (!orgId.value) return null
    const r = await api.createLocation({ orgId: orgId.value, name: patch.name ?? 'New location', address: patch.address ?? null, color: patch.color ?? null, sortOrder: patch.sort_order ?? 0 })
    return { id: r.id, org_id: r.orgId, name: r.name, address: r.address, color: r.color, sort_order: r.sortOrder }
  }

  async function updateLocation(id: string, patch: Partial<ClubLocation>): Promise<void> {
    await api.updateLocation(id, { name: patch.name, address: patch.address, color: patch.color, sortOrder: patch.sort_order })
  }

  /** Classes fall back to "no location" (FK is on delete set null). */
  async function deleteLocation(id: string): Promise<void> {
    await api.removeLocation(id)
  }

  // ── Staff assignments: a person can be at many locations ──
  async function loadLocationStaff(org = orgId.value): Promise<LocationStaff[]> {
    if (!org) return []
    const rows = await api.locationStaffByOrg(org)
    return rows.map(r => ({
      id: r.id,
      location_id: r.locationId,
      sport_id: r.sportId,
      person_id: r.personId,
      role_key: r.roleKey,
      person: r.person ? { id: r.person.id, first_name: r.person.firstName, last_name: r.person.lastName, email: r.person.email } : undefined,
    }))
  }

  async function assignStaff(locationId: string | null, personId: string, roleKey = 'staff', sportId: string | null = null): Promise<void> {
    if (!orgId.value) return
    // Scope-tuple grant: null location = all locations, null sport = all sports.
    await api.createLocationStaff({ orgId: orgId.value, locationId, personId, roleKey, sportId })
  }

  /** Does this person's grant set cover (location, sport)? Nulls in a grant are
   *  wildcards. A person with NO grants is unrestricted (never-lock-out). */
  function grantsCover(grants: LocationStaff[], personId: string, locationId: string | null, sportId: string | null): boolean {
    const mine = grants.filter(g => g.person_id === personId)
    if (!mine.length) return true
    return mine.some(g =>
      (g.location_id == null || g.location_id === locationId) &&
      (g.sport_id == null || g.sport_id === sportId))
  }

  async function updateStaff(id: string, patch: Partial<Pick<LocationStaff, 'sport_id' | 'role_key'>>): Promise<void> {
    await api.updateLocationStaff(id, { roleKey: patch.role_key, sportId: patch.sport_id })
  }

  async function removeStaff(id: string): Promise<void> {
    await api.removeLocationStaff(id)
  }

  /** All location ids a person holds any role at (multi-location staff). */
  function locationsOf(personId: string, staff: LocationStaff[]): string[] {
    return [...new Set(staff.filter(s => s.person_id === personId && s.location_id).map(s => s.location_id as string))]
  }

  return { loadLocations, createLocation, updateLocation, deleteLocation, loadLocationStaff, assignStaff, updateStaff, removeStaff, locationsOf, grantsCover }
}
