// Prototype entity records + roster (migration 185). An "entity" is a record of
// an entity-kind person_target_type (Team / Business / School / Family). Its
// roster lives in entity_members, each edge carrying roles[].
//
// Kept self-contained for the /proto/* prototype — does not touch the live
// people/groups tables.

export interface EntityRow {
  id: string
  org_id: string
  type_key: string
  name: string
  custom_fields: Record<string, any>
  status: string
  created_at: string
}

export interface EntityMemberRow {
  id: string
  person_id: string
  roles: string[]
  sort_order: number
  person?: { id: string; first_name: string; last_name: string; email: string | null; phone: string | null }
}

export function useEntities() {
  const { orgId } = useOrg()
  const api = useEntitiesApi()

  // The seam returns camelCase domain objects; this composable's public surface is the
  // snake_case EntityRow / EntityMemberRow the /organisations pages read. Map at the edge.
  // (created_at isn't in the entity contract — no consumer reads it; ordering is
  // server-side by created_at desc — so it surfaces as '' here.)
  function toRow(e: any): EntityRow {
    return {
      id: e.id,
      org_id: e.orgId,
      type_key: e.typeKey,
      name: e.name,
      custom_fields: e.customFields ?? {},
      status: e.status,
      created_at: '',
    }
  }
  function toMemberRow(m: any): EntityMemberRow {
    return {
      id: m.id,
      person_id: m.personId,
      roles: m.roles ?? [],
      sort_order: m.sortOrder,
      person: m.person
        ? { id: m.person.id, first_name: m.person.firstName, last_name: m.person.lastName, email: m.person.email, phone: m.person.phone }
        : undefined,
    }
  }

  async function loadEntities(typeKey?: string): Promise<EntityRow[]> {
    if (!orgId.value) return []
    const rows = await api.loadEntities(orgId.value, typeKey)
    return rows.map(toRow)
  }

  async function memberCounts(): Promise<Record<string, number>> {
    if (!orgId.value) return {}
    return await api.memberCounts(orgId.value)
  }

  async function createEntity(typeKey: string, name: string): Promise<string> {
    const e = await api.createEntity({ orgId: orgId.value!, typeKey, name })
    return e.id
  }

  async function loadEntity(id: string): Promise<EntityRow | null> {
    const e = await api.loadEntity(id)
    return e ? toRow(e) : null
  }

  async function saveEntity(id: string, patch: Partial<EntityRow>) {
    // snake → camel; only forward the keys present.
    const p: Record<string, any> = {}
    if (patch.name !== undefined) p.name = patch.name
    if (patch.custom_fields !== undefined) p.customFields = patch.custom_fields
    if (patch.status !== undefined) p.status = patch.status
    if (patch.type_key !== undefined) p.typeKey = patch.type_key
    await api.saveEntity(id, p)
  }

  async function deleteEntity(id: string) {
    await api.deleteEntity(id)
  }

  async function loadMembers(entityId: string): Promise<EntityMemberRow[]> {
    const rows = await api.loadMembers(entityId)
    return rows.map(toMemberRow)
  }

  async function addMember(entityId: string, personId: string, roles: string[], sortOrder = 0) {
    await api.addMember({ orgId: orgId.value!, entityId, personId, roles, sortOrder })
  }
  async function updateMember(id: string, roles: string[]) {
    await api.updateMember(id, roles)
  }
  async function removeMember(id: string) {
    await api.removeMember(id)
  }

  return {
    loadEntities, memberCounts, createEntity, loadEntity, saveEntity, deleteEntity,
    loadMembers, addMember, updateMember, removeMember,
  }
}
