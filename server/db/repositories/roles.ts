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
import { asc, eq, isNull, or } from 'drizzle-orm'
import { db, schema } from '../client'
import type {
  ScopedRoleDef,
  PermissionGroup,
  CodeRoleDef,
  CodeStaff,
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
