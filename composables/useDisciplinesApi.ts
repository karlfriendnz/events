// The client side of the seam for disciplines. Components call this — never
// useDb(), never Supabase, never $fetch to a raw table. It returns fully-typed
// domain objects (the shared contract), so a component has no idea whether the
// data came from MySQL today or the backend team's API tomorrow.
import type { Discipline, DisciplineRequirement } from '../shared/contracts/discipline'

export function useDisciplinesApi() {
  /** Every discipline an org defines. */
  async function list(orgId: string): Promise<Discipline[]> {
    return await $fetch<Discipline[]>('/api/v1/disciplines', { query: { orgId } })
  }
  /** The requirements attached to a set of disciplines (empty in → empty out). */
  async function requirements(disciplineIds: string[]): Promise<DisciplineRequirement[]> {
    return await $fetch<DisciplineRequirement[]>('/api/v1/disciplines/requirements', {
      query: { disciplineIds: disciplineIds.join(',') },
    })
  }
  return { list, requirements }
}
