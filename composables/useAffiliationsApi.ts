// The client side of the seam for the affiliations domain. Components call this —
// never useDb(), never Supabase, never $fetch to a raw table. It returns fully-typed
// domain objects (the shared contract), so a component has no idea whether the data
// came from MySQL today or the backend team's API tomorrow.
import type {
  Location,
  OrgManagerGrant,
  OrgSport,
} from '../shared/contracts/affiliation'

export function useAffiliationsApi() {
  /** A club's sports + their governing-body affiliation. */
  async function orgSports(orgId: string): Promise<OrgSport[]> {
    return await $fetch<OrgSport[]>('/api/v1/org-sports', { query: { orgId } })
  }
  /** The cross-club manager grants a governing org has issued. */
  async function managerGrants(orgId: string): Promise<OrgManagerGrant[]> {
    return await $fetch<OrgManagerGrant[]>('/api/v1/managers', { query: { orgId } })
  }
  /** A club's operational sites. */
  async function locations(orgId: string): Promise<Location[]> {
    return await $fetch<Location[]>('/api/v1/locations', { query: { orgId } })
  }
  return { orgSports, managerGrants, locations }
}
