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
  const db = useDb()
  const { orgId } = useOrg()

  async function loadLocations(org = orgId.value): Promise<ClubLocation[]> {
    if (!org) return []
    const { data } = await (db.from as any)('locations')
      .select('id, org_id, name, address, color, sort_order')
      .eq('org_id', org)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name')
    return (data ?? []) as ClubLocation[]
  }

  async function createLocation(patch: Partial<ClubLocation>): Promise<ClubLocation | null> {
    const { data } = await (db.from as any)('locations')
      .insert({ org_id: orgId.value, name: patch.name ?? 'New location', address: patch.address ?? null, color: patch.color ?? null, sort_order: patch.sort_order ?? 0 })
      .select('id, org_id, name, address, color, sort_order').single()
    return (data ?? null) as ClubLocation | null
  }

  async function updateLocation(id: string, patch: Partial<ClubLocation>): Promise<void> {
    await (db.from as any)('locations').update(patch).eq('id', id)
  }

  /** Classes fall back to "no location" (FK is on delete set null). */
  async function deleteLocation(id: string): Promise<void> {
    await (db.from as any)('locations').delete().eq('id', id)
  }

  // ── Staff assignments: a person can be at many locations ──
  async function loadLocationStaff(org = orgId.value): Promise<LocationStaff[]> {
    if (!org) return []
    const { data } = await (db.from as any)('location_staff')
      .select('id, location_id, sport_id, person_id, role_key, person:persons(id, first_name, last_name, email)')
      .eq('org_id', org)
    return (data ?? []) as LocationStaff[]
  }

  async function assignStaff(locationId: string | null, personId: string, roleKey = 'staff', sportId: string | null = null): Promise<void> {
    // Scope-tuple grant: null location = all locations, null sport = all sports.
    await (db.from as any)('location_staff')
      .insert({ org_id: orgId.value, location_id: locationId, person_id: personId, role_key: roleKey, sport_id: sportId })
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

  async function removeStaff(id: string): Promise<void> {
    await (db.from as any)('location_staff').delete().eq('id', id)
  }

  /** All location ids a person holds any role at (multi-location staff). */
  function locationsOf(personId: string, staff: LocationStaff[]): string[] {
    return [...new Set(staff.filter(s => s.person_id === personId && s.location_id).map(s => s.location_id as string))]
  }

  return { loadLocations, createLocation, updateLocation, deleteLocation, loadLocationStaff, assignStaff, removeStaff, locationsOf, grantsCover }
}
