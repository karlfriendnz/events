// Club types: a platform catalogue (club_types, super-admin managed) assigned to
// orgs via organisations.club_type_ids. Governing bodies (NSO/association/regional)
// can set a type that flows DOWN to every club connected beneath them — e.g. NZC
// sets "Team Based" and all its cricket clubs inherit it. Resolution is live
// (computed from the governing chain), not copied, so changes propagate.

export interface ClubType { id: string; name: string }
export interface InheritedClubType extends ClubType { from: string }

export function useClubTypes() {
  const db = useDb()

  /** The platform-wide catalogue. */
  async function loadCatalog(): Promise<ClubType[]> {
    const { data } = await (db.from as any)('club_types').select('id, name').order('sort_order').order('name')
    return data ?? []
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

  return { loadCatalog, governingOrgs, resolveInherited, resolveEffective }
}
