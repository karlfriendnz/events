// The repository: the ONLY code that knows how circles, notes and entities are
// stored. It turns DB rows into domain objects (the contract shape). Nitro routes
// call these functions; they never touch Drizzle or the DB directly. When the
// backend team's MySQL API replaces this, only this file changes — routes,
// composables and UI are untouched.
//
// json handling: categories / tags / links / roles / custom_fields are `json`
// columns. mysql2 usually hands them back already parsed, but a driver/config can
// return the raw string — `asArray` / `asObj` normalise either (and never throw),
// so the domain always sees a real JS array/object. Booleans come off MySQL as
// tinyint 0/1; `!!` coerces them to real booleans. Timestamps → ISO via `toIso`.
import { randomUUID } from 'node:crypto'
import { asc, desc, eq } from 'drizzle-orm'
import { db, schema } from '../client'
import type {
  Circle,
  CircleMember,
  CommsPreference,
  Entity,
  EntityCreate,
  EntityPatch,
  EntityMember,
  PersonNote,
} from '../../../shared/contracts/circle'

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

// Serialise a timestamp to ISO 8601; null/undefined pass through as null.
function toIso(v: unknown): string | null {
  if (v == null) return null
  const d = v instanceof Date ? v : new Date(v as any)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function toCircle(r: typeof schema.circles.$inferSelect): Circle {
  return {
    id: r.id,
    orgId: r.orgId,
    name: r.name,
    kind: r.kind,
    color: r.color ?? null,
    imageUrl: r.imageUrl ?? null,
  }
}

function toCircleMember(r: typeof schema.circleMembers.$inferSelect): CircleMember {
  return {
    id: r.id,
    circleId: r.circleId,
    personId: r.personId,
    role: r.role,
    canBookFor: !!r.canBookFor,
    canView: !!r.canView,
    canRegister: !!r.canRegister,
    isLead: !!r.isLead,
    relationship: r.relationship ?? null,
    isPrimary: !!r.isPrimary,
    contactType: r.contactType ?? null,
    receivesComms: !!r.receivesComms,
    sortOrder: r.sortOrder,
  }
}

function toNote(r: typeof schema.personNotes.$inferSelect): PersonNote {
  return {
    id: r.id,
    orgId: r.orgId,
    personId: r.personId,
    body: r.body,
    tags: asArray(r.tags),
    channel: r.channel ?? null,
    authorId: r.authorId ?? null,
    authorName: r.authorName ?? null,
    links: Array.isArray(r.links) ? r.links : asArray(r.links),
    createdAt: toIso(r.createdAt) ?? '',
  }
}

function toEntity(r: typeof schema.entities.$inferSelect): Entity {
  return {
    id: r.id,
    orgId: r.orgId,
    typeKey: r.typeKey,
    name: r.name,
    customFields: asObj(r.customFields),
    status: r.status,
  }
}

function toEntityMember(r: typeof schema.entityMembers.$inferSelect): EntityMember {
  return {
    id: r.id,
    entityId: r.entityId,
    personId: r.personId,
    roles: asArray(r.roles),
  }
}

/** Every circle a person belongs to, via the circle_members join (author order). */
export async function listCirclesForPerson(personId: string): Promise<Circle[]> {
  if (!personId) return []
  const rows = await db
    .select({ c: schema.circles })
    .from(schema.circleMembers)
    .innerJoin(schema.circles, eq(schema.circleMembers.circleId, schema.circles.id))
    .where(eq(schema.circleMembers.personId, personId))
    .orderBy(asc(schema.circles.name))
  return rows.map((r) => toCircle(r.c))
}

/** The members of one circle, in sort order. */
export async function listCircleMembers(circleId: string): Promise<CircleMember[]> {
  if (!circleId) return []
  const rows = await db
    .select()
    .from(schema.circleMembers)
    .where(eq(schema.circleMembers.circleId, circleId))
    .orderBy(asc(schema.circleMembers.sortOrder))
  return rows.map(toCircleMember)
}

/** Comms preferences a recipient set on a subject's behalf, keyed to a person. */
export async function listCommsPreferences(personId: string): Promise<CommsPreference[]> {
  if (!personId) return []
  const rows = await db
    .select()
    .from(schema.commsPreferences)
    .where(eq(schema.commsPreferences.personId, personId))
  return rows.map((r) => ({
    id: r.id,
    orgId: r.orgId,
    personId: r.personId,
    subjectPersonId: r.subjectPersonId,
    categories: asArray(r.categories),
  }))
}

/** Every note on a person, newest first. */
export async function listNotes(personId: string): Promise<PersonNote[]> {
  if (!personId) return []
  const rows = await db
    .select()
    .from(schema.personNotes)
    .where(eq(schema.personNotes.personId, personId))
    .orderBy(desc(schema.personNotes.createdAt))
  return rows.map(toNote)
}

/** Every entity record an org has, in author order. */
export async function listEntities(orgId: string): Promise<Entity[]> {
  if (!orgId) return []
  const rows = await db
    .select()
    .from(schema.entities)
    .where(eq(schema.entities.orgId, orgId))
    .orderBy(asc(schema.entities.name))
  return rows.map(toEntity)
}

/** The roster of one entity — people attached with their roles, in sort order. */
export async function listEntityMembers(entityId: string): Promise<EntityMember[]> {
  if (!entityId) return []
  const rows = await db
    .select()
    .from(schema.entityMembers)
    .where(eq(schema.entityMembers.entityId, entityId))
    .orderBy(asc(schema.entityMembers.sortOrder))
  return rows.map(toEntityMember)
}

// ── Entity writes ──
// The repo owns the id. customFields (a json column) is JSON.stringify'd on the way
// IN, mirroring asObj on the way OUT. `as any`: the schema over-requires notNull
// columns without defaults AND the json column takes a stringified value here —
// consistent with the app's (db.from as any) idiom.
export async function getEntity(id: string): Promise<Entity | null> {
  const [r] = await db.select().from(schema.entities).where(eq(schema.entities.id, id)).limit(1)
  return r ? toEntity(r) : null
}

export async function createEntity(input: EntityCreate): Promise<Entity> {
  const id = randomUUID()
  await db.insert(schema.entities).values({
    id,
    orgId: input.orgId,
    typeKey: input.typeKey,
    name: input.name,
    customFields: input.customFields ?? {},
    status: input.status ?? 'active',
  } as any)
  return (await getEntity(id))!
}

export async function updateEntity(id: string, patch: EntityPatch): Promise<Entity | null> {
  const set: Record<string, any> = {}
  if (patch.orgId !== undefined) set.orgId = patch.orgId
  if (patch.typeKey !== undefined) set.typeKey = patch.typeKey
  if (patch.name !== undefined) set.name = patch.name
  if (patch.customFields !== undefined) set.customFields = patch.customFields
  if (patch.status !== undefined) set.status = patch.status
  if (Object.keys(set).length) await db.update(schema.entities).set(set).where(eq(schema.entities.id, id))
  return getEntity(id)
}

export async function deleteEntity(id: string): Promise<void> {
  await db.delete(schema.entities).where(eq(schema.entities.id, id))
}
