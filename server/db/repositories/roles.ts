// The repository: the ONLY code that knows how roles & permissions are stored. It
// turns DB rows into domain objects (the contract shape). Nitro routes call these
// functions; they never touch Drizzle or the DB directly. When the backend team's
// MySQL API replaces this, only this file changes — routes, composables and UI are
// untouched.
//
// json handling: capabilities / grants are `json` columns. mysql2 usually hands
// them back already parsed, but a driver/config can return the raw string —
// `asArray`/`asObj` normalise either into a real JS value (and never throw), so the
// domain always sees a string[] / plain object.
import { randomUUID } from 'node:crypto'
import { and, asc, eq, isNull, or } from 'drizzle-orm'
import { db, schema } from '../client'
import type {
  ScopedRoleDef,
  PermissionGroup,
  PermissionGroupCreate,
  PermissionGroupPatch,
  PermissionGroupMember,
  CodeRoleDef,
  CodeStaff,
  ScopedRoleDefCreate,
  ScopedRoleDefPatch,
} from '../../../shared/contracts/role'

// Coerce a json column into string[]: already an array → use it; a string → parse;
// anything else / a parse failure → [].
function asArray(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[]
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v)
      return Array.isArray(parsed) ? (parsed as string[]) : []
    } catch {
      return []
    }
  }
  return []
}

// Coerce a json column into a plain object: already an object → use it; a string →
// parse; anything else / a parse failure → {}.
function asObj(v: unknown): Record<string, any> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, any>
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }
  return {}
}

function toScopedRoleDef(r: typeof schema.scopedRoleDefs.$inferSelect): ScopedRoleDef {
  return {
    id: r.id,
    orgId: r.orgId,
    resourceType: r.resourceType,
    key: r.key,
    label: r.label,
    roleGroup: r.roleGroup,
    capabilities: asArray(r.capabilities),
    fieldType: r.fieldType ?? null,
    sortOrder: r.sortOrder,
  }
}

function toPermissionGroup(r: typeof schema.permissionGroups.$inferSelect): PermissionGroup {
  return {
    id: r.id,
    orgId: r.orgId ?? null,
    name: r.name,
    description: r.description ?? null,
    isCore: !!r.isCore,
    sourceGroupId: r.sourceGroupId ?? null,
    // domain `grants` is stored in the `permissions` column.
    grants: asObj(r.permissions),
    sortOrder: r.sortOrder,
  }
}

function toCodeRoleDef(r: typeof schema.codeRoleDefs.$inferSelect): CodeRoleDef {
  return {
    id: r.id,
    orgId: r.orgId,
    codeLineageId: r.codeLineageId ?? null,
    key: r.key,
    label: r.label,
    capabilities: asArray(r.capabilities),
    sortOrder: r.sortOrder ?? null,
  }
}

function toCodeStaff(r: typeof schema.codeStaff.$inferSelect): CodeStaff {
  return {
    id: r.id,
    orgId: r.orgId,
    codeLineageId: r.codeLineageId,
    personId: r.personId,
    roleKey: r.roleKey,
  }
}

/** Every scoped-role definition an org has, in author order. */
export async function listScopedRoleDefs(orgId: string): Promise<ScopedRoleDef[]> {
  const rows = await db
    .select()
    .from(schema.scopedRoleDefs)
    .where(eq(schema.scopedRoleDefs.orgId, orgId))
    .orderBy(asc(schema.scopedRoleDefs.sortOrder))
  return rows.map(toScopedRoleDef)
}

/**
 * The permission groups an org sees: its OWN rows PLUS the core templates (which are
 * shared platform-wide with org_id null) it inherits.
 */
export async function listPermissionGroups(orgId: string): Promise<PermissionGroup[]> {
  const rows = await db
    .select()
    .from(schema.permissionGroups)
    .where(or(eq(schema.permissionGroups.orgId, orgId), isNull(schema.permissionGroups.orgId)))
    .orderBy(asc(schema.permissionGroups.sortOrder))
  return rows.map(toPermissionGroup)
}

/** Code-role definitions — for one org, or (orgId omitted) the whole table. */
export async function listCodeRoleDefs(orgId?: string): Promise<CodeRoleDef[]> {
  const base = db.select().from(schema.codeRoleDefs)
  const rows = orgId
    ? await base.where(eq(schema.codeRoleDefs.orgId, orgId)).orderBy(asc(schema.codeRoleDefs.sortOrder))
    : await base.orderBy(asc(schema.codeRoleDefs.sortOrder))
  return rows.map(toCodeRoleDef)
}

/** Code-level staff assignments for an org. */
export async function listCodeStaff(orgId: string): Promise<CodeStaff[]> {
  const rows = await db
    .select()
    .from(schema.codeStaff)
    .where(eq(schema.codeStaff.orgId, orgId))
  return rows.map(toCodeStaff)
}

// ── Writes ── (scoped-role catalogue)
// The repo owns the id (MySQL can't default a uuid). `capabilities` is passed as a
// PLAIN JS ARRAY — drizzle's json() serialises it; DON'T JSON.stringify first or it
// stores a double-encoded string. `as any` mirrors the app's insert idiom (the
// first-pass schema over-requires notNull columns the DB defaults, e.g. sort_order).
export async function getScopedRoleDef(id: string): Promise<ScopedRoleDef | null> {
  const [r] = await db.select().from(schema.scopedRoleDefs).where(eq(schema.scopedRoleDefs.id, id)).limit(1)
  return r ? toScopedRoleDef(r) : null
}

export async function createScopedRoleDef(input: ScopedRoleDefCreate): Promise<ScopedRoleDef> {
  const id = randomUUID()
  await db.insert(schema.scopedRoleDefs).values({
    id,
    orgId: input.orgId,
    resourceType: input.resourceType,
    key: input.key,
    label: input.label,
    roleGroup: input.roleGroup,
    capabilities: input.capabilities ?? [],
    fieldType: input.fieldType ?? null,
    sortOrder: input.sortOrder ?? 0,
  } as any)
  return (await getScopedRoleDef(id))!
}

export async function updateScopedRoleDef(id: string, patch: ScopedRoleDefPatch): Promise<ScopedRoleDef | null> {
  const set: Record<string, any> = {}
  if (patch.orgId !== undefined) set.orgId = patch.orgId
  if (patch.resourceType !== undefined) set.resourceType = patch.resourceType
  if (patch.key !== undefined) set.key = patch.key
  if (patch.label !== undefined) set.label = patch.label
  if (patch.roleGroup !== undefined) set.roleGroup = patch.roleGroup
  if (patch.capabilities !== undefined) set.capabilities = patch.capabilities
  if (patch.fieldType !== undefined) set.fieldType = patch.fieldType
  if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder
  if (Object.keys(set).length) await db.update(schema.scopedRoleDefs).set(set).where(eq(schema.scopedRoleDefs.id, id))
  return getScopedRoleDef(id)
}

export async function deleteScopedRoleDef(id: string): Promise<void> {
  await db.delete(schema.scopedRoleDefs).where(eq(schema.scopedRoleDefs.id, id))
}

// The person ids who hold a (legacy) permission group in an org — used by the People
// directory's Admins tab to flag people with access via the old RBAC path.
// permission_group_members has no org_id, so scope by joining to permission_groups.
export async function listPermissionGroupMemberPersonIds(orgId: string): Promise<string[]> {
  const rows = await db
    .select({ personId: schema.permissionGroupMembers.personId })
    .from(schema.permissionGroupMembers)
    .innerJoin(schema.permissionGroups, eq(schema.permissionGroupMembers.groupId, schema.permissionGroups.id))
    .where(eq(schema.permissionGroups.orgId, orgId))
  return [...new Set(rows.map((r) => r.personId))]
}

// The permission GROUPS one person is directly assigned to (permission_group_members
// → permission_groups), each with its full grid. Backs the effective-permission union
// (useCan) AND the "has a legacy group?" admin check (useAccessLevel). NOT org-scoped:
// a person may be assigned to a core template (org_id null), and the original resolver
// fetched groups by id with no org filter — the caller already trusts the personId.
export async function listPermissionGroupsForPerson(personId: string): Promise<PermissionGroup[]> {
  const rows = await db
    .select({ g: schema.permissionGroups })
    .from(schema.permissionGroupMembers)
    .innerJoin(schema.permissionGroups, eq(schema.permissionGroupMembers.groupId, schema.permissionGroups.id))
    .where(eq(schema.permissionGroupMembers.personId, personId))
  return rows.map((r) => toPermissionGroup(r.g))
}

// ── Org permission-group writes (the club's own groups + overrides) ──
// Core templates (org_id null, is_core) are NEVER writable through these — every
// write is org-scoped in the WHERE, so a club can only touch its own rows.

async function getPermissionGroupById(id: string): Promise<PermissionGroup | null> {
  const [r] = await db.select().from(schema.permissionGroups).where(eq(schema.permissionGroups.id, id)).limit(1)
  return r ? toPermissionGroup(r) : null
}

/** Create one of the club's own permission groups (is_core false). `sourceGroupId`
 *  set = an override of a core template. sort_order appends after existing rows. */
export async function createPermissionGroup(input: PermissionGroupCreate): Promise<PermissionGroup> {
  const existing = await db
    .select({ id: schema.permissionGroups.id })
    .from(schema.permissionGroups)
    .where(eq(schema.permissionGroups.orgId, input.orgId))
  const id = randomUUID()
  await db.insert(schema.permissionGroups).values({
    id,
    orgId: input.orgId,
    name: input.name,
    description: input.description ?? null,
    // domain `grants` → the `permissions` json column (raw JS value, no stringify).
    permissions: input.grants ?? {},
    isSystem: false,
    isCore: false,
    sourceGroupId: input.sourceGroupId ?? null,
    sortOrder: existing.length,
  } as any)
  return (await getPermissionGroupById(id))!
}

/** Patch one of the club's own groups. Tenant-scoped (id AND org_id) so a core
 *  template can never be updated through here. */
export async function updatePermissionGroup(id: string, patch: PermissionGroupPatch): Promise<PermissionGroup | null> {
  const set: Record<string, any> = {}
  if (patch.name !== undefined) set.name = patch.name
  if (patch.description !== undefined) set.description = patch.description
  if (patch.grants !== undefined) set.permissions = patch.grants
  if (Object.keys(set).length) {
    set.updatedAt = new Date()
    await db
      .update(schema.permissionGroups)
      .set(set as any)
      .where(and(eq(schema.permissionGroups.id, id), eq(schema.permissionGroups.orgId, patch.orgId)))
  }
  return getPermissionGroupById(id)
}

/** Delete one of the club's own groups (tenant-scoped). Its members cascade via the
 *  set below being wiped first, then the group row. */
export async function deletePermissionGroup(id: string, orgId: string): Promise<void> {
  // Only proceed if the group belongs to this org (core templates are org_id null).
  const [owned] = await db
    .select({ id: schema.permissionGroups.id })
    .from(schema.permissionGroups)
    .where(and(eq(schema.permissionGroups.id, id), eq(schema.permissionGroups.orgId, orgId)))
    .limit(1)
  if (!owned) return
  await db.delete(schema.permissionGroupMembers).where(eq(schema.permissionGroupMembers.groupId, id))
  await db.delete(schema.permissionGroups).where(eq(schema.permissionGroups.id, id))
}

/** Every membership edge for the org's own groups (group → person). Core-template
 *  memberships aren't returned (the editor never assigns to a read-only core group).
 *  permission_group_members has no org_id, so it's scoped by joining to the group. */
export async function listPermissionGroupMembersByOrg(orgId: string): Promise<PermissionGroupMember[]> {
  const rows = await db
    .select({ groupId: schema.permissionGroupMembers.groupId, personId: schema.permissionGroupMembers.personId })
    .from(schema.permissionGroupMembers)
    .innerJoin(schema.permissionGroups, eq(schema.permissionGroupMembers.groupId, schema.permissionGroups.id))
    .where(eq(schema.permissionGroups.orgId, orgId))
  return rows.map((r) => ({ groupId: r.groupId, personId: r.personId }))
}

/** Replace a group's whole membership (delete-then-insert). Refuses unless the group
 *  belongs to `orgId` (tenant safety — the group id alone is never trusted). */
export async function setPermissionGroupMembers(groupId: string, orgId: string, personIds: string[]): Promise<void> {
  const [owned] = await db
    .select({ id: schema.permissionGroups.id })
    .from(schema.permissionGroups)
    .where(and(eq(schema.permissionGroups.id, groupId), eq(schema.permissionGroups.orgId, orgId)))
    .limit(1)
  if (!owned) return
  await db.delete(schema.permissionGroupMembers).where(eq(schema.permissionGroupMembers.groupId, groupId))
  const ids = [...new Set(personIds)]
  if (ids.length) {
    await db.insert(schema.permissionGroupMembers).values(ids.map((pid) => ({ groupId, personId: pid })) as any)
  }
}
