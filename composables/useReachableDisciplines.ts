// The disciplines a club can REACH — across every connected sport's governing chain
// (org_sports + the parent chain, migration 148), plus its OWN if it authors any.
// Extracted from <DisciplineLinker> so a single-select consumer (the event-category
// default discipline in Settings → Events) shares ONE fetch + grouping with the
// entity-bound linker instead of re-deriving the governing walk. Read-only: it returns
// OPTIONS, it does not write event_disciplines / member_group_disciplines.
//
// `groups` = one group per governing BODY (the heading), its disciplines depth-ordered
// so a child sits under its parent (Seniors › Premiers › B Grade). `flat` = every
// reachable discipline (id/name/parent/depth/body). Filtered to a context ('event' by
// default) the same way the linker does — a discipline shows when its applies_to is
// empty or includes the context, and its ancestors are kept so a child never dangles.

export interface ReachableDiscipline {
  id: string
  name: string
  parent_id: string | null
  sort_order: number
  body: string        // the governing body that owns it (heading label)
  depth: number       // nesting depth within its body's tree
}
export interface DisciplineGroup { label: string; items: ReachableDiscipline[] }

export function useReachableDisciplines() {
  const { orgId } = useOrg()
  const disciplinesApi = useDisciplinesApi()
  const { governingOrgs } = useOrgHierarchy()

  async function load(context: 'event' | 'group' = 'event'): Promise<{ flat: ReachableDiscipline[]; groups: DisciplineGroup[] }> {
    const id = orgId.value
    if (!id) return { flat: [], groups: [] }
    const gov = await governingOrgs(id)
    // The bodies ABOVE this org, plus itself (a governing body authors its own).
    const govIds = [...new Set([id, ...gov.map(g => g.id)])].filter(Boolean)
    const nameById = new Map<string, string>(gov.map(g => [g.id, g.name]))
    if (!nameById.has(id)) {
      try { nameById.set(id, (await useOrganisationsApi().get(id)).name) } catch { /* heading falls back to '' */ }
    }
    if (!govIds.length) return { flat: [], groups: [] }

    const rows = await disciplinesApi.listForOrgs(govIds)
    const inContext = (d: any) => !d.appliesTo || !d.appliesTo.length || d.appliesTo.includes(context)
    const keep = new Set<string>()
    for (const d of rows) if (inContext(d)) keep.add(d.id)
    const byId = new Map(rows.map((d: any) => [d.id, d]))
    // Keep ancestors of anything kept, so a shown child never dangles.
    for (const d of rows) if (keep.has(d.id)) {
      let p = (d as any).parentId
      while (p && byId.has(p) && !keep.has(p)) { keep.add(p); p = (byId.get(p) as any).parentId }
    }

    const flatRaw = rows.filter((d: any) => keep.has(d.id)).map((d: any) => ({
      id: d.id, name: d.name, parent_id: d.parentId ?? null, sort_order: d.sortOrder ?? 0,
      body: nameById.get(d.orgId) ?? '', depth: 0,
    }))

    // One group per body; depth-order within so children nest under parents.
    const byBody: Record<string, ReachableDiscipline[]> = {}
    for (const d of flatRaw) (byBody[d.body || 'Disciplines'] ??= []).push(d)
    const groups: DisciplineGroup[] = []
    const flat: ReachableDiscipline[] = []
    for (const [label, discs] of Object.entries(byBody)) {
      const ids = new Set(discs.map(d => d.id))
      const byParent: Record<string, ReachableDiscipline[]> = {}
      for (const d of discs) {
        const parent = d.parent_id && ids.has(d.parent_id) ? d.parent_id : '__root'
        ;(byParent[parent] ??= []).push(d)
      }
      const items: ReachableDiscipline[] = []
      const walk = (parent: string, depth: number) => {
        for (const d of (byParent[parent] ?? []).sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name))) {
          const withDepth = { ...d, depth }
          items.push(withDepth); flat.push(withDepth)
          walk(d.id, depth + 1)
        }
      }
      walk('__root', 0)
      if (items.length) groups.push({ label, items })
    }
    return { flat, groups }
  }

  return { load }
}
