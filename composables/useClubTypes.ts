// Club types: a platform catalogue (club_types, super-admin managed) assigned to
// orgs via organisations.club_type_ids. Governing bodies (NSO/association/regional)
// can set a type that flows DOWN to every club connected beneath them — e.g. NZC
// sets "Team Based" and all its cricket clubs inherit it. Resolution is live
// (computed from the governing chain), not copied, so changes propagate.

export interface ClubType { id: string; name: string }
export interface InheritedClubType extends ClubType { from: string }

/** The setup template a club type carries (migration 248). */
export interface ClubTypeDefaults {
  default_modules: string[] | null                              // enabled module keys; null = leave all on
  default_person_types: { key: string; label: string; is_access?: boolean }[] | null
  default_terminology: Record<string, { singular?: string; plural?: string }> | null
}

export function useClubTypes() {
  const db = useDb()

  /** The platform-wide catalogue. */
  async function loadCatalog(): Promise<ClubType[]> {
    const { data } = await (db.from as any)('club_types').select('id, name').order('sort_order').order('name')
    return data ?? []
  }

  /** A single club type's defaults template. */
  async function loadDefaults(typeId: string): Promise<ClubTypeDefaults> {
    const { data } = await (db.from as any)('club_types')
      .select('default_modules, default_person_types, default_terminology').eq('id', typeId).maybeSingle()
    return {
      default_modules: data?.default_modules ?? null,
      default_person_types: data?.default_person_types ?? null,
      default_terminology: data?.default_terminology ?? null,
    }
  }

  /** Persist a club type's defaults template. */
  async function saveDefaults(typeId: string, d: ClubTypeDefaults): Promise<void> {
    await (db.from as any)('club_types').update({
      default_modules: d.default_modules,
      default_person_types: d.default_person_types,
      default_terminology: d.default_terminology,
    }).eq('id', typeId)
  }

  /**
   * Seed a (freshly created) org from its club types' defaults: modules +
   * terminology on the org row, and any missing person types. Merges across
   * multiple types (union of modules, first-wins per person-type key, later
   * terminology wins). Never clobbers a person type the org already has.
   */
  async function applyClubTypeDefaults(orgId: string, typeIds: string[]): Promise<void> {
    if (!orgId || !typeIds?.length) return
    const { data: types } = await (db.from as any)('club_types')
      .select('default_modules, default_person_types, default_terminology').in('id', typeIds)
    if (!types?.length) return

    // Modules — union of every type that specifies a set; if none specify, leave null (all on).
    const moduleSets = types.filter((t: any) => Array.isArray(t.default_modules)).map((t: any) => t.default_modules as string[])
    const modules: string[] | null = moduleSets.length ? [...new Set(moduleSets.flat())] : null

    // Terminology — merge, later type wins.
    let terminology: Record<string, any> = {}
    for (const t of types) terminology = { ...terminology, ...(t.default_terminology ?? {}) }

    const patch: any = {}
    if (modules) patch.enabled_modules = modules
    if (Object.keys(terminology).length) patch.terminology = terminology
    if (Object.keys(patch).length) await (db.from as any)('organisations').update(patch).eq('id', orgId)

    // Person types — union by key, skip any the org already has.
    const ptByKey = new Map<string, { key: string; label: string; is_access?: boolean }>()
    for (const t of types) for (const pt of (t.default_person_types ?? [])) {
      if (pt?.key && !ptByKey.has(pt.key)) ptByKey.set(pt.key, pt)
    }
    if (ptByKey.size) {
      const { data: existing } = await (db.from as any)('person_target_types').select('key').eq('org_id', orgId)
      const have = new Set((existing ?? []).map((r: any) => r.key))
      const rows = [...ptByKey.values()].filter(pt => !have.has(pt.key)).map((pt, i) => ({
        org_id: orgId, key: pt.key, label: pt.label, kind: 'person',
        is_access: !!pt.is_access, min_count: 0, max_count: null, sort_order: i,
      }))
      if (rows.length) await (db.from as any)('person_target_types').insert(rows)
    }
  }

  /** Governing-body org ids above this org — parent_id chain + every sport affiliation's chain. */
  async function governingOrgs(orgId: string): Promise<{ id: string; name: string }[]> {
    const [anc, sportAnc] = await Promise.all([
      (db.rpc as any)('org_ancestors', { p_org: orgId }),
      (db.rpc as any)('org_sport_ancestors', { p_org: orgId, p_sport: null }),
    ])
    const map = new Map<string, string>()
    for (const a of (anc.data ?? [])) map.set(a.id, a.name)
    for (const a of (sportAnc.data ?? [])) map.set(a.id, a.name)
    return [...map].map(([id, name]) => ({ id, name }))
  }

  /** Club types inherited from the governing chain (deduped, with the body they came from). */
  async function resolveInherited(orgId: string, catalog?: ClubType[]): Promise<InheritedClubType[]> {
    const gov = await governingOrgs(orgId)
    if (!gov.length) return []
    const { data: orgs } = await (db.from as any)('organisations')
      .select('id, name, club_type_ids').in('id', gov.map(g => g.id))
    const cat = catalog ?? await loadCatalog()
    const nameById = Object.fromEntries(cat.map(c => [c.id, c.name]))
    const out: InheritedClubType[] = []
    const seen = new Set<string>()
    for (const o of (orgs ?? [])) {
      for (const tid of (o.club_type_ids ?? [])) {
        if (seen.has(tid)) continue
        seen.add(tid)
        out.push({ id: tid, name: nameById[tid] ?? '—', from: o.name })
      }
    }
    return out
  }

  /** Effective club types for an org = own + inherited (deduped). Useful for defaults. */
  async function resolveEffective(orgId: string, ownIds: string[], catalog?: ClubType[]): Promise<ClubType[]> {
    const cat = catalog ?? await loadCatalog()
    const nameById = Object.fromEntries(cat.map(c => [c.id, c.name]))
    const inherited = await resolveInherited(orgId, cat)
    const ids = new Set<string>([...(ownIds ?? []), ...inherited.map(i => i.id)])
    return [...ids].map(id => ({ id, name: nameById[id] ?? '—' }))
  }

  return { loadCatalog, loadDefaults, saveDefaults, applyClubTypeDefaults, governingOrgs, resolveInherited, resolveEffective }
}
