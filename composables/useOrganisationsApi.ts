// The client side of the seam for organisations. Components call this — never
// useDb(), never Supabase, never $fetch to a raw table. It returns fully-typed
// domain objects (the shared contract), so a component has no idea whether the
// data came from MySQL today or the backend team's API tomorrow.
//
// This is the template every migrated screen follows: a use<Thing>Api() composable
// wrapping typed $fetch to /api/v1/*.
import type { Organisation, OrgTreeNode } from '../shared/contracts/organisation'

export function useOrganisationsApi() {
  async function list(): Promise<Organisation[]> {
    return await $fetch<Organisation[]>('/api/v1/organisations')
  }
  /** The governing chain above an org (immediate parent first). */
  async function ancestors(id: string): Promise<OrgTreeNode[]> {
    return await $fetch<OrgTreeNode[]>(`/api/v1/organisations/${id}/ancestors`)
  }
  /** The subtree beneath an org — what a governing body "can talk to". */
  async function descendants(id: string): Promise<OrgTreeNode[]> {
    return await $fetch<OrgTreeNode[]>(`/api/v1/organisations/${id}/descendants`)
  }
  return { list, ancestors, descendants }
}
