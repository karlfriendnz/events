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
  const db = useDb()
  const { orgId } = useOrg()

  async function loadEntities(typeKey?: string): Promise<EntityRow[]> {
    let q = (db.from as any)('entities').select('*').eq('org_id', orgId.value).order('created_at', { ascending: false })
    if (typeKey) q = q.eq('type_key', typeKey)
    const { data } = await q
    return data ?? []
  }

  async function memberCounts(): Promise<Record<string, number>> {
    const { data } = await (db.from as any)('entity_members').select('entity_id').eq('org_id', orgId.value)
    const out: Record<string, number> = {}
    for (const m of data ?? []) out[m.entity_id] = (out[m.entity_id] ?? 0) + 1
    return out
  }

  async function createEntity(typeKey: string, name: string): Promise<string> {
    const { data, error } = await (db.from as any)('entities')
      .insert({ org_id: orgId.value, type_key: typeKey, name }).select('id').single()
    if (error) throw error
    return data.id
  }

  async function loadEntity(id: string): Promise<EntityRow | null> {
    const { data } = await (db.from as any)('entities').select('*').eq('id', id).maybeSingle()
    return data ?? null
  }

  async function saveEntity(id: string, patch: Partial<EntityRow>) {
    await (db.from as any)('entities').update(patch).eq('id', id)
  }

  async function deleteEntity(id: string) {
    await (db.from as any)('entities').delete().eq('id', id)
  }

  // Roster — load members then hydrate persons in one extra query (robust against
  // FK-embed quirks of the admin client).
  async function loadMembers(entityId: string): Promise<EntityMemberRow[]> {
    const { data: members } = await (db.from as any)('entity_members')
      .select('id, person_id, roles, sort_order').eq('entity_id', entityId).order('sort_order')
    const rows: EntityMemberRow[] = members ?? []
    const ids = rows.map(m => m.person_id)
    if (ids.length) {
      const { data: people } = await (db.from as any)('persons')
        .select('id, first_name, last_name, email, phone').in('id', ids)
      const byId: Record<string, any> = {}
      for (const p of people ?? []) byId[p.id] = p
      for (const m of rows) m.person = byId[m.person_id]
    }
    return rows
  }

  async function addMember(entityId: string, personId: string, roles: string[], sortOrder = 0) {
    const { error } = await (db.from as any)('entity_members')
      .insert({ org_id: orgId.value, entity_id: entityId, person_id: personId, roles, sort_order: sortOrder })
    if (error) throw error
  }
  async function updateMember(id: string, roles: string[]) {
    await (db.from as any)('entity_members').update({ roles }).eq('id', id)
  }
  async function removeMember(id: string) {
    await (db.from as any)('entity_members').delete().eq('id', id)
  }

  return {
    loadEntities, memberCounts, createEntity, loadEntity, saveEntity, deleteEntity,
    loadMembers, addMember, updateMember, removeMember,
  }
}
