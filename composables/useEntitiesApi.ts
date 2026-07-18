// The client side of the seam for entity records + their rosters (entities /
// entity_members). Components call this — never useDb(), never Supabase, never $fetch
// to a raw table. It returns fully-typed domain objects (the shared contract), so a
// consumer has no idea whether the data came from MySQL today or the backend team's API
// tomorrow.
//
// This is the entities half of the circles/notes/entities domain, split into its own
// composable (cross-domain gap Fi5) so the proto org-record page + the dashboard can
// drop useDb. Backed by the SAME repository (circles.ts) + the /api/v1/entities routes.
import type {
  Entity,
  EntityCreate,
  EntityPatch,
  EntityMember,
  EntityMemberCreate,
  EntityMemberWithPerson,
  EntityMemberCounts,
} from '../shared/contracts/circle'

export function useEntitiesApi() {
  /** Every entity record an org has (optionally one type), newest first. */
  async function loadEntities(orgId: string, typeKey?: string): Promise<Entity[]> {
    const query: Record<string, string> = { orgId }
    if (typeKey) query.typeKey = typeKey
    return await $fetch<Entity[]>('/api/v1/entities', { query })
  }
  /** { [entityId]: attach count } across the org — the directory's attach badge. */
  async function memberCounts(orgId: string): Promise<EntityMemberCounts> {
    return await $fetch<EntityMemberCounts>('/api/v1/entities/member-counts', { query: { orgId } })
  }
  /** Create an entity record; returns the created domain object. */
  async function createEntity(input: EntityCreate): Promise<Entity> {
    return await $fetch<Entity>('/api/v1/entities', { method: 'POST', body: input })
  }
  /** One entity record by id (null when it doesn't exist). */
  async function loadEntity(id: string): Promise<Entity | null> {
    try {
      return await $fetch<Entity>(`/api/v1/entities/${id}`)
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.status === 404 || e?.response?.status === 404) return null
      throw e
    }
  }
  /** Partially update an entity record; returns the updated domain object. */
  async function saveEntity(id: string, patch: EntityPatch): Promise<Entity> {
    return await $fetch<Entity>(`/api/v1/entities/${id}`, { method: 'PATCH', body: patch })
  }
  /** Delete an entity record. */
  async function deleteEntity(id: string): Promise<void> {
    await $fetch(`/api/v1/entities/${id}`, { method: 'DELETE' })
  }
  /** The roster of one entity — each attached person hydrated (name + contact). */
  async function loadMembers(entityId: string): Promise<EntityMemberWithPerson[]> {
    return await $fetch<EntityMemberWithPerson[]>(`/api/v1/entities/${entityId}/members`)
  }
  /** Attach a person to an entity with roles[]; returns the created edge. */
  async function addMember(input: EntityMemberCreate): Promise<EntityMember> {
    return await $fetch<EntityMember>(`/api/v1/entities/${input.entityId}/members`, {
      method: 'POST',
      body: input,
    })
  }
  /** Change the roles[] on one roster edge. */
  async function updateMember(id: string, roles: string[]): Promise<void> {
    await $fetch(`/api/v1/entities/members/${id}`, { method: 'PATCH', body: { roles } })
  }
  /** Detach one person from an entity. */
  async function removeMember(id: string): Promise<void> {
    await $fetch(`/api/v1/entities/members/${id}`, { method: 'DELETE' })
  }
  return {
    loadEntities, memberCounts, createEntity, loadEntity, saveEntity, deleteEntity,
    loadMembers, addMember, updateMember, removeMember,
  }
}
