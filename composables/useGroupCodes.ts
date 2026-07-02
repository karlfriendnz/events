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
  sort_order: number
  created_at?: string
}

export function useGroupCodes() {
  const db = useDb()
  const { orgId } = useOrg()

  // All codes for the org, in sort order (then name) — shape callers into a tree.
  async function loadCodes(): Promise<GroupCode[]> {
    if (!orgId.value) return []
    const { data } = await (db.from as any)('group_codes')
      .select('id, org_id, name, color, parent_id, term_id, sort_order, created_at')
      .eq('org_id', orgId.value)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name')
    return (data ?? []) as GroupCode[]
  }

  async function createCode(patch: { name: string; color?: string | null; parent_id?: string | null; term_id?: string | null; sort_order?: number }): Promise<GroupCode | null> {
    const { data, error } = await (db.from as any)('group_codes').insert({
      org_id: orgId.value,
      name: patch.name.trim(),
      color: patch.color ?? null,
      parent_id: patch.parent_id ?? null,
      term_id: patch.term_id ?? null,
      sort_order: patch.sort_order ?? 0,
    }).select('id, org_id, name, color, parent_id, term_id, sort_order, created_at').single()
    if (error) return null
    return data as GroupCode
  }

  async function updateCode(id: string, patch: Partial<Pick<GroupCode, 'name' | 'color' | 'parent_id' | 'term_id' | 'sort_order'>>): Promise<void> {
    await (db.from as any)('group_codes').update(patch).eq('id', id)
  }

  // Delete a code, re-homing its contents to the deleted code's parent so nothing
  // is orphaned: child GROUPS move up to parent_id, child CODES re-parent likewise.
  async function deleteCode(id: string): Promise<void> {
    const { data: row } = await (db.from as any)('group_codes')
      .select('parent_id').eq('id', id).maybeSingle()
    const newParent = row?.parent_id ?? null
    await Promise.all([
      (db.from as any)('member_groups').update({ code_id: newParent }).eq('code_id', id),
      (db.from as any)('group_codes').update({ parent_id: newParent }).eq('parent_id', id),
    ])
    await (db.from as any)('group_codes').delete().eq('id', id)
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

  return { loadCodes, createCode, updateCode, deleteCode, effectiveTermId, treeOptions, closeSelection }
}
