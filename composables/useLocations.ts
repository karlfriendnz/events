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
  location_id: string
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
      .select('id, location_id, person_id, role_key, person:persons(id, first_name, last_name, email)')
      .eq('org_id', org)
    return (data ?? []) as LocationStaff[]
  }

  async function assignStaff(locationId: string, personId: string, roleKey = 'staff'): Promise<void> {
    await (db.from as any)('location_staff')
      .upsert({ org_id: orgId.value, location_id: locationId, person_id: personId, role_key: roleKey }, { onConflict: 'location_id,person_id,role_key' })
  }

  async function removeStaff(id: string): Promise<void> {
    await (db.from as any)('location_staff').delete().eq('id', id)
  }

  /** All location ids a person holds any role at (multi-location staff). */
  function locationsOf(personId: string, staff: LocationStaff[]): string[] {
    return [...new Set(staff.filter(s => s.person_id === personId).map(s => s.location_id))]
  }

  return { loadLocations, createLocation, updateLocation, deleteLocation, loadLocationStaff, assignStaff, removeStaff, locationsOf }
}
