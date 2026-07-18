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
  // Converted to the /api/v1 seam (server/db/repositories/groups.ts, which is already
  // the writer of code_role_defs + code_staff via deleteCode). No useDb: every call is
  // a typed $fetch to a /api/v1/code-roles route. The seam returns camelCase; we map
  // back to the snake_case CodeRoleDef/CodeStaff shapes the code pages read, unchanged.
  const { orgId } = useOrg()

  const toDef = (d: any): CodeRoleDef => ({
    id: d.id, org_id: d.orgId, code_lineage_id: d.codeLineageId ?? null,
    key: d.key, label: d.label, capabilities: d.capabilities ?? [], sort_order: d.sortOrder ?? 0,
  })

  async function loadRoleDefs(): Promise<CodeRoleDef[]> {
    if (!orgId.value) return []
    const rows = await $fetch<any[]>('/api/v1/code-roles', { query: { orgId: orgId.value } })
    return (rows ?? []).map(toDef)
  }

  // Seed the org-wide default roles if none exist yet. Returns the (re)loaded defs.
  async function ensureDefaults(_existing?: CodeRoleDef[]): Promise<CodeRoleDef[]> {
    if (!orgId.value) return []
    const rows = await $fetch<any[]>('/api/v1/code-roles/ensure-defaults', {
      method: 'POST',
      body: { orgId: orgId.value, defaults: DEFAULT_CODE_ROLES },
    })
    return (rows ?? []).map(toDef)
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
    await $fetch('/api/v1/code-roles/save-scope', {
      method: 'POST',
      body: {
        orgId: orgId.value,
        codeLineageId,
        roles: roles.map(r => ({ key: r.key || slug(r.label), label: r.label.trim(), capabilities: r.capabilities ?? [] })),
      },
    })
  }

  function slug(label: string) {
    return (label || 'role').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'role'
  }

  // ── Staff assignments (who holds each role on a code) ──
  async function loadStaff(): Promise<CodeStaff[]> {
    if (!orgId.value) return []
    const rows = await $fetch<any[]>('/api/v1/code-roles/staff', { query: { orgId: orgId.value } })
    return (rows ?? []).map((s): CodeStaff => ({
      id: s.id, code_lineage_id: s.codeLineageId, person_id: s.personId, role_key: s.roleKey,
      person: s.person
        ? { id: s.person.id, first_name: s.person.firstName ?? null, last_name: s.person.lastName ?? null, email: s.person.email ?? null }
        : undefined,
    }))
  }
  async function assignStaff(codeLineageId: string, personId: string, roleKey: string): Promise<void> {
    await $fetch('/api/v1/code-roles/assign-staff', {
      method: 'POST', body: { orgId: orgId.value, codeLineageId, personId, roleKey },
    })
  }
  async function removeStaff(id: string): Promise<void> {
    await $fetch('/api/v1/code-roles/remove-staff', { method: 'POST', body: { id } })
  }
  // Staff on a code = assignments on its lineage + ancestor lineages. Each carries
  // `scope` ('own' | 'inherited') + the ancestor label when inherited.
  function staffForCode(code: GroupCode, codesById: Record<string, GroupCode>, staff: CodeStaff[], allCodes: GroupCode[]) {
    const own = codeLineage(code)
    const chain = new Set(lineageChain(code, codesById))
    const labelFor = (l: string) => allCodes.find(c => codeLineage(c) === l)?.name ?? 'Parent'
    return staff.filter(s => chain.has(s.code_lineage_id)).map(s => ({
      ...s,
      scope: s.code_lineage_id === own ? 'own' : 'inherited',
      fromLabel: s.code_lineage_id === own ? '' : labelFor(s.code_lineage_id),
    }))
  }

  return { CODE_CAPABILITIES, DEFAULT_CODE_ROLES, loadRoleDefs, ensureDefaults, rolesForCode, saveRolesForScope, lineageChain, slug, loadStaff, assignStaff, removeStaff, staffForCode }
}

export interface CodeStaff {
  id: string
  code_lineage_id: string
  person_id: string
  role_key: string
  person?: { id: string; first_name: string | null; last_name: string | null; email: string | null }
}
