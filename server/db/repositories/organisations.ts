// The repository: the ONLY code that knows how organisations are stored. It turns
// DB rows into domain objects (the contract shape) and back. Nitro routes call
// these functions; they never touch Drizzle or the DB directly. When the backend
// team's MySQL API replaces this, only this file changes — routes, composables and
// UI are untouched.
import { asc, eq } from 'drizzle-orm'
import { db, schema } from '../client'
import type { Organisation } from '../../../shared/contracts/organisation'

function toDomain(r: typeof schema.organisations.$inferSelect): Organisation {
  const created = r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt as any)
  return {
    id: r.id,
    name: r.name,
    slug: r.slug ?? null,
    orgLevel: r.orgLevel as Organisation['orgLevel'],
    parentId: r.parentId ?? null,
    createdAt: created.toISOString(),
  }
}

export async function listOrganisations(): Promise<Organisation[]> {
  const rows = await db.select().from(schema.organisations).orderBy(asc(schema.organisations.name))
  return rows.map(toDomain)
}

export async function getOrganisation(id: string): Promise<Organisation | null> {
  const [r] = await db.select().from(schema.organisations).where(eq(schema.organisations.id, id)).limit(1)
  return r ? toDomain(r) : null
}
