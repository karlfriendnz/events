// The repository: the ONLY code that knows how person types & fields are stored.
// It turns DB rows into domain objects (the contract shape) and back. Nitro routes
// call these functions; they never touch Drizzle or the DB directly. When the
// backend team's MySQL API replaces this, only this file changes — routes,
// composables and UI are untouched.
import { asc, eq } from 'drizzle-orm'
import { db, schema } from '../client'
import type {
  PersonType,
  FieldDefinition,
  PersonTypeLink,
} from '../../../shared/contracts/personType'

// json columns come back parsed (object/array) from mysql2 in most cases, but can
// arrive as a JSON string. Normalise both robustly — never throw on bad json.
function asArray(v: any): any[] {
  if (Array.isArray(v)) return v
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function asObj(v: any): Record<string, any> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v
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

function typeToDomain(r: typeof schema.personTargetTypes.$inferSelect): PersonType {
  return {
    id: r.id,
    orgId: r.orgId ?? null,
    key: r.key,
    label: r.label,
    kind: r.kind,
    isAccess: !!r.isAccess,
    isPublished: !!r.isPublished,
    permissions: asObj(r.permissions),
    memberSlots: asArray(r.memberSlots),
    sortOrder: r.sortOrder,
  }
}

function fieldToDomain(r: typeof schema.fieldDefinitions.$inferSelect): FieldDefinition {
  // options is nullable in storage — keep null distinct from an empty list.
  const options = r.options == null ? null : asArray(r.options)
  return {
    id: r.id,
    orgId: r.orgId,
    label: r.label,
    fieldType: r.fieldType,
    options,
    isRequired: !!r.isRequired,
    target: r.target,
    targets: asArray(r.targets).map((t) => String(t)),
    sortOrder: r.sortOrder,
  }
}

function linkToDomain(r: typeof schema.personTypeLinks.$inferSelect): PersonTypeLink {
  return {
    id: r.id,
    orgId: r.orgId,
    typeId: r.typeId,
    sourceTypeId: r.sourceTypeId,
  }
}

export async function listPersonTypes(orgId: string): Promise<PersonType[]> {
  const rows = await db
    .select()
    .from(schema.personTargetTypes)
    .where(eq(schema.personTargetTypes.orgId, orgId))
    .orderBy(asc(schema.personTargetTypes.sortOrder))
  return rows.map(typeToDomain)
}

export async function listFieldDefinitions(orgId: string): Promise<FieldDefinition[]> {
  const rows = await db
    .select()
    .from(schema.fieldDefinitions)
    .where(eq(schema.fieldDefinitions.orgId, orgId))
    .orderBy(asc(schema.fieldDefinitions.sortOrder))
  return rows.map(fieldToDomain)
}

export async function listPersonTypeLinks(orgId: string): Promise<PersonTypeLink[]> {
  const rows = await db
    .select()
    .from(schema.personTypeLinks)
    .where(eq(schema.personTypeLinks.orgId, orgId))
  return rows.map(linkToDomain)
}
