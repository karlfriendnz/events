// Group codes — hierarchical containers that hold member groups and carry
// properties the groups inside them inherit (migration 205).
//
// A CODE replaces the old member_groups.parent_id nesting: a group belongs to
// exactly one code (member_groups.code_id) and codes themselves nest
// (group_codes.parent_id). For now the only inherited property is TERM
// (term_id → org_terms); effectiveTermId() walks the code parent chain so a
// child code with no term of its own inherits its parent's, falling back to the
// group's own term_id. More inheritable properties can be added as columns
// later without changing this contract.

export interface GroupCode {
  id: string
  org_id?: string
  name: string
  color: string | null
  parent_id: string | null
  term_id: string | null
  // The SPORT this programme belongs to (org_sports id, mig 238) — inherited down the chain
  sport_id?: string | null
  sort_order: number
  created_at?: string
  member_type_key?: string | null
  lineage_id?: string | null
  // Per-role minimum people per group in this code — { roleKey: minCount }.
  // Resolved closest-wins up the code parent chain (migration 215).
  role_minimums?: Record<string, number> | null
  // Member POSITIONS available to groups in this code (Captain, Wing…) — a
  // catalogue, resolved as the UNION up the code chain (migration 216).
  member_positions?: string[] | null
  // Per-position minimum people per group — { position: minCount }. Resolved
  // closest-wins up the code parent chain (migration 217).
  position_minimums?: Record<string, number> | null
}

// A code's stable identity across term rollovers (falls back to its own id).
export const codeLineage = (c: { id: string; lineage_id?: string | null }) => c.lineage_id ?? c.id

export function useGroupCodes() {
  const { orgId } = useOrg()
  const api = useGroupsApi()
  const orgsApi = useOrganisationsApi()

  // camelCase contract → this composable's snake_case GroupCode shape.
  function toSnake(c: any): GroupCode {
    return {
      id: c.id,
      org_id: c.orgId,
      name: c.name,
      color: c.color ?? null,
      parent_id: c.parentId ?? null,
      term_id: c.termId ?? null,
      sport_id: c.sportId ?? null,
      sort_order: c.sortOrder ?? 0,
      member_type_key: c.memberTypeKey ?? null,
      lineage_id: c.lineageId ?? null,
      role_minimums: c.roleMinimums ?? {},
      member_positions: c.memberPositions ?? [],
      position_minimums: c.positionMinimums ?? {},
    }
  }

  // Org-wide DEFAULT positions (Member, …) every group inherits (migration 217).
  const defaultPositions = useState<string[]>('fm_default_positions', () => [])
  const defaultPositionsLoaded = useState<boolean>('fm_default_positions_loaded', () => false)
  async function loadDefaultPositions(force = false): Promise<string[]> {
    if (defaultPositionsLoaded.value && !force) return defaultPositions.value
    if (!orgId.value) return []
    defaultPositions.value = await orgsApi.getDefaultPositions(orgId.value)
    defaultPositionsLoaded.value = true
    return defaultPositions.value
  }
  async function saveDefaultPositions(list: string[]): Promise<void> {
    if (!orgId.value) return
    const clean = list.map(p => p.trim()).filter(Boolean)
    await orgsApi.setDefaultPositions(orgId.value, clean)
    defaultPositions.value = clean
    defaultPositionsLoaded.value = true
  }

  // All codes for the org, in sort order (then name) — shape callers into a tree.
  async function loadCodes(): Promise<GroupCode[]> {
    if (!orgId.value) return []
    const codes = await api.codes(orgId.value)
    return codes.map(toSnake)
  }

  async function createCode(patch: { name: string; color?: string | null; parent_id?: string | null; term_id?: string | null; sort_order?: number }): Promise<GroupCode | null> {
    try {
      const created = await api.createCode({
        orgId: orgId.value,
        name: patch.name.trim(),
        color: patch.color ?? null,
        parentId: patch.parent_id ?? null,
        termId: patch.term_id ?? null,
        sortOrder: patch.sort_order ?? 0,
      })
      return toSnake(created)
    } catch {
      return null
    }
  }

  async function updateCode(id: string, patch: Partial<Pick<GroupCode, 'name' | 'color' | 'parent_id' | 'term_id' | 'sort_order' | 'member_type_key' | 'role_minimums' | 'member_positions' | 'position_minimums'>>): Promise<void> {
    const camel: Record<string, any> = {}
    if (patch.name !== undefined) camel.name = patch.name
    if (patch.color !== undefined) camel.color = patch.color
    if (patch.parent_id !== undefined) camel.parentId = patch.parent_id
    if (patch.term_id !== undefined) camel.termId = patch.term_id
    if (patch.sort_order !== undefined) camel.sortOrder = patch.sort_order
    if (patch.member_type_key !== undefined) camel.memberTypeKey = patch.member_type_key
    if (patch.role_minimums !== undefined) camel.roleMinimums = patch.role_minimums
    if (patch.member_positions !== undefined) camel.memberPositions = patch.member_positions
    if (patch.position_minimums !== undefined) camel.positionMinimums = patch.position_minimums
    await api.updateCode(id, camel)
  }

  // Delete a code — the seam re-homes its contents to the parent (child groups +
  // child codes) and drops the code's own role/staff config (mig 213/214).
  async function deleteCode(id: string): Promise<void> {
    await api.removeCode(id)
  }

  // The term a group actually runs on: its code's term_id, walking up the code
  // parent chain while null, then falling back to the group's own term_id.
  function effectiveTermId(
    group: { code_id?: string | null; term_id?: string | null } | null | undefined,
    codesById: Record<string, GroupCode>,
  ): string | null {
    let codeId = group?.code_id ?? null
    let guard = 0
    while (codeId && guard++ < 20) {
      const code = codesById[codeId]
      if (!code) break
      if (code.term_id) return code.term_id
      codeId = code.parent_id
    }
    return group?.term_id ?? null
  }

  // The member (person) type a group captures: its code's member_type_key,
  // walking up the code parent chain while null. Drives which custom fields
  // members in the group's code get (migration 213).
  function effectiveMemberType(
    group: { code_id?: string | null } | null | undefined,
    codesById: Record<string, GroupCode>,
  ): string | null {
    let codeId = group?.code_id ?? null
    let guard = 0
    while (codeId && guard++ < 20) {
      const code = codesById[codeId]
      if (!code) break
      if (code.member_type_key) return code.member_type_key
      codeId = code.parent_id
    }
    return null
  }

  // The minimum #-of-people-per-role a group should have, resolved CLOSEST-WINS
  // up the code parent chain: start at the group's code and walk to the root,
  // keeping the first value seen for each role key. So a child code's "Coach: 1"
  // overrides a parent code's "Coach: 2" (migration 215).
  // The sport a group belongs to — its code chain's sport_id, closest wins (mig 238).
  function effectiveSportId(
    group: { code_id?: string | null } | null | undefined,
    codesById: Record<string, GroupCode>,
  ): string | null {
    let codeId = group?.code_id ?? null
    let guard = 0
    while (codeId && guard++ < 20) {
      const code = codesById[codeId]
      if (!code) break
      if (code.sport_id) return code.sport_id
      codeId = code.parent_id
    }
    return null
  }

  function effectiveRoleMins(
    group: { code_id?: string | null } | null | undefined,
    codesById: Record<string, GroupCode>,
  ): Record<string, number> {
    const out: Record<string, number> = {}
    let codeId = group?.code_id ?? null
    let guard = 0
    while (codeId && guard++ < 20) {
      const code = codesById[codeId]
      if (!code) break
      const mins = code.role_minimums || {}
      for (const [k, v] of Object.entries(mins)) {
        if (!(k in out) && typeof v === 'number' && v > 0) out[k] = v
      }
      codeId = code.parent_id
    }
    return out
  }

  // The member positions available to a group (Captain, Wing…): the UNION of its
  // code's catalogue, every ancestor code's, and the org-wide DEFAULT positions —
  // deduped case-insensitively, code positions first then defaults (migrations
  // 216 + 217). Reads the shared `defaultPositions` state (loadDefaultPositions()).
  function effectivePositions(
    group: { code_id?: string | null } | null | undefined,
    codesById: Record<string, GroupCode>,
  ): string[] {
    const out: string[] = []
    const seen = new Set<string>()
    const push = (p: string) => { const k = p.trim().toLowerCase(); if (p.trim() && !seen.has(k)) { seen.add(k); out.push(p.trim()) } }
    let codeId = group?.code_id ?? null
    let guard = 0
    while (codeId && guard++ < 20) {
      const code = codesById[codeId]
      if (!code) break
      for (const p of (code.member_positions || [])) push(p)
      codeId = code.parent_id
    }
    for (const p of defaultPositions.value) push(p)
    return out
  }

  // Per-position minimum people per group, resolved closest-wins up the code
  // chain (mirrors effectiveRoleMins; migration 217).
  function effectivePositionMins(
    group: { code_id?: string | null } | null | undefined,
    codesById: Record<string, GroupCode>,
  ): Record<string, number> {
    const out: Record<string, number> = {}
    let codeId = group?.code_id ?? null
    let guard = 0
    while (codeId && guard++ < 20) {
      const code = codesById[codeId]
      if (!code) break
      for (const [k, v] of Object.entries(code.position_minimums || {})) {
        if (!(k in out) && typeof v === 'number' && v > 0) out[k] = v
      }
      codeId = code.parent_id
    }
    return out
  }

  // Add a position to a code's own catalogue (idempotent, case-insensitive).
  // Returns the updated list, or null if it already existed / no code.
  async function addPositionToCode(codeId: string, position: string, codesById: Record<string, GroupCode>): Promise<string[] | null> {
    const name = position.trim()
    const code = codesById[codeId]
    if (!name || !code) return null
    const existing = code.member_positions || []
    if (existing.some(p => p.trim().toLowerCase() === name.toLowerCase())) return null
    const next = [...existing, name]
    await updateCode(codeId, { member_positions: next })
    return next
  }

  // Indented { label, value } options for EVERY code (any depth) — for pickers
  // where the user chooses any code, not just top-level ones. Uses nbsp for
  // indentation so the hierarchy shows in the dropdown (regular spaces collapse).
  function treeOptions(all: GroupCode[]): { label: string; value: string }[] {
    const byParent: Record<string, GroupCode[]> = {}
    const sorted = [...all].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name))
    for (const c of sorted) (byParent[c.parent_id && all.some(x => x.id === c.parent_id) ? c.parent_id : '__root'] ??= []).push(c)
    const out: { label: string; value: string }[] = []
    const walk = (key: string, depth: number) => {
      for (const c of (byParent[key] ?? [])) { out.push({ label: `${'  '.repeat(depth)}${c.name}`, value: c.id }); walk(c.id, depth + 1) }
    }
    walk('__root', 0)
    return out
  }

  // Expand a code selection to include every descendant of a selected code, so
  // a stored `[parent]` shows the whole subtree as checked+locked in the picker.
  function closeSelection(ids: string[], all: GroupCode[]): string[] {
    const childrenMap: Record<string, string[]> = {}
    for (const c of all) {
      const p = c.parent_id && all.some(x => x.id === c.parent_id) ? c.parent_id : null
      if (p) (childrenMap[p] ??= []).push(c.id)
    }
    const set = new Set(ids)
    const stack = [...ids]
    let guard = 0
    while (stack.length && guard++ < 5000) {
      const cur = stack.pop()!
      for (const ch of (childrenMap[cur] ?? [])) if (!set.has(ch)) { set.add(ch); stack.push(ch) }
    }
    return [...set]
  }

  return { loadCodes, createCode, updateCode, deleteCode, effectiveTermId, effectiveMemberType, effectiveSportId, effectiveRoleMins, effectivePositions, effectivePositionMins, addPositionToCode, defaultPositions, loadDefaultPositions, saveDefaultPositions, treeOptions, closeSelection }
}
