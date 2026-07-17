// The repository: the ONLY code that knows how the affiliations domain is stored —
// club sports + governing-body affiliation, cross-club manager grants, and a club's
// locations + per-site staff. It turns DB rows into domain objects (the contract
// shape) and back. Nitro routes call these functions; they never touch Drizzle or
// the DB directly. When the backend team's MySQL API replaces this, only this file
// changes — routes, composables and UI are untouched.
//
// json handling: `capabilities` and `terminology` are `json` columns. mysql2 usually
// hands them back already parsed, but a driver/config can return the raw string —
// `asArray` / `asObj` normalise either (and never throw), so the domain always sees
// a real JS array / object. Timestamps come back as Date (or a string) and are
// serialised to ISO 8601 at the boundary.
import { randomUUID } from 'node:crypto'
import { asc, eq } from 'drizzle-orm'
import { db, schema } from '../client'
import type {
  Location,
  LocationStaff,
  OrgManagerGrant,
  OrgSport,
  OrgSportCreate,
  OrgSportPatch,
  LocationCreate,
  LocationPatch,
} from '../../../shared/contracts/affiliation'

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

// Coerce a json object column into a plain object: an object → use it; a string →
// parse (falling back to null); anything else / null → null.
function asObj(v: unknown): Record<string, any> | null {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, any>
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

// A nullable DB timestamp → ISO 8601 string, or null. Accepts Date or a raw string.
function toIso(v: unknown): string | null {
  if (v == null) return null
  const d = v instanceof Date ? v : new Date(v as any)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function toOrgSport(r: typeof schema.orgSports.$inferSelect): OrgSport {
  return {
    id: r.id,
    orgId: r.orgId,
    sport: r.sport,
    displayName: r.displayName ?? null,
    nsoOrgId: r.nsoOrgId ?? null,
    isPrimary: r.isPrimary,
    sortOrder: r.sortOrder,
    affiliationStatus: r.affiliationStatus,
    requestedAt: toIso(r.requestedAt),
    decidedAt: toIso(r.decidedAt),
    terminology: asObj(r.terminology),
  }
}

function toManagerGrant(r: typeof schema.orgManagerGrants.$inferSelect): OrgManagerGrant {
  return {
    id: r.id,
    orgId: r.orgId,
    personId: r.personId,
    targetOrgId: r.targetOrgId ?? null,
    capabilities: asArray(r.capabilities),
  }
}

function toLocation(r: typeof schema.locations.$inferSelect): Location {
  return {
    id: r.id,
    orgId: r.orgId,
    name: r.name,
    address: r.address ?? null,
    color: r.color ?? null,
    sortOrder: r.sortOrder,
  }
}

function toLocationStaff(r: typeof schema.locationStaff.$inferSelect): LocationStaff {
  return {
    id: r.id,
    orgId: r.orgId,
    locationId: r.locationId ?? null,
    personId: r.personId,
    roleKey: r.roleKey,
    sportId: r.sportId ?? null,
  }
}

/** Every sport a club runs (with its governing-body affiliation), in author order. */
export async function listOrgSports(orgId: string): Promise<OrgSport[]> {
  const rows = await db
    .select()
    .from(schema.orgSports)
    .where(eq(schema.orgSports.orgId, orgId))
    .orderBy(asc(schema.orgSports.sortOrder))
  return rows.map(toOrgSport)
}

/** The clubs affiliated to one governing body — org_sports pointing at it as NSO. */
export async function listAffiliationsForBody(nsoOrgId: string): Promise<OrgSport[]> {
  const rows = await db
    .select()
    .from(schema.orgSports)
    .where(eq(schema.orgSports.nsoOrgId, nsoOrgId))
    .orderBy(asc(schema.orgSports.sortOrder))
  return rows.map(toOrgSport)
}

/** The cross-club manager grants a governing org has issued. */
export async function listManagerGrants(orgId: string): Promise<OrgManagerGrant[]> {
  const rows = await db
    .select()
    .from(schema.orgManagerGrants)
    .where(eq(schema.orgManagerGrants.orgId, orgId))
  return rows.map(toManagerGrant)
}

/** A club's operational locations (sites), in author order. */
export async function listLocations(orgId: string): Promise<Location[]> {
  const rows = await db
    .select()
    .from(schema.locations)
    .where(eq(schema.locations.orgId, orgId))
    .orderBy(asc(schema.locations.sortOrder))
  return rows.map(toLocation)
}

/** Per-site staff role assignments for a club. */
export async function listLocationStaff(orgId: string): Promise<LocationStaff[]> {
  const rows = await db
    .select()
    .from(schema.locationStaff)
    .where(eq(schema.locationStaff.orgId, orgId))
  return rows.map(toLocationStaff)
}

// ── Writes ──
// The repo owns the id (MySQL can't default a uuid). The `terminology` json object
// is passed as a PLAIN JS object — drizzle's json() serialises it; DON'T
// JSON.stringify first or it stores a double-encoded string. `as any` mirrors the
// app's insert idiom (the first-pass schema over-requires notNull columns the DB
// defaults, e.g. requested_at).
export async function getOrgSport(id: string): Promise<OrgSport | null> {
  const [r] = await db.select().from(schema.orgSports).where(eq(schema.orgSports.id, id)).limit(1)
  return r ? toOrgSport(r) : null
}

export async function createOrgSport(input: OrgSportCreate): Promise<OrgSport> {
  const id = randomUUID()
  await db.insert(schema.orgSports).values({
    id,
    orgId: input.orgId,
    sport: input.sport,
    displayName: input.displayName ?? null,
    nsoOrgId: input.nsoOrgId ?? null,
    isPrimary: input.isPrimary ?? false,
    sortOrder: input.sortOrder ?? 0,
    affiliationStatus: input.affiliationStatus ?? 'approved',
    terminology: input.terminology ?? null,
  } as any)
  return (await getOrgSport(id))!
}

export async function updateOrgSport(id: string, patch: OrgSportPatch): Promise<OrgSport | null> {
  const set: Record<string, any> = {}
  if (patch.orgId !== undefined) set.orgId = patch.orgId
  if (patch.sport !== undefined) set.sport = patch.sport
  if (patch.displayName !== undefined) set.displayName = patch.displayName
  if (patch.nsoOrgId !== undefined) set.nsoOrgId = patch.nsoOrgId
  if (patch.isPrimary !== undefined) set.isPrimary = patch.isPrimary
  if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder
  if (patch.affiliationStatus !== undefined) set.affiliationStatus = patch.affiliationStatus
  if (patch.terminology !== undefined) set.terminology = patch.terminology
  if (Object.keys(set).length) await db.update(schema.orgSports).set(set).where(eq(schema.orgSports.id, id))
  return getOrgSport(id)
}

export async function deleteOrgSport(id: string): Promise<void> {
  await db.delete(schema.orgSports).where(eq(schema.orgSports.id, id))
}

export async function getLocation(id: string): Promise<Location | null> {
  const [r] = await db.select().from(schema.locations).where(eq(schema.locations.id, id)).limit(1)
  return r ? toLocation(r) : null
}

export async function createLocation(input: LocationCreate): Promise<Location> {
  const id = randomUUID()
  await db.insert(schema.locations).values({
    id,
    orgId: input.orgId,
    name: input.name,
    address: input.address ?? null,
    color: input.color ?? null,
    sortOrder: input.sortOrder ?? 0,
  } as any)
  return (await getLocation(id))!
}

export async function updateLocation(id: string, patch: LocationPatch): Promise<Location | null> {
  const set: Record<string, any> = {}
  if (patch.orgId !== undefined) set.orgId = patch.orgId
  if (patch.name !== undefined) set.name = patch.name
  if (patch.address !== undefined) set.address = patch.address
  if (patch.color !== undefined) set.color = patch.color
  if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder
  if (Object.keys(set).length) await db.update(schema.locations).set(set).where(eq(schema.locations.id, id))
  return getLocation(id)
}

export async function deleteLocation(id: string): Promise<void> {
  await db.delete(schema.locations).where(eq(schema.locations.id, id))
}
