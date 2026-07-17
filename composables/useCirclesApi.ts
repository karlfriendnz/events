// The client side of the seam for circles, notes and entities. Components call this
// — never useDb(), never Supabase, never $fetch to a raw table. It returns
// fully-typed domain objects (the shared contract), so a component has no idea
// whether the data came from MySQL today or the backend team's API tomorrow.
//
// Follows the use<Thing>Api() template: typed $fetch to /api/v1/*. `members` /
// `entityMembers` hit sub-routes that a later slice adds; the composable already
// names them so consuming screens code against a stable surface.
import type {
  Circle,
  CircleMember,
  Entity,
  EntityMember,
  PersonNote,
} from '../shared/contracts/circle'

export function useCirclesApi() {
  /** Every circle a person belongs to. */
  async function circlesForPerson(personId: string): Promise<Circle[]> {
    return await $fetch<Circle[]>('/api/v1/circles', { query: { personId } })
  }
  /** The members of one circle. */
  async function members(circleId: string): Promise<CircleMember[]> {
    return await $fetch<CircleMember[]>(`/api/v1/circles/${circleId}/members`)
  }
  /** Every note on a person, newest first. */
  async function notes(personId: string): Promise<PersonNote[]> {
    return await $fetch<PersonNote[]>('/api/v1/person-notes', { query: { personId } })
  }
  /** Every entity record an org has. */
  async function entities(orgId: string): Promise<Entity[]> {
    return await $fetch<Entity[]>('/api/v1/entities', { query: { orgId } })
  }
  /** The roster of one entity. */
  async function entityMembers(entityId: string): Promise<EntityMember[]> {
    return await $fetch<EntityMember[]>(`/api/v1/entities/${entityId}/members`)
  }
  return { circlesForPerson, members, notes, entities, entityMembers }
}
