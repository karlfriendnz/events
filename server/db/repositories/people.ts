// The repository: the ONLY code that knows how people are stored. It turns DB rows
// into domain objects (the contract shape) and back. Nitro routes call these
// functions; they never touch Drizzle or the DB directly. When the backend team's
// MySQL API replaces this, only this file changes — routes, composables and UI are
// untouched.
import { randomUUID } from 'node:crypto'
import { and, asc, eq, inArray, like, or, sql } from 'drizzle-orm'
import { db, schema } from '../client'
import type { Person, PersonCreate, PersonPatch, PersonWithOrg } from '../../../shared/contracts/person'
import type { PersonNote } from '../../../shared/contracts/circle'
import type { PersonNoteCreate, PersonNoteUpdate } from '../../../shared/contracts/personNote'
import type { PersonOverride, PersonOverridePatch } from '../../../shared/contracts/personOverride'

// A json() column may hand back an already-parsed value OR a JSON string depending
// on the driver/column — normalise to an array, defaulting to [] on anything odd.
function asArray(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[]
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

// Same tolerance for object-shaped json (custom_fields) — parse strings, default {}.
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

// dob is a DATE column — a Date from the driver, or a yyyy-mm-dd string. Keep it as
// an ISO date (no time), never inventing a timezone-shifted timestamp.
function toIsoDate(v: unknown): string | null {
  if (v == null) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v)
}

// created_at is a TIMESTAMP — a Date from the driver, or an ISO string. Serialise to
// ISO (transport form), tolerating either; null when unset.
function toIso(v: unknown): string | null {
  if (v == null) return null
  if (v instanceof Date) return v.toISOString()
  return String(v)
}

function toDomain(r: typeof schema.persons.$inferSelect): Person {
  return {
    id: r.id,
    orgId: r.orgId,
    // A last-name-only person has a null firstName in storage; present '' so the
    // non-nullable read contract holds and the UI's `first_name ?? ''` idiom is met.
    firstName: r.firstName ?? '',
    lastName: r.lastName ?? '',
    email: r.email ?? null,
    phone: r.phone ?? null,
    dob: toIsoDate(r.dob),
    gender: r.gender ?? null,
    membershipType: r.membershipType ?? null,
    personTypes: asArray(r.personTypes),
    personType: r.personType ?? null,
    photoUrl: r.photoUrl ?? null,
    phone2: r.phone2 ?? null,
    commsTopics: asArray(r.commsTopics),
    customFields: asObj(r.customFields),
    createdAt: toIso(r.createdAt),
  }
}

export async function listPeople(
  orgId: string,
  opts: { limit?: number; offset?: number; q?: string } = {},
): Promise<Person[]> {
  const where = opts.q
    ? and(
        eq(schema.persons.orgId, orgId),
        or(
          like(schema.persons.firstName, `%${opts.q}%`),
          like(schema.persons.lastName, `%${opts.q}%`),
          like(schema.persons.email, `%${opts.q}%`),
        ),
      )
    : eq(schema.persons.orgId, orgId)

  let query = db
    .select()
    .from(schema.persons)
    .where(where)
    .orderBy(asc(schema.persons.lastName), asc(schema.persons.firstName))
    .$dynamic()

  if (opts.limit != null) query = query.limit(opts.limit)
  if (opts.offset != null) query = query.offset(opts.offset)

  const rows = await query
  return rows.map(toDomain)
}

export async function getPerson(id: string): Promise<Person | null> {
  const [r] = await db.select().from(schema.persons).where(eq(schema.persons.id, id)).limit(1)
  return r ? toDomain(r) : null
}

/** A bulk fetch of persons by a set of ids (e.g. attendance visitor names). Empty in
 *  → empty out; order not guaranteed (the caller keys by id). */
export async function getPeopleByIds(ids: string[]): Promise<Person[]> {
  if (!ids.length) return []
  const rows = await db.select().from(schema.persons).where(inArray(schema.persons.id, ids))
  return rows.map(toDomain)
}

/**
 * Every persons row across EVERY org matching a login's email (one row per club) +
 * that org's name/level. Cross-org by design — the cross-club identity resolver
 * (useMyClubs) lands a login in the right club. Case-insensitive on email.
 */
export async function findAllPersonsByEmail(email: string): Promise<PersonWithOrg[]> {
  const target = email.trim().toLowerCase()
  if (!target) return []
  const rows = await db
    .select({
      id: schema.persons.id,
      orgId: schema.persons.orgId,
      personType: schema.persons.personType,
      personTypes: schema.persons.personTypes,
      orgName: schema.organisations.name,
      orgLevel: schema.organisations.orgLevel,
    })
    .from(schema.persons)
    .innerJoin(schema.organisations, eq(schema.persons.orgId, schema.organisations.id))
    .where(sql`LOWER(${schema.persons.email}) = ${target}`)
  return rows.map((r) => ({
    id: r.id,
    orgId: r.orgId,
    orgName: r.orgName,
    orgLevel: r.orgLevel ?? null,
    personType: r.personType ?? null,
    personTypes: asArray(r.personTypes),
  }))
}

// ── Writes ──
// The repo owns the id (MySQL can't default a uuid). The json columns (personTypes,
// customFields) are JSON.stringify'd on the way IN, mirroring asArray/asObj's parse
// on the way OUT.
export async function createPerson(input: PersonCreate): Promise<Person> {
  const id = randomUUID()
  // `as any`: the first-pass schema marks columns .notNull() (from Postgres) without
  // their defaults, so Drizzle's insert type over-requires them, and json columns
  // take a stringified value here rather than the JS object the type expects. The DB
  // fills the rest. Consistent with the app's (db.from as any) idiom.
  await db.insert(schema.persons).values({
    id,
    orgId: input.orgId,
    // firstName is optional (last-name-only add) — store null when absent.
    firstName: input.firstName ?? null,
    lastName: input.lastName ?? '',
    email: input.email ?? null,
    phone: input.phone ?? null,
    dob: input.dob ?? null,
    gender: input.gender ?? null,
    membershipType: input.membershipType ?? null,
    personTypes: input.personTypes ?? [],
    // The legacy single-type anchor: use it if given, else default to the first of
    // personTypes so the two never drift apart.
    personType: input.personType ?? input.personTypes?.[0] ?? null,
    photoUrl: input.photoUrl ?? null,
    phone2: input.phone2 ?? null,
    commsTopics: input.commsTopics ?? [],
    customFields: input.customFields ?? {},
  } as any)
  return (await getPerson(id))!
}

export async function updatePerson(id: string, patch: PersonPatch): Promise<Person | null> {
  const set: Record<string, any> = {}
  // orgId is intentionally NOT writable — moving a person between tenants is not an
  // edit (security audit CRIT-3). It's stripped from personPatchSchema; omitting it
  // here keeps direct repo calls safe too.
  if (patch.firstName !== undefined) set.firstName = patch.firstName
  if (patch.lastName !== undefined) set.lastName = patch.lastName
  if (patch.email !== undefined) set.email = patch.email
  if (patch.phone !== undefined) set.phone = patch.phone
  if (patch.dob !== undefined) set.dob = patch.dob
  if (patch.gender !== undefined) set.gender = patch.gender
  if (patch.membershipType !== undefined) set.membershipType = patch.membershipType
  if (patch.personTypes !== undefined) set.personTypes = patch.personTypes
  if (patch.personType !== undefined) set.personType = patch.personType
  if (patch.photoUrl !== undefined) set.photoUrl = patch.photoUrl
  if (patch.phone2 !== undefined) set.phone2 = patch.phone2
  if (patch.commsTopics !== undefined) set.commsTopics = patch.commsTopics
  if (patch.customFields !== undefined) set.customFields = patch.customFields
  if (Object.keys(set).length) await db.update(schema.persons).set(set).where(eq(schema.persons.id, id))
  return getPerson(id)
}

// A minimal person lookup by email within an org — the dashboard resolves the
// signed-in user (by their auth email) to their person row to pick a default
// dashboard. Case-insensitive (LOWER on both sides), first match, or null.
export async function findPersonByEmail(orgId: string, email: string): Promise<Person | null> {
  const target = email.trim().toLowerCase()
  if (!orgId || !target) return null
  const [r] = await db
    .select()
    .from(schema.persons)
    .where(and(eq(schema.persons.orgId, orgId), sql`LOWER(${schema.persons.email}) = ${target}`))
    .limit(1)
  return r ? toDomain(r) : null
}

export async function deletePerson(id: string): Promise<void> {
  await db.delete(schema.persons).where(eq(schema.persons.id, id))
}

// ── Bulk writes ──
// The People directory's bulk actions (set-type / delete on N selected rows). Both
// are scoped by orgId as well as the id list, so a crafted id from another tenant
// can never be swept into the same statement (security audit CRIT-3 spirit) — and
// the caller always operates on rows it already loaded for that org.
export async function setTypeForMany(orgId: string, ids: string[], typeKey: string | null): Promise<void> {
  if (!ids.length) return
  // person_type (legacy anchor) + person_types (the array) move together. Clearing =
  // null anchor + null array, matching the page's "Clear type".
  await db
    .update(schema.persons)
    .set({ personType: typeKey, personTypes: typeKey ? [typeKey] : null } as any)
    .where(and(eq(schema.persons.orgId, orgId), inArray(schema.persons.id, ids)))
}

export async function deletePeople(orgId: string, ids: string[]): Promise<void> {
  if (!ids.length) return
  await db.delete(schema.persons).where(and(eq(schema.persons.orgId, orgId), inArray(schema.persons.id, ids)))
}

// ── Person org overrides (a governing body's private overlay on a club's person) ──
// The NSO edits a person it doesn't own; the edits live here keyed by (org_id = NSO,
// person_id) and never touch the club's persons row until pushed.
function toOverride(r: typeof schema.personOrgOverrides.$inferSelect): PersonOverride {
  return {
    orgId: r.orgId,
    personId: r.personId,
    core: asObj(r.core),
    customFields: asObj(r.customFields),
    updatedAt: toIso(r.updatedAt),
  }
}

export async function getPersonOverride(orgId: string, personId: string): Promise<PersonOverride | null> {
  const [r] = await db
    .select()
    .from(schema.personOrgOverrides)
    .where(and(eq(schema.personOrgOverrides.orgId, orgId), eq(schema.personOrgOverrides.personId, personId)))
    .limit(1)
  return r ? toOverride(r) : null
}

/** Insert or merge the overlay. core/customFields each MERGE onto the stored value
 *  (a patch of just the changed keys), so a save of one field never wipes the rest. */
export async function upsertPersonOverride(orgId: string, personId: string, patch: PersonOverridePatch): Promise<PersonOverride> {
  const existing = await getPersonOverride(orgId, personId)
  const core = { ...(existing?.core ?? {}), ...(patch.core ?? {}) }
  const customFields = { ...(existing?.customFields ?? {}), ...(patch.customFields ?? {}) }
  if (existing) {
    await db
      .update(schema.personOrgOverrides)
      .set({ core, customFields, updatedAt: new Date() } as any)
      .where(and(eq(schema.personOrgOverrides.orgId, orgId), eq(schema.personOrgOverrides.personId, personId)))
  } else {
    await db.insert(schema.personOrgOverrides).values({
      id: randomUUID(), orgId, personId, core, customFields,
    } as any)
  }
  return (await getPersonOverride(orgId, personId))!
}

/** Apply the overlay onto the CLUB's persons row (core overwrites; customFields MERGE
 *  so the club's own fields survive), then clear the overlay — once pushed, base ==
 *  overlay so the row is redundant. Returns the updated person. */
export async function pushPersonOverride(orgId: string, personId: string): Promise<Person | null> {
  const override = await getPersonOverride(orgId, personId)
  const base = await getPerson(personId)
  if (!override || !base) return base
  const patch: PersonPatch = { ...(override.core as any) }
  // Merge the NSO's field values into the club's existing custom_fields (never replace,
  // or the club's own fields would be wiped).
  patch.customFields = { ...(base.customFields ?? {}), ...(override.customFields ?? {}) }
  const updated = await updatePerson(personId, patch)
  await deletePersonOverride(orgId, personId)
  return updated
}

export async function deletePersonOverride(orgId: string, personId: string): Promise<void> {
  await db
    .delete(schema.personOrgOverrides)
    .where(and(eq(schema.personOrgOverrides.orgId, orgId), eq(schema.personOrgOverrides.personId, personId)))
}

// ── Person notes (writes) ──
// person_notes reads live in the circles repo (listNotes); the WRITE side lives here
// so the profile page's add/delete-note actions have a seam without another domain
// growing note-write functions. Returns the circle contract's PersonNote shape.
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
    links: Array.isArray(r.links) ? (r.links as any[]) : asArray(r.links),
    createdAt: toIso(r.createdAt) ?? '',
  }
}

export async function createNote(input: PersonNoteCreate): Promise<PersonNote> {
  const id = randomUUID()
  const visibleTo = input.visibleTo ?? []
  // Derive the visibility scope from the first target when not given explicitly —
  // mirrors the page's `(visibleTo?.[0])?.type || 'staff'`.
  const visibility = input.visibility ?? ((visibleTo[0] as any)?.type || 'staff')
  // json columns take the RAW JS value (never JSON.stringify — Drizzle double-encodes).
  // `as any`: the first-pass schema over-requires notNull columns without their
  // defaults; the DB fills created_at. Consistent with the app's (db.from as any) idiom.
  await db.insert(schema.personNotes).values({
    id,
    orgId: input.orgId,
    personId: input.personId,
    body: input.body,
    tags: input.tags ?? [],
    links: input.links ?? [],
    visibleTo,
    visibility,
    isImportant: !!input.isImportant,
    dueDate: input.dueDate ?? null,
    authorId: input.authorId ?? null,
    authorName: input.authorName ?? null,
    channel: input.channel ?? null,
  } as any)
  const [r] = await db.select().from(schema.personNotes).where(eq(schema.personNotes.id, id)).limit(1)
  return toNote(r)
}

export async function updateNote(id: string, patch: PersonNoteUpdate): Promise<PersonNote> {
  // json columns take the RAW JS value (Drizzle double-encodes a JSON.stringify).
  const set: Record<string, any> = {}
  if (patch.body !== undefined) set.body = patch.body
  if (patch.links !== undefined) set.links = patch.links
  if (patch.visibleTo !== undefined) set.visibleTo = patch.visibleTo
  if (patch.visibility !== undefined) set.visibility = patch.visibility
  if (patch.isImportant !== undefined) set.isImportant = !!patch.isImportant
  if (patch.dueDate !== undefined) set.dueDate = patch.dueDate
  if (patch.channel !== undefined) set.channel = patch.channel
  if (patch.tags !== undefined) set.tags = patch.tags
  if (Object.keys(set).length) {
    await db.update(schema.personNotes).set(set as any).where(eq(schema.personNotes.id, id))
  }
  const [r] = await db.select().from(schema.personNotes).where(eq(schema.personNotes.id, id)).limit(1)
  return toNote(r)
}

export async function deleteNote(id: string): Promise<void> {
  await db.delete(schema.personNotes).where(eq(schema.personNotes.id, id))
}
