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
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { db, schema } from '../client'
import type {
  Circle,
  CircleCreate,
  CircleMember,
  CircleMemberCreate,
  CircleMemberPatch,
  CircleMemberWithPerson,
  CirclePatch,
  CircleWithMembers,
  CommsPreference,
  CommsPreferenceUpsert,
  Entity,
  EntityCreate,
  EntityPatch,
  EntityMember,
  EntityMemberCreate,
  EntityMemberWithPerson,
  LinkedPerson,
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
    // Widened READ fields (dashboard gap D8) — the profile notes feed reads these.
    visibility: r.visibility ?? 'staff',
    visibleTo: Array.isArray(r.visibleTo) ? r.visibleTo : asArray(r.visibleTo),
    isImportant: !!r.isImportant,
    // date column → yyyy-mm-dd string (or null). MySQL date can come back as a Date.
    dueDate: r.dueDate == null ? null : (r.dueDate instanceof Date ? r.dueDate.toISOString().slice(0, 10) : String(r.dueDate)),
    createdAt: toIso(r.createdAt) ?? '',
  }
}

// A minimal person projection for hydrated reads (circle members / entity roster).
function toLinkedPerson(r: typeof schema.persons.$inferSelect | undefined): LinkedPerson {
  if (!r) return null
  return {
    id: r.id,
    firstName: r.firstName ?? null,
    lastName: r.lastName ?? null,
    email: r.email ?? null,
    phone: r.phone ?? null,
    photoUrl: r.photoUrl ?? null,
    personType: r.personType ?? null,
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

/**
 * Every circle in an org, each with its members hydrated (the member's person mini
 * projection). Powers the capability resolvers + the circles/contacts editor — one
 * read the composable filters per person. Three cheap queries assembled in code
 * (circles → members → persons) rather than a wide join, robust to a thin person row.
 */
export async function listCirclesForOrg(orgId: string): Promise<CircleWithMembers[]> {
  if (!orgId) return []
  const circleRows = await db
    .select()
    .from(schema.circles)
    .where(eq(schema.circles.orgId, orgId))
    .orderBy(asc(schema.circles.name))
  if (!circleRows.length) return []
  const circleIds = circleRows.map((c) => c.id)
  const memberRows = await db
    .select()
    .from(schema.circleMembers)
    .where(inArray(schema.circleMembers.circleId, circleIds))
    .orderBy(asc(schema.circleMembers.sortOrder))
  const personIds = [...new Set(memberRows.map((m) => m.personId))]
  const personRows = personIds.length
    ? await db.select().from(schema.persons).where(inArray(schema.persons.id, personIds))
    : []
  const personById = new Map(personRows.map((p) => [p.id, p]))
  const membersByCircle = new Map<string, CircleMemberWithPerson[]>()
  for (const m of memberRows) {
    const list = membersByCircle.get(m.circleId) ?? []
    list.push({ ...toCircleMember(m), person: toLinkedPerson(personById.get(m.personId)) })
    membersByCircle.set(m.circleId, list)
  }
  return circleRows.map((c) => ({ ...toCircle(c), members: membersByCircle.get(c.id) ?? [] }))
}

// ── Circle writes ──
// The repo owns the id + the flag defaults (a member's capability/contact flags are
// notNull tinyints; false unless the caller sets them). `as any`: the schema
// over-requires notNull cols without defaults — the DB fills created_at.
export async function createCircle(input: CircleCreate): Promise<Circle> {
  const id = randomUUID()
  await db.insert(schema.circles).values({
    id,
    orgId: input.orgId,
    name: input.name,
    kind: input.kind,
    color: input.color ?? null,
    imageUrl: input.imageUrl ?? null,
  } as any)
  const [r] = await db.select().from(schema.circles).where(eq(schema.circles.id, id)).limit(1)
  return toCircle(r)
}

export async function updateCircle(id: string, patch: CirclePatch): Promise<void> {
  const set: Record<string, any> = {}
  if (patch.name !== undefined) set.name = patch.name
  if (patch.color !== undefined) set.color = patch.color
  if (patch.imageUrl !== undefined) set.imageUrl = patch.imageUrl
  if (Object.keys(set).length) await db.update(schema.circles).set(set).where(eq(schema.circles.id, id))
}

export async function deleteCircle(id: string): Promise<void> {
  // Unlink everyone first (circle_members has no ON DELETE cascade in the schema),
  // then remove the circle itself.
  await db.delete(schema.circleMembers).where(eq(schema.circleMembers.circleId, id))
  await db.delete(schema.circles).where(eq(schema.circles.id, id))
}

// ── Circle member writes ──
export async function addCircleMember(input: CircleMemberCreate): Promise<CircleMember> {
  const id = randomUUID()
  await db.insert(schema.circleMembers).values({
    id,
    circleId: input.circleId,
    personId: input.personId,
    role: input.role,
    canBookFor: input.canBookFor ?? false,
    canView: input.canView ?? true,
    canRegister: input.canRegister ?? false,
    isLead: input.isLead ?? false,
    relationship: input.relationship ?? null,
    isPrimary: input.isPrimary ?? false,
    contactType: input.contactType ?? null,
    receivesComms: input.receivesComms ?? false,
    sortOrder: input.sortOrder ?? 0,
  } as any)
  const [r] = await db.select().from(schema.circleMembers).where(eq(schema.circleMembers.id, id)).limit(1)
  return toCircleMember(r)
}

export async function updateCircleMember(id: string, patch: CircleMemberPatch): Promise<void> {
  const set: Record<string, any> = {}
  if (patch.role !== undefined) set.role = patch.role
  if (patch.canBookFor !== undefined) set.canBookFor = patch.canBookFor
  if (patch.canView !== undefined) set.canView = patch.canView
  if (patch.canRegister !== undefined) set.canRegister = patch.canRegister
  if (patch.isLead !== undefined) set.isLead = patch.isLead
  if (patch.relationship !== undefined) set.relationship = patch.relationship
  if (patch.isPrimary !== undefined) set.isPrimary = patch.isPrimary
  if (patch.contactType !== undefined) set.contactType = patch.contactType
  if (patch.receivesComms !== undefined) set.receivesComms = patch.receivesComms
  if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder
  if (Object.keys(set).length) await db.update(schema.circleMembers).set(set).where(eq(schema.circleMembers.id, id))
}

export async function removeCircleMember(id: string): Promise<void> {
  await db.delete(schema.circleMembers).where(eq(schema.circleMembers.id, id))
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

/** The inverse view: everyone who receives a given subject's comms, with their
 *  chosen categories. Powers "who gets what on my behalf" on the subject's profile. */
export async function listCommsPreferencesForSubject(subjectPersonId: string): Promise<CommsPreference[]> {
  if (!subjectPersonId) return []
  const rows = await db
    .select()
    .from(schema.commsPreferences)
    .where(eq(schema.commsPreferences.subjectPersonId, subjectPersonId))
  return rows.map((r) => ({
    id: r.id,
    orgId: r.orgId,
    personId: r.personId,
    subjectPersonId: r.subjectPersonId,
    categories: asArray(r.categories),
  }))
}

/**
 * Upsert a comms preference on the (personId, subjectPersonId) pair. Done as a manual
 * select-then-write rather than onDuplicateKeyUpdate — robust whether or not the
 * (person_id, subject_person_id) unique index made it into the MySQL schema. categories
 * (a json column) takes the RAW JS array (never JSON.stringify — Drizzle double-encodes).
 */
export async function setCommsPreference(input: CommsPreferenceUpsert): Promise<void> {
  const [existing] = await db
    .select({ id: schema.commsPreferences.id })
    .from(schema.commsPreferences)
    .where(
      and(
        eq(schema.commsPreferences.personId, input.personId),
        eq(schema.commsPreferences.subjectPersonId, input.subjectPersonId),
      ),
    )
    .limit(1)
  if (existing) {
    await db
      .update(schema.commsPreferences)
      .set({ categories: input.categories } as any)
      .where(eq(schema.commsPreferences.id, existing.id))
  } else {
    await db.insert(schema.commsPreferences).values({
      id: randomUUID(),
      orgId: input.orgId,
      personId: input.personId,
      subjectPersonId: input.subjectPersonId,
      categories: input.categories,
    } as any)
  }
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

/** Notes for a SET of people (roster note-count badges), newest first. Empty in →
 *  empty out; the caller buckets by personId. */
export async function listNotesForPeople(personIds: string[]): Promise<PersonNote[]> {
  if (!personIds.length) return []
  const rows = await db
    .select()
    .from(schema.personNotes)
    .where(inArray(schema.personNotes.personId, personIds))
    .orderBy(desc(schema.personNotes.createdAt))
  return rows.map(toNote)
}

/** Every entity record an org has (optionally one type), newest first. */
export async function listEntities(orgId: string, typeKey?: string): Promise<Entity[]> {
  if (!orgId) return []
  const where = typeKey
    ? and(eq(schema.entities.orgId, orgId), eq(schema.entities.typeKey, typeKey))
    : eq(schema.entities.orgId, orgId)
  const rows = await db
    .select()
    .from(schema.entities)
    .where(where)
    .orderBy(desc(schema.entities.createdAt))
  return rows.map(toEntity)
}

/** { [entityId]: attach count } across an org's entity roster — the directory badge. */
export async function entityMemberCounts(orgId: string): Promise<Record<string, number>> {
  if (!orgId) return {}
  const rows = await db
    .select({ entityId: schema.entityMembers.entityId })
    .from(schema.entityMembers)
    .where(eq(schema.entityMembers.orgId, orgId))
  const out: Record<string, number> = {}
  for (const r of rows) out[r.entityId] = (out[r.entityId] ?? 0) + 1
  return out
}

/** The roster of one entity with each attached person hydrated (name + contact). */
export async function listEntityMembersHydrated(entityId: string): Promise<EntityMemberWithPerson[]> {
  if (!entityId) return []
  const memberRows = await db
    .select()
    .from(schema.entityMembers)
    .where(eq(schema.entityMembers.entityId, entityId))
    .orderBy(asc(schema.entityMembers.sortOrder))
  const personIds = [...new Set(memberRows.map((m) => m.personId))]
  const personRows = personIds.length
    ? await db.select().from(schema.persons).where(inArray(schema.persons.id, personIds))
    : []
  const personById = new Map(personRows.map((p) => [p.id, p]))
  return memberRows.map((m) => ({
    id: m.id,
    entityId: m.entityId,
    personId: m.personId,
    roles: asArray(m.roles),
    sortOrder: m.sortOrder,
    person: toLinkedPerson(personById.get(m.personId)),
  }))
}

// ── Entity member writes ──
export async function addEntityMember(input: EntityMemberCreate): Promise<EntityMember> {
  const id = randomUUID()
  await db.insert(schema.entityMembers).values({
    id,
    orgId: input.orgId,
    entityId: input.entityId,
    personId: input.personId,
    roles: input.roles ?? [],
    sortOrder: input.sortOrder ?? 0,
  } as any)
  const [r] = await db.select().from(schema.entityMembers).where(eq(schema.entityMembers.id, id)).limit(1)
  return toEntityMember(r)
}

export async function updateEntityMember(id: string, roles: string[]): Promise<void> {
  // roles (a json column) takes the RAW JS array — never JSON.stringify.
  await db.update(schema.entityMembers).set({ roles } as any).where(eq(schema.entityMembers.id, id))
}

export async function removeEntityMember(id: string): Promise<void> {
  await db.delete(schema.entityMembers).where(eq(schema.entityMembers.id, id))
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
