// The repository: the ONLY code that knows how people are stored. It turns DB rows
// into domain objects (the contract shape) and back. Nitro routes call these
// functions; they never touch Drizzle or the DB directly. When the backend team's
// MySQL API replaces this, only this file changes — routes, composables and UI are
// untouched.
import { and, asc, eq, like, or } from 'drizzle-orm'
import { db, schema } from '../client'
import type { Person } from '../../../shared/contracts/person'

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
