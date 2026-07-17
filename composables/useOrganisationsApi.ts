// The client side of the seam for organisations. Components call this — never
// useDb(), never Supabase, never $fetch to a raw table. It returns fully-typed
// domain objects (the shared contract), so a component has no idea whether the
// data came from MySQL today or the backend team's API tomorrow.
//
// This is the template every migrated screen follows: a use<Thing>Api() composable
// wrapping typed $fetch to /api/v1/*.
import type { Organisation } from '../shared/contracts/organisation'

export function useOrganisationsApi() {
  async function list(): Promise<Organisation[]> {
    return await $fetch<Organisation[]>('/api/v1/organisations')
  }
  return { list }
}
