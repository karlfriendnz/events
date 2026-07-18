// Club types: a platform catalogue (club_types, super-admin managed) assigned to
// orgs via organisations.club_type_ids. Governing bodies (NSO/association/regional)
// can set a type that flows DOWN to every club connected beneath them — e.g. NZC
// sets "Team Based" and all its cricket clubs inherit it. Resolution is live
// (computed from the governing chain), not copied, so changes propagate.

export interface ClubType { id: string; name: string }
export interface InheritedClubType extends ClubType { from: string }

/** A person type in a defaults template — carries its FULL starting config so a
 *  new club is seeded with permissions, menu and landing already set. */
export interface DefaultPersonType {
  key: string
  label: string
  is_access?: boolean
  permissions?: Record<string, any> | null
  menu_items?: string[] | null
  landing_path?: string | null
  dashboard?: any[] | null   // starting dashboard layout (dashboard_templates config)
}

/** The setup template a club type carries (migrations 248 + 255). */
export interface ClubTypeDefaults {
  default_modules: string[] | null                              // enabled module keys; null = leave all on
  default_person_types: DefaultPersonType[] | null
  default_terminology: Record<string, { singular?: string; plural?: string }> | null
}

export function useClubTypes() {
  const api = useAdminApi()

  /** The platform-wide catalogue (assignable types only — excludes the overall default). */
  async function loadCatalog(): Promise<ClubType[]> {
    const all = await api.clubTypes()
    return all.filter(t => !t.isOverallDefault).map(t => ({ id: t.id, name: t.name }))
  }

  /** The id of the platform-wide "Overall default" template row (migration 255). */
  async function loadOverallDefaultId(): Promise<string | null> {
    return await api.overallDefaultClubTypeId()
  }

  /** A single club type's defaults template. */
  async function loadDefaults(typeId: string): Promise<ClubTypeDefaults> {
    const t = await api.getClubType(typeId)
    return {
      default_modules: t?.defaultModules ?? null,
      default_person_types: t?.defaultPersonTypes ?? null,
      default_terminology: t?.defaultTerminology ?? null,
    }
  }

  /** Persist a club type's defaults template. */
  async function saveDefaults(typeId: string, d: ClubTypeDefaults): Promise<void> {
    await api.saveClubTypeDefaults(typeId, {
      defaultModules: d.default_modules,
      defaultPersonTypes: d.default_person_types,
      defaultTerminology: d.default_terminology,
    })
  }

  /**
   * Seed a (freshly created) org from its club types' defaults: modules +
   * terminology on the org row, and any missing person types + dashboards. The
   * whole operation (read club types, merge across them overall-default-first,
   * insert only what's missing) runs server-side in the seam so it's one call.
   */
  async function applyClubTypeDefaults(orgId: string, typeIds: string[]): Promise<void> {
    if (!orgId) return
    await api.applyClubTypeDefaults(orgId, typeIds)
  }

  /** Governing-body orgs above this org — parent_id chain + every sport affiliation's chain. */
  async function governingOrgs(orgId: string): Promise<{ id: string; name: string }[]> {
    return (await useOrgHierarchy().governingOrgs(orgId)).map(o => ({ id: o.id, name: o.name }))
  }

  /** Club types inherited from the governing chain (deduped, with the body they came from). */
  async function resolveInherited(orgId: string, catalog?: ClubType[]): Promise<InheritedClubType[]> {
    const gov = await governingOrgs(orgId)
    if (!gov.length) return []
    const orgs = await api.orgClubTypeIds(gov.map(g => g.id))
    const cat = catalog ?? await loadCatalog()
    const nameById = Object.fromEntries(cat.map(c => [c.id, c.name]))
    const out: InheritedClubType[] = []
    const seen = new Set<string>()
    for (const o of orgs) {
      for (const tid of (o.clubTypeIds ?? [])) {
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

  return { loadCatalog, loadOverallDefaultId, loadDefaults, saveDefaults, applyClubTypeDefaults, governingOrgs, resolveInherited, resolveEffective }
}
