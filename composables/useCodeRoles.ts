// Code staff roles (migration 213). A club defines staff roles + permissions
// that apply to the groups and sub-codes inside a code.
//
// Two layers, combined:
//   * ORG-WIDE DEFAULTS (code_lineage_id null) — e.g. Manager, Coach — every code
//     gets these.
//   * PER-CODE roles (code_lineage_id set) — extra roles on a specific code (e.g.
//     Seniors adds Physio + Assistant coach). These CASCADE to every sub-code and
//     group inside that code.
// So a code's effective roles = defaults + the roles of its own lineage and all
// ancestor code lineages. Roles are keyed by a stable slug + code LINEAGE (not the
// per-term code id), so a code renamed/rolled over term-to-term keeps its config.

import type { GroupCode } from '~/composables/useGroupCodes'

export interface CodeCapability { key: string; label: string; description: string }

// The permissions a staff role can grant on a code's groups/sub-codes.
export const CODE_CAPABILITIES: CodeCapability[] = [
  { key: 'create_groups',  label: 'Create groups',  description: 'Add new groups within this code.' },
  { key: 'add_people',     label: 'Add people',     description: 'Add & remove members and staff in these groups.' },
  { key: 'see_history',    label: 'See history',    description: 'View past terms and rolled-over history.' },
  { key: 'see_financials', label: 'See financials', description: 'View fees, invoices and payment status.' },
  { key: 'communicate',    label: 'Communicate',    description: 'Email / message the people in these groups.' },
  { key: 'sub_groups',     label: 'Sub groups',     description: 'Create and manage sub-groups.' },
]

// Seeded the first time a club opens code settings.
export const DEFAULT_CODE_ROLES = [
  { key: 'manager', label: 'Manager', capabilities: CODE_CAPABILITIES.map(c => c.key) },
  { key: 'coach',   label: 'Coach',   capabilities: ['add_people', 'communicate', 'sub_groups'] },
]

export interface CodeRoleDef {
  id?: string
  org_id?: string
  code_lineage_id: string | null   // null = org-wide default
  key: string
  label: string
  capabilities: string[]
  sort_order: number
}

export function useCodeRoles() {
  const db = useDb()
  const { orgId } = useOrg()

  async function loadRoleDefs(): Promise<CodeRoleDef[]> {
    if (!orgId.value) return []
    const { data } = await (db.from as any)('code_role_defs')
      .select('id, org_id, code_lineage_id, key, label, capabilities, sort_order')
      .eq('org_id', orgId.value)
      .order('sort_order', { ascending: true, nullsFirst: false })
    return (data ?? []) as CodeRoleDef[]
  }

  // Seed the org-wide default roles if none exist yet. Returns the (re)loaded defs.
  async function ensureDefaults(existing?: CodeRoleDef[]): Promise<CodeRoleDef[]> {
    const defs = existing ?? await loadRoleDefs()
    if (defs.some(d => d.code_lineage_id == null)) return defs
    await (db.from as any)('code_role_defs').insert(
      DEFAULT_CODE_ROLES.map((r, i) => ({ org_id: orgId.value, code_lineage_id: null, key: r.key, label: r.label, capabilities: r.capabilities, sort_order: i })),
    )
    return loadRoleDefs()
  }

  // The lineage chain for a code: its own lineage + every ancestor code's lineage.
  function lineageChain(code: GroupCode, codesById: Record<string, GroupCode>): string[] {
    const chain: string[] = []
    let cur: GroupCode | undefined = code
    let guard = 0
    while (cur && guard++ < 50) {
      chain.push(codeLineage(cur))
      cur = cur.parent_id ? codesById[cur.parent_id] : undefined
    }
    return chain
  }

  // Effective roles for a code = org defaults + roles on its lineage/ancestor chain.
  // Each returned role carries `scope`: 'default' | 'own' (this code) | 'inherited'.
  function rolesForCode(code: GroupCode, codesById: Record<string, GroupCode>, defs: CodeRoleDef[]) {
    const ownLineage = codeLineage(code)
    const chain = new Set(lineageChain(code, codesById))
    return defs
      .filter(d => d.code_lineage_id == null || chain.has(d.code_lineage_id))
      .map(d => ({
        ...d,
        scope: d.code_lineage_id == null ? 'default' : (d.code_lineage_id === ownLineage ? 'own' : 'inherited'),
      }))
  }

  // Save the roles for one scope (a code lineage, or null for defaults) —
  // delete-then-insert scoped so it never clobbers other scopes.
  async function saveRolesForScope(codeLineageId: string | null, roles: CodeRoleDef[]): Promise<void> {
    let del: any = (db.from as any)('code_role_defs').delete().eq('org_id', orgId.value)
    del = codeLineageId == null ? del.is('code_lineage_id', null) : del.eq('code_lineage_id', codeLineageId)
    await del
    if (!roles.length) return
    await (db.from as any)('code_role_defs').insert(
      roles.map((r, i) => ({
        org_id: orgId.value,
        code_lineage_id: codeLineageId,
        key: r.key || slug(r.label),
        label: r.label.trim(),
        capabilities: r.capabilities ?? [],
        sort_order: i,
      })),
    )
  }

  function slug(label: string) {
    return (label || 'role').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'role'
  }

  return { CODE_CAPABILITIES, DEFAULT_CODE_ROLES, loadRoleDefs, ensureDefaults, rolesForCode, saveRolesForScope, lineageChain, slug }
}
