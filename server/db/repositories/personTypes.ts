// The repository: the ONLY code that knows how person types & fields are stored.
// It turns DB rows into domain objects (the contract shape) and back. Nitro routes
// call these functions; they never touch Drizzle or the DB directly. When the
// backend team's MySQL API replaces this, only this file changes — routes,
// composables and UI are untouched.
import { randomUUID } from 'node:crypto'
import { asc, eq } from 'drizzle-orm'
import { db, schema } from '../client'
import type {
  PersonType,
  PersonTypeCreate,
  PersonTypePatch,
  FieldDefinition,
  FieldDefinitionCreate,
  FieldDefinitionPatch,
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

// ── Person-type writes ──
// The repo owns the id. json columns (permissions, memberSlots) are JSON.stringify'd
// on the way IN, mirroring asObj/asArray on the way OUT. `as any`: the schema
// over-requires notNull columns without defaults AND the json columns take a
// stringified value here — matches the app's (db.from as any) idiom.
export async function getPersonType(id: string): Promise<PersonType | null> {
  const [r] = await db
    .select()
    .from(schema.personTargetTypes)
    .where(eq(schema.personTargetTypes.id, id))
    .limit(1)
  return r ? typeToDomain(r) : null
}

export async function createPersonType(input: PersonTypeCreate): Promise<PersonType> {
  const id = randomUUID()
  await db.insert(schema.personTargetTypes).values({
    id,
    orgId: input.orgId ?? null,
    key: input.key,
    label: input.label,
    kind: input.kind ?? 'person',
    isAccess: input.isAccess ?? false,
    isPublished: input.isPublished ?? false,
    permissions: input.permissions ?? {},
    memberSlots: input.memberSlots ?? [],
    sortOrder: input.sortOrder ?? 0,
    // notNull columns absent from the contract — supplied with sensible defaults.
    minCount: 0,
    isGlobal: false,
  } as any)
  return (await getPersonType(id))!
}

export async function updatePersonType(id: string, patch: PersonTypePatch): Promise<PersonType | null> {
  const set: Record<string, any> = {}
  if (patch.orgId !== undefined) set.orgId = patch.orgId
  if (patch.key !== undefined) set.key = patch.key
  if (patch.label !== undefined) set.label = patch.label
  if (patch.kind !== undefined) set.kind = patch.kind
  if (patch.isAccess !== undefined) set.isAccess = patch.isAccess
  if (patch.isPublished !== undefined) set.isPublished = patch.isPublished
  if (patch.permissions !== undefined) set.permissions = patch.permissions
  if (patch.memberSlots !== undefined) set.memberSlots = patch.memberSlots
  if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder
  if (Object.keys(set).length)
    await db.update(schema.personTargetTypes).set(set).where(eq(schema.personTargetTypes.id, id))
  return getPersonType(id)
}

export async function deletePersonType(id: string): Promise<void> {
  await db.delete(schema.personTargetTypes).where(eq(schema.personTargetTypes.id, id))
}

// ── Field-definition writes ──
// Same shape: repo owns the id; options (nullable) + targets are JSON.stringify'd,
// and the notNull json columns absent from the contract (rules, meta) default empty.
export async function getFieldDefinition(id: string): Promise<FieldDefinition | null> {
  const [r] = await db
    .select()
    .from(schema.fieldDefinitions)
    .where(eq(schema.fieldDefinitions.id, id))
    .limit(1)
  return r ? fieldToDomain(r) : null
}

export async function createFieldDefinition(input: FieldDefinitionCreate): Promise<FieldDefinition> {
  const id = randomUUID()
  const targets = input.targets ?? []
  await db.insert(schema.fieldDefinitions).values({
    id,
    orgId: input.orgId,
    label: input.label,
    fieldType: input.fieldType,
    // options is nullable — keep null distinct from an empty list.
    options: input.options == null ? null : input.options,
    isRequired: input.isRequired ?? false,
    target: input.target ?? targets[0] ?? '',
    targets: targets,
    sortOrder: input.sortOrder ?? 0,
    // notNull json columns absent from the contract — default to empty.
    rules: [],
    meta: {},
  } as any)
  return (await getFieldDefinition(id))!
}

export async function updateFieldDefinition(id: string, patch: FieldDefinitionPatch): Promise<FieldDefinition | null> {
  const set: Record<string, any> = {}
  if (patch.orgId !== undefined) set.orgId = patch.orgId
  if (patch.label !== undefined) set.label = patch.label
  if (patch.fieldType !== undefined) set.fieldType = patch.fieldType
  if (patch.options !== undefined) set.options = patch.options == null ? null : patch.options
  if (patch.isRequired !== undefined) set.isRequired = patch.isRequired
  if (patch.target !== undefined) set.target = patch.target
  if (patch.targets !== undefined) set.targets = patch.targets
  if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder
  if (Object.keys(set).length)
    await db.update(schema.fieldDefinitions).set(set).where(eq(schema.fieldDefinitions.id, id))
  return getFieldDefinition(id)
}

export async function deleteFieldDefinition(id: string): Promise<void> {
  await db.delete(schema.fieldDefinitions).where(eq(schema.fieldDefinitions.id, id))
}
