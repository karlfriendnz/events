// Governing-body club managers (migration 249). A person at an NSO / Regional /
// Association / RST is granted authority ACROSS the clubs beneath their org. The
// role itself is a normal access person type; this layer answers WHICH clubs +
// WHAT they may do there.
//
//   scope 'subtree' → one grant row with target_org_id NULL = every descendant CLUB
//   scope 'clubs'   → one grant row per explicitly-assigned club
//
// Descendants are resolved down the organisations.parent_id tree (the primary
// governing chain; sport affiliation mirrors into parent_id — see migration 148).

export const MANAGER_CAPABILITIES = [
  { key: 'report', label: 'Reporting', icon: 'pi-chart-bar', description: 'See aggregate reports across the clubs.' },
  { key: 'events', label: 'Create events', icon: 'pi-calendar', description: 'Create events for the clubs.' },
  { key: 'comms',  label: 'Send comms',    icon: 'pi-envelope', description: 'Message the clubs’ members.' },
] as const

export interface ManagerGrant {
  id: string
  org_id: string
  person_id: string
  target_org_id: string | null
  capabilities: string[]
}

export interface ManagerAssignment {
  personId: string
  personName: string
  scope: 'subtree' | 'clubs'
  clubIds: string[]        // when scope === 'clubs'
  capabilities: string[]
}

export function useOrgManagers() {
  const user = useSupabaseUser()
  const api = useAffiliationsApi()
  const orgsApi = useOrganisationsApi()
  const peopleApi = usePeopleApi()

  /** Every org row (id/name/level/parent) — used to walk the subtree client-side. */
  async function loadAllOrgs(): Promise<{ id: string; name: string; org_level: string; parent_id: string | null }[]> {
    const orgs = await orgsApi.list()
    return orgs.map(o => ({ id: o.id, name: o.name, org_level: o.orgLevel, parent_id: o.parentId }))
  }

  /** Descendant CLUB orgs of a governing org (BFS down parent_id). */
  function descendantClubs(rootId: string, allOrgs: { id: string; org_level: string; parent_id: string | null; name?: string }[]) {
    const childrenOf = new Map<string, typeof allOrgs>()
    for (const o of allOrgs) {
      const arr = childrenOf.get(o.parent_id ?? '') ?? []
      arr.push(o); childrenOf.set(o.parent_id ?? '', arr)
    }
    const out: typeof allOrgs = []
    const queue = [...(childrenOf.get(rootId) ?? [])]
    const seen = new Set<string>()
    while (queue.length) {
      const o = queue.shift()!
      if (seen.has(o.id)) continue
      seen.add(o.id)
      if (o.org_level === 'CLUB') out.push(o)
      queue.push(...(childrenOf.get(o.id) ?? []))
    }
    return out
  }

  /** All grants defined at a governing org, grouped into per-person assignments. */
  async function loadAssignments(orgId: string): Promise<ManagerAssignment[]> {
    const grants = await api.managerGrants(orgId)
    const byPerson = new Map<string, ManagerAssignment>()
    for (const g of grants) {
      const name = g.personName || '—'
      let a = byPerson.get(g.personId)
      if (!a) { a = { personId: g.personId, personName: name, scope: 'clubs', clubIds: [], capabilities: [] }; byPerson.set(g.personId, a) }
      // Union capabilities across the person's rows.
      a.capabilities = [...new Set([...a.capabilities, ...(g.capabilities ?? [])])]
      if (g.targetOrgId === null) a.scope = 'subtree'
      else a.clubIds.push(g.targetOrgId)
    }
    return [...byPerson.values()]
  }

  /** Replace a person's grants at a governing org (delete-then-insert). */
  async function saveAssignment(orgId: string, a: ManagerAssignment): Promise<void> {
    const caps = a.capabilities
    const rows = a.scope === 'subtree'
      ? [{ targetOrgId: null, capabilities: caps }]
      : a.clubIds.map(cid => ({ targetOrgId: cid, capabilities: caps }))
    await api.saveManagerGrants(orgId, a.personId, rows)
  }

  /** Remove a person as a manager entirely. */
  async function removeAssignment(orgId: string, personId: string): Promise<void> {
    await api.removeManagerGrants(orgId, personId)
  }

  /**
   * The clubs the signed-in user may act on FROM the given governing org, with the
   * capability filter (e.g. 'report'). Resolves user→person by email at that org,
   * loads their grants, and expands a subtree grant to every descendant club.
   * Returns { clubs, capabilities } — capabilities = the union they hold.
   */
  async function myManagedClubs(orgId: string, capability?: string): Promise<{ clubs: { id: string; name: string }[]; capabilities: string[] }> {
    const email = user.value?.email
    if (!email || !orgId) return { clubs: [], capabilities: [] }
    // Resolve the signed-in user → person at this org by email (case-insensitive).
    const people = await peopleApi.list(orgId, { q: email })
    const lc = email.toLowerCase()
    const person = people.find(p => (p.email ?? '').toLowerCase() === lc)
    if (!person?.id) return { clubs: [], capabilities: [] }
    const grants = (await api.managerGrants(orgId)).filter(g => g.personId === person.id)
    if (!grants.length) return { clubs: [], capabilities: [] }
    const caps = [...new Set(grants.flatMap(g => g.capabilities ?? []))]
    if (capability && !caps.includes(capability)) return { clubs: [], capabilities: caps }
    const allOrgs = await loadAllOrgs()
    const nameById = new Map(allOrgs.map(o => [o.id, o.name]))
    const hasSubtree = grants.some(g => g.targetOrgId === null)
    let clubs: { id: string; name: string }[]
    if (hasSubtree) {
      clubs = descendantClubs(orgId, allOrgs).map(o => ({ id: o.id, name: (o as any).name }))
    } else {
      clubs = grants.filter(g => g.targetOrgId).map(g => ({ id: g.targetOrgId as string, name: nameById.get(g.targetOrgId as string) ?? '—' }))
    }
    return { clubs, capabilities: caps }
  }

  return { MANAGER_CAPABILITIES, loadAllOrgs, descendantClubs, loadAssignments, saveAssignment, removeAssignment, myManagedClubs }
}
