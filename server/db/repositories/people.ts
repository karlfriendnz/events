// The repository: the ONLY code that knows how people are stored. It turns DB rows
// into domain objects (the contract shape) and back. Nitro routes call these
// functions; they never touch Drizzle or the DB directly. When the backend team's
// MySQL API replaces this, only this file changes — routes, composables and UI are
// untouched.
import { randomUUID } from 'node:crypto'
import { and, asc, eq, inArray, like, or } from 'drizzle-orm'
import { db, schema } from '../client'
import type { Person, PersonCreate, PersonPatch } from '../../../shared/contracts/person'

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

function toDomain(r: typeof schema.persons.$inferSelect): Person {
  return {
    id: r.id,
    orgId: r.orgId,
    firstName: r.firstName,
    lastName: r.lastName,
    email: r.email ?? null,
    phone: r.phone ?? null,
    dob: toIsoDate(r.dob),
    gender: r.gender ?? null,
    membershipType: r.membershipType ?? null,
    personTypes: asArray(r.personTypes),
    personType: r.personType ?? null,
    photoUrl: r.photoUrl ?? null,
    customFields: asObj(r.customFields),
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
    firstName: input.firstName,
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
  if (patch.customFields !== undefined) set.customFields = patch.customFields
  if (Object.keys(set).length) await db.update(schema.persons).set(set).where(eq(schema.persons.id, id))
  return getPerson(id)
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
