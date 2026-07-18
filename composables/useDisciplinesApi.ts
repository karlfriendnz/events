// The client side of the seam for disciplines. Components call this — never
// useDb(), never Supabase, never $fetch to a raw table. It returns fully-typed
// domain objects (the shared contract), so a component has no idea whether the
// data came from MySQL today or the backend team's API tomorrow.
import type {
  Discipline,
  DisciplineRequirement,
  DisciplineCreate,
  DisciplinePatch,
  DisciplineRequirementCreate,
} from '../shared/contracts/discipline'

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
  async function create(input: DisciplineCreate): Promise<Discipline> {
    return await $fetch<Discipline>('/api/v1/disciplines', { method: 'POST', body: input })
  }
  async function update(id: string, patch: DisciplinePatch): Promise<Discipline> {
    return await $fetch<Discipline>(`/api/v1/disciplines/${id}`, { method: 'PATCH', body: patch })
  }
  async function remove(id: string): Promise<void> {
    await $fetch(`/api/v1/disciplines/${id}`, { method: 'DELETE' })
  }
  /** Replace the whole requirement set for one discipline (delete-then-insert). */
  async function saveRequirements(
    disciplineId: string,
    rows: DisciplineRequirementCreate[],
  ): Promise<DisciplineRequirement[]> {
    return await $fetch<DisciplineRequirement[]>(`/api/v1/disciplines/${disciplineId}/requirements`, {
      method: 'POST',
      body: rows,
    })
  }
  /** Every discipline owned by a SET of orgs (the requirement engine's chain walk
   *  needs the whole ancestry, which may span several governing bodies). */
  async function listForOrgs(orgIds: string[]): Promise<Discipline[]> {
    return await $fetch<Discipline[]>('/api/v1/disciplines/for-orgs', { query: { orgIds: orgIds.join(',') } })
  }
  /** The disciplines a member group is linked to (each carries its owning orgId). */
  async function forGroup(groupId: string): Promise<Discipline[]> {
    return await $fetch<Discipline[]>('/api/v1/disciplines/for-group', { query: { groupId } })
  }
  /** The disciplines an event is linked to (each carries its owning orgId). */
  async function forEvent(eventId: string): Promise<Discipline[]> {
    return await $fetch<Discipline[]>('/api/v1/disciplines/for-event', { query: { eventId } })
  }
  /** Delete a single requirement row. */
  async function deleteRequirement(id: string): Promise<void> {
    await $fetch(`/api/v1/disciplines/requirements/${id}`, { method: 'DELETE' })
  }
  return { list, requirements, create, update, remove, saveRequirements, listForOrgs, forGroup, forEvent, deleteRequirement }
}
