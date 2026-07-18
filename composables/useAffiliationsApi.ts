// The client side of the seam for the affiliations domain. Components call this —
// never useDb(), never Supabase, never $fetch to a raw table. It returns fully-typed
// domain objects (the shared contract), so a component has no idea whether the data
// came from MySQL today or the backend team's API tomorrow.
import type {
  GoverningBody,
  Location,
  LocationCreate,
  LocationPatch,
  LocationStaff,
  LocationStaffCreate,
  LocationStaffPatch,
  OrgManagerGrant,
  OrgSport,
  OrgSportCreate,
  OrgSportPatch,
  OrgSportWithNames,
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
  /** Clear the primary flag on every one of a club's sports (before setting a new one). */
  async function clearPrimarySports(orgId: string): Promise<void> {
    await $fetch('/api/v1/org-sports/clear-primary', { method: 'POST', body: { orgId } })
  }
  /** Governing-body picker options for a club's Sports editor (with default sport name). */
  async function governingBodies(excludeOrgId: string): Promise<GoverningBody[]> {
    return await $fetch<GoverningBody[]>('/api/v1/org-sports/governing-bodies', { query: { excludeOrgId } })
  }
  /** A governing body's affiliation register + queue (its whole subtree), names joined. */
  async function affiliationsForBody(orgId: string): Promise<OrgSportWithNames[]> {
    return await $fetch<OrgSportWithNames[]>('/api/v1/affiliations/for-body', { query: { orgId } })
  }
  /** A club's own affiliations (body name joined). */
  async function affiliationsForClub(orgId: string): Promise<OrgSportWithNames[]> {
    return await $fetch<OrgSportWithNames[]>('/api/v1/affiliations/for-club', { query: { orgId } })
  }
  /** How many affiliation requests are waiting in a body's subtree (nav badge). */
  async function pendingCountForBody(orgId: string): Promise<number> {
    const res = await $fetch<{ count: number }>('/api/v1/affiliations/pending-count', { query: { orgId } })
    return res.count
  }
  /** The cross-club manager grants a governing org has issued (person name joined). */
  async function managerGrants(orgId: string): Promise<OrgManagerGrant[]> {
    return await $fetch<OrgManagerGrant[]>('/api/v1/managers', { query: { orgId } })
  }
  /** Replace a person's manager grants at a governing org (delete-then-insert). */
  async function saveManagerGrants(orgId: string, personId: string, grants: { targetOrgId: string | null; capabilities: string[] }[]): Promise<void> {
    await $fetch('/api/v1/org-manager-grants/replace', { method: 'POST', body: { orgId, personId, grants } })
  }
  /** Drop a person as a manager entirely at a governing org. */
  async function removeManagerGrants(orgId: string, personId: string): Promise<void> {
    await $fetch('/api/v1/org-manager-grants/remove', { method: 'POST', body: { orgId, personId } })
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
  /** An org's per-site staff assignments — with the person joined. */
  async function locationStaffByOrg(orgId: string): Promise<LocationStaff[]> {
    return await $fetch<LocationStaff[]>('/api/v1/location-staff', { query: { orgId } })
  }
  async function createLocationStaff(input: LocationStaffCreate): Promise<LocationStaff> {
    return await $fetch<LocationStaff>('/api/v1/location-staff', { method: 'POST', body: input })
  }
  async function updateLocationStaff(id: string, patch: LocationStaffPatch): Promise<LocationStaff> {
    return await $fetch<LocationStaff>(`/api/v1/location-staff/${id}`, { method: 'PATCH', body: patch })
  }
  async function removeLocationStaff(id: string): Promise<void> {
    await $fetch(`/api/v1/location-staff/${id}`, { method: 'DELETE' })
  }
  return {
    orgSports,
    createOrgSport,
    updateOrgSport,
    removeOrgSport,
    clearPrimarySports,
    governingBodies,
    affiliationsForBody,
    affiliationsForClub,
    pendingCountForBody,
    managerGrants,
    saveManagerGrants,
    removeManagerGrants,
    locations,
    createLocation,
    updateLocation,
    removeLocation,
    locationStaffByOrg,
    createLocationStaff,
    updateLocationStaff,
    removeLocationStaff,
  }
}
