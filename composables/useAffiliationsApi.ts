// The client side of the seam for the affiliations domain. Components call this —
// never useDb(), never Supabase, never $fetch to a raw table. It returns fully-typed
// domain objects (the shared contract), so a component has no idea whether the data
// came from MySQL today or the backend team's API tomorrow.
import type {
  Location,
  LocationCreate,
  LocationPatch,
  LocationStaff,
  OrgManagerGrant,
  OrgSport,
  OrgSportCreate,
  OrgSportPatch,
} from '../shared/contracts/affiliation'

export function useAffiliationsApi() {
  /** A club's sports + their governing-body affiliation. */
  async function orgSports(orgId: string): Promise<OrgSport[]> {
    return await $fetch<OrgSport[]>('/api/v1/org-sports', { query: { orgId } })
  }
  async function createOrgSport(input: OrgSportCreate): Promise<OrgSport> {
    return await $fetch<OrgSport>('/api/v1/org-sports', { method: 'POST', body: input })
  }
  async function updateOrgSport(id: string, patch: OrgSportPatch): Promise<OrgSport> {
    return await $fetch<OrgSport>(`/api/v1/org-sports/${id}`, { method: 'PATCH', body: patch })
  }
  async function removeOrgSport(id: string): Promise<void> {
    await $fetch(`/api/v1/org-sports/${id}`, { method: 'DELETE' })
  }
  /** The cross-club manager grants a governing org has issued. */
  async function managerGrants(orgId: string): Promise<OrgManagerGrant[]> {
    return await $fetch<OrgManagerGrant[]>('/api/v1/managers', { query: { orgId } })
  }
  /** A club's operational sites. */
  async function locations(orgId: string): Promise<Location[]> {
    return await $fetch<Location[]>('/api/v1/locations', { query: { orgId } })
  }
  async function createLocation(input: LocationCreate): Promise<Location> {
    return await $fetch<Location>('/api/v1/locations', { method: 'POST', body: input })
  }
  async function updateLocation(id: string, patch: LocationPatch): Promise<Location> {
    return await $fetch<Location>(`/api/v1/locations/${id}`, { method: 'PATCH', body: patch })
  }
  async function removeLocation(id: string): Promise<void> {
    await $fetch(`/api/v1/locations/${id}`, { method: 'DELETE' })
  }
  /** An org's per-site staff assignments — for the People directory's location lens. */
  async function locationStaffByOrg(orgId: string): Promise<LocationStaff[]> {
    return await $fetch<LocationStaff[]>('/api/v1/location-staff', { query: { orgId } })
  }
  return {
    orgSports,
    createOrgSport,
    updateOrgSport,
    removeOrgSport,
    managerGrants,
    locations,
    createLocation,
    updateLocation,
    removeLocation,
    locationStaffByOrg,
  }
}
