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
  CircleCreate,
  CircleMember,
  CircleMemberCreate,
  CircleMemberPatch,
  CirclePatch,
  CircleWithMembers,
  CommsPreference,
  CommsPreferenceUpsert,
  Entity,
  EntityCreate,
  EntityPatch,
  EntityMember,
  PersonNote,
} from '../shared/contracts/circle'

export function useCirclesApi() {
  /** Every circle a person belongs to (flat, no members). */
  async function circlesForPerson(personId: string): Promise<Circle[]> {
    return await $fetch<Circle[]>('/api/v1/circles', { query: { personId } })
  }
  /** Every circle in an org, each with its members hydrated — the capability resolvers
   *  + the circles editor read this and filter per person. */
  async function circlesForOrg(orgId: string): Promise<CircleWithMembers[]> {
    return await $fetch<CircleWithMembers[]>('/api/v1/circles/with-members', { query: { orgId } })
  }
  /** The members of one circle. */
  async function members(circleId: string): Promise<CircleMember[]> {
    return await $fetch<CircleMember[]>(`/api/v1/circles/${circleId}/members`)
  }
  /** Create a circle (family or circle). */
  async function createCircle(input: CircleCreate): Promise<Circle> {
    return await $fetch<Circle>('/api/v1/circles', { method: 'POST', body: input })
  }
  /** Update a circle's presentation (name / color / imageUrl). */
  async function updateCircle(id: string, patch: CirclePatch): Promise<void> {
    await $fetch(`/api/v1/circles/${id}`, { method: 'PATCH', body: patch })
  }
  /** Delete a circle (unlinks everyone in it). */
  async function removeCircle(id: string): Promise<void> {
    await $fetch(`/api/v1/circles/${id}`, { method: 'DELETE' })
  }
  /** Add a person to a circle with a role + optional capability/contact flags. */
  async function addMember(circleId: string, input: Omit<CircleMemberCreate, 'circleId'>): Promise<CircleMember> {
    return await $fetch<CircleMember>(`/api/v1/circles/${circleId}/members`, { method: 'POST', body: input })
  }
  /** Update one circle-member edge. */
  async function updateMember(id: string, patch: CircleMemberPatch): Promise<void> {
    await $fetch(`/api/v1/circles/members/${id}`, { method: 'PATCH', body: patch })
  }
  /** Remove one person from a circle. */
  async function removeMember(id: string): Promise<void> {
    await $fetch(`/api/v1/circles/members/${id}`, { method: 'DELETE' })
  }
  /** Comms prefs a recipient set (keyed to them). */
  async function commsPreferences(personId: string): Promise<CommsPreference[]> {
    return await $fetch<CommsPreference[]>('/api/v1/comms-preferences', { query: { personId } })
  }
  /** Comms prefs about a subject — everyone who receives their comms + chosen categories. */
  async function commsPreferencesForSubject(subjectPersonId: string): Promise<CommsPreference[]> {
    return await $fetch<CommsPreference[]>('/api/v1/comms-preferences', { query: { subjectPersonId } })
  }
  /** Upsert a comms preference on (personId, subjectPersonId). */
  async function setCommsPreference(input: CommsPreferenceUpsert): Promise<void> {
    await $fetch('/api/v1/comms-preferences', { method: 'POST', body: input })
  }
  /** Every note on a person, newest first. */
  async function notes(personId: string): Promise<PersonNote[]> {
    return await $fetch<PersonNote[]>('/api/v1/person-notes', { query: { personId } })
  }
  /** Every entity record an org has. */
  async function entities(orgId: string): Promise<Entity[]> {
    return await $fetch<Entity[]>('/api/v1/entities', { query: { orgId } })
  }
  /** Create an entity record; returns the created domain object. */
  async function createEntity(input: EntityCreate): Promise<Entity> {
    return await $fetch<Entity>('/api/v1/entities', { method: 'POST', body: input })
  }
  /** Partially update an entity record; returns the updated domain object. */
  async function updateEntity(id: string, patch: EntityPatch): Promise<Entity> {
    return await $fetch<Entity>(`/api/v1/entities/${id}`, { method: 'PATCH', body: patch })
  }
  /** Delete an entity record. */
  async function removeEntity(id: string): Promise<void> {
    await $fetch(`/api/v1/entities/${id}`, { method: 'DELETE' })
  }
  /** The roster of one entity. */
  async function entityMembers(entityId: string): Promise<EntityMember[]> {
    return await $fetch<EntityMember[]>(`/api/v1/entities/${entityId}/members`)
  }
  return {
    circlesForPerson, circlesForOrg, members,
    createCircle, updateCircle, removeCircle, addMember, updateMember, removeMember,
    commsPreferences, commsPreferencesForSubject, setCommsPreference,
    notes,
    entities, createEntity, updateEntity, removeEntity, entityMembers,
  }
}
