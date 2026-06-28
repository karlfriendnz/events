// Organisation hierarchy helpers (Club -> Regional -> Association -> National).
// Backed by the Postgres recursive functions org_ancestors() / org_descendants()
// from migration 134, plus a pure client-side chain builder for UI display.

export interface OrgNode {
  id: string
  name: string
  type?: string | null
  org_level: 'CLUB' | 'REGIONAL' | 'ASSOCIATION' | 'NATIONAL' | 'RST'
  parent_id: string | null
  depth?: number
}

export const ORG_LEVELS = ['CLUB', 'REGIONAL', 'ASSOCIATION', 'NATIONAL'] as const
// All selectable org types, including RST (a partner org — see isGoverningBody).
export const ORG_TYPE_OPTIONS = [...ORG_LEVELS, 'RST'] as const

// Governing bodies sit in the club → national chain. RST and CLUB do not, so
// they're excluded from affiliation / discipline "governing body" lists.
export function isGoverningBody(level: string | null | undefined): boolean {
  return level === 'REGIONAL' || level === 'ASSOCIATION' || level === 'NATIONAL'
}

export function orgLevelRank(level: string | null | undefined): number {
  const i = (ORG_LEVELS as readonly string[]).indexOf(level ?? 'CLUB')
  return i < 0 ? 0 : i
}

export function orgLevelLabel(level: string | null | undefined): string {
  switch (level) {
    case 'NATIONAL': return 'National'
    case 'ASSOCIATION': return 'Association'
    case 'REGIONAL': return 'Regional'
    case 'RST': return 'RST'
    default: return 'Club'
  }
}

export function useOrgHierarchy() {
  const db = useDb()

  /** Ancestors (immediate parent first, increasing upward). Excludes self. */
  async function ancestors(orgId: string): Promise<OrgNode[]> {
    const { data, error } = await (db.rpc as any)('org_ancestors', { p_org: orgId })
    if (error) { console.error('[useOrgHierarchy] ancestors', error); return [] }
    return (data ?? []) as OrgNode[]
  }

  /** Descendants (direct children first, increasing downward). Excludes self. */
  async function descendants(orgId: string): Promise<OrgNode[]> {
    const { data, error } = await (db.rpc as any)('org_descendants', { p_org: orgId })
    if (error) { console.error('[useOrgHierarchy] descendants', error); return [] }
    return (data ?? []) as OrgNode[]
  }

  /**
   * Build the full chain (top org first … self last) by walking parent_id over an
   * already-loaded set of orgs. Pure + synchronous — used for UI display so the
   * Settings page doesn't need an RPC round-trip. Cycle-safe.
   */
  function buildChain(orgId: string, allOrgs: OrgNode[]): OrgNode[] {
    const byId = new Map(allOrgs.map(o => [o.id, o]))
    const chain: OrgNode[] = []
    const seen = new Set<string>()
    let cur: OrgNode | undefined = byId.get(orgId)
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id)
      chain.unshift(cur) // prepend so the top-most ancestor ends up first
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined
    }
    return chain
  }

  /** Ids of an org + all its descendants — the read/reporting scope for a parent org. */
  async function descendantScope(orgId: string): Promise<string[]> {
    const desc = await descendants(orgId)
    return [orgId, ...desc.map(d => d.id)]
  }

  return { ancestors, descendants, buildChain, descendantScope }
}
