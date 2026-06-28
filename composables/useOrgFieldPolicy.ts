// Field engine — resolves an org's effective field definitions: its own plus
// those inherited from its governing bodies (ancestors). Field definitions are
// first-class (field_definitions table), created separately from any form.

export interface FieldDef {
  id: string
  org_id: string
  label: string
  field_type: string
  is_required: boolean
  options: string[]
  help_text: string | null
  key: string | null
  meta: Record<string, any>
  sort_order: number
  target: string
  targets?: string[]
  rules: any[]
  inherited: boolean
  ownerName: string
  ownerLevel: string
}

export function useOrgFieldPolicy() {
  const db = useDb()
  const { ancestors } = useOrgHierarchy()

  /** Own + inherited (ancestor) field definitions for an org. */
  async function resolveFields(orgId: string): Promise<FieldDef[]> {
    const anc = await ancestors(orgId)
    const ids = [orgId, ...anc.map(a => a.id)]
    const { data } = await (db.from as any)('field_definitions')
      .select('id, org_id, label, field_type, is_required, options, help_text, key, meta, sort_order, target, targets, rules, organisations(name, org_level)')
      .in('org_id', ids)
      .order('sort_order')
    const parseArr = (v: any) => {
      if (Array.isArray(v)) return v
      if (!v) return []
      try { const p = JSON.parse(v); return Array.isArray(p) ? p : [] } catch { return [] }
    }
    return (data ?? []).map((f: any) => ({
      ...f,
      options: parseArr(f.options),
      rules: parseArr(f.rules),
      meta: f.meta && typeof f.meta === 'object' ? f.meta : {},
      inherited: f.org_id !== orgId,
      ownerName: f.organisations?.name ?? '',
      ownerLevel: f.organisations?.org_level ?? '',
    }))
  }

  /** Own + inherited person types (Member / Guardian / Coach / …) with min/max. */
  async function resolvePersonTypes(orgId: string) {
    const anc = await ancestors(orgId)
    const ids = [orgId, ...anc.map(a => a.id)]
    const { data } = await (db.from as any)('person_target_types')
      .select('id, org_id, key, label, kind, min_count, max_count, sort_order, is_access, organisations(name)')
      .in('org_id', ids)
      .order('sort_order')
    return (data ?? []).map((t: any) => ({
      ...t,
      kind: t.kind ?? 'person',
      is_access: !!t.is_access,
      inherited: t.org_id !== orgId,
      ownerName: t.organisations?.name ?? '',
    }))
  }

  /** A club's OWN person/entity types only (no inheritance) — the single source
   *  the /proto/* prototype uses, so there's no duplicate/two-concept confusion. */
  async function loadOrgTypes(orgId: string) {
    const { data } = await (db.from as any)('person_target_types')
      .select('id, org_id, key, label, kind, is_access, permissions, member_slots, sort_order')
      .eq('org_id', orgId).order('sort_order')
    return (data ?? []).map((t: any) => ({
      ...t, kind: t.kind ?? 'person', is_access: !!t.is_access, inherited: false, ownerName: '',
    }))
  }

  /** Does a field definition apply to the given person-type key?
   *  Uses targets[] (multi-type); falls back to the legacy single `target`. */
  function fieldAppliesTo(f: any, key: string): boolean {
    const lc = (s: string) => (s || '').toLowerCase()
    const list = (Array.isArray(f.targets) && f.targets.length ? f.targets : [f.target || 'member']).map(lc)
    return list.includes(lc(key))
  }

  return { resolveFields, resolvePersonTypes, loadOrgTypes, fieldAppliesTo }
}
