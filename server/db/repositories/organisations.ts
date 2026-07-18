// The repository: the ONLY code that knows how organisations are stored. It turns
// DB rows into domain objects (the contract shape) and back. Nitro routes call
// these functions; they never touch Drizzle or the DB directly. When the backend
// team's MySQL API replaces this, only this file changes — routes, composables and
// UI are untouched.
import { randomUUID } from 'node:crypto'
import { asc, eq, sql } from 'drizzle-orm'
import { db, schema } from '../client'
import type { Organisation, OrgTreeNode, OrganisationCreate, OrganisationPatch } from '../../../shared/contracts/organisation'
import type { OrgSettings } from '../../../shared/contracts/orgSettings'

// people_columns is a json column — mysql2 usually hands it back parsed, but a
// driver/config can return the raw string. Normalise to an object keyed by tab, or
// null when never configured; never throw on bad json.
function asColumns(v: unknown): OrgSettings['peopleColumns'] {
  if (v == null) return null
  if (typeof v === 'object' && !Array.isArray(v)) return v as OrgSettings['peopleColumns']
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
    } catch {
      return null
    }
  }
  return null
}

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

// ── Writes ──
// The repo owns the id (MySQL can't default a uuid). Domain fields map to columns
// directly here (organisations has no json/array columns); domains that DO carry
// arrays JSON.stringify them on the way IN, mirroring toDomain's parse on the way OUT.
export async function createOrganisation(input: OrganisationCreate): Promise<Organisation> {
  const id = randomUUID()
  // `as any`: the first-pass schema marks many columns .notNull() (from Postgres)
  // without their defaults, so Drizzle's insert type over-requires them; the DB
  // (defaults + relaxed mode) fills the rest. Drops away when a domain's schema is
  // refined with real defaults. Consistent with the app's (db.from as any) idiom.
  await db.insert(schema.organisations).values({
    id, name: input.name, slug: input.slug ?? null,
    orgLevel: input.orgLevel ?? 'CLUB', parentId: input.parentId ?? null,
  } as any)
  return (await getOrganisation(id))!
}

export async function updateOrganisation(id: string, patch: OrganisationPatch): Promise<Organisation | null> {
  const set: Record<string, any> = {}
  if (patch.name !== undefined) set.name = patch.name
  if (patch.slug !== undefined) set.slug = patch.slug
  if (patch.orgLevel !== undefined) set.orgLevel = patch.orgLevel
  // parentId is intentionally NOT writable via the general patch — re-parenting is a
  // privileged, tenant-crossing operation (security audit CRIT-3). It's stripped from
  // organisationPatchSchema; not writing it here keeps direct repo calls safe too.
  if (Object.keys(set).length) await db.update(schema.organisations).set(set).where(eq(schema.organisations.id, id))
  return getOrganisation(id)
}

export async function deleteOrganisation(id: string): Promise<void> {
  await db.delete(schema.organisations).where(eq(schema.organisations.id, id))
}

// ── Settings ──
// A focused read of just the org columns the People directory needs — kept off the
// base Organisation domain (which is identity/tree only). Returns null when the org
// doesn't exist.
export async function getOrgSettings(id: string): Promise<OrgSettings | null> {
  const [r] = await db.select().from(schema.organisations).where(eq(schema.organisations.id, id)).limit(1)
  if (!r) return null
  return {
    orgLevel: r.orgLevel,
    memberPullMode: r.memberPullMode ?? null,
    peopleColumns: asColumns(r.peopleColumns),
  }
}

// Save the per-tab column selection. json column takes the raw JS value (no
// JSON.stringify — that would double-encode).
export async function setPeopleColumns(id: string, cols: OrgSettings['peopleColumns']): Promise<void> {
  await db.update(schema.organisations).set({ peopleColumns: cols } as any).where(eq(schema.organisations.id, id))
}

// Raw SQL returns snake_case columns (the DB names), unlike a Drizzle select which
// maps to the schema's camelCase — so tree rows map from snake_case.
function toTreeNode(r: any): OrgTreeNode {
  const created = r.created_at instanceof Date ? r.created_at : new Date(r.created_at)
  return {
    id: r.id,
    name: r.name,
    slug: r.slug ?? null,
    orgLevel: r.org_level,
    parentId: r.parent_id ?? null,
    createdAt: created.toISOString(),
    depth: Number(r.depth),
  }
}

// mysql2's execute returns [rows, fields]; drizzle passes it through. Normalise.
function rowsOf(result: any): any[] {
  if (Array.isArray(result)) return Array.isArray(result[0]) ? result[0] : result
  return result?.rows ?? []
}

/**
 * Ancestors of an org — immediate parent first, walking up. Replaces the Postgres
 * `org_ancestors` RPC with a MySQL 8 recursive CTE. Excludes self; depth-capped at
 * 20 (the parent_id chain has no DB cycle guard, same as the old function).
 */
export async function getAncestors(id: string): Promise<OrgTreeNode[]> {
  const result = await db.execute(sql`
    WITH RECURSIVE ancestors AS (
      SELECT id, name, slug, org_level, parent_id, created_at, 0 AS depth
      FROM organisations WHERE id = ${id}
      UNION ALL
      SELECT p.id, p.name, p.slug, p.org_level, p.parent_id, p.created_at, a.depth + 1
      FROM organisations p JOIN ancestors a ON p.id = a.parent_id
      WHERE a.depth < 20
    )
    SELECT * FROM ancestors WHERE id <> ${id} ORDER BY depth
  `)
  return rowsOf(result).map(toTreeNode)
}

/** Descendants of an org — direct children first, walking down. Replaces the
 *  Postgres `org_descendants` RPC. Excludes self. */
export async function getDescendants(id: string): Promise<OrgTreeNode[]> {
  const result = await db.execute(sql`
    WITH RECURSIVE descendants AS (
      SELECT id, name, slug, org_level, parent_id, created_at, 0 AS depth
      FROM organisations WHERE id = ${id}
      UNION ALL
      SELECT c.id, c.name, c.slug, c.org_level, c.parent_id, c.created_at, d.depth + 1
      FROM organisations c JOIN descendants d ON c.parent_id = d.id
      WHERE d.depth < 20
    )
    SELECT * FROM descendants WHERE id <> ${id} ORDER BY depth, name
  `)
  return rowsOf(result).map(toTreeNode)
}
