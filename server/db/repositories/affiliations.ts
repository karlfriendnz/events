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
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/mysql-core'
import { db, schema } from '../client'
import type {
  GoverningBody,
  Location,
  LocationStaff,
  LocationStaffCreate,
  LocationStaffPatch,
  OrgManagerGrant,
  OrgSport,
  OrgSportCreate,
  OrgSportPatch,
  OrgSportWithNames,
  LocationCreate,
  LocationPatch,
} from '../../../shared/contracts/affiliation'

// A json array-or-string row shape → id list, tolerating either. Used for the raw
// recursive-CTE result of the subtree walk.
function rowsOf(result: any): any[] {
  if (Array.isArray(result)) return Array.isArray(result[0]) ? result[0] : result
  return result?.rows ?? []
}

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

// Ids of an org plus every org beneath it (a governing body sees its whole
// subtree's affiliation requests, not just those aimed directly at it). MySQL 8
// recursive CTE over organisations.parent_id — the walk the useOrgHierarchy
// descendantScope used to do client-side, moved server-side so the affiliation
// reads are self-contained. Depth-capped at 20 (parent_id has no DB cycle guard).
async function descendantAndSelfOrgIds(rootId: string): Promise<string[]> {
  const result = await db.execute(sql`
    WITH RECURSIVE subtree AS (
      SELECT id, parent_id, 0 AS depth FROM organisations WHERE id = ${rootId}
      UNION ALL
      SELECT c.id, c.parent_id, s.depth + 1
      FROM organisations c JOIN subtree s ON c.parent_id = s.id
      WHERE s.depth < 20
    )
    SELECT id FROM subtree
  `)
  const ids = rowsOf(result).map((r: any) => r.id as string)
  return ids.length ? ids : [rootId]
}

// A club/body-org alias pair so one query can join the org names on both ends of an
// affiliation (org_id → club, nso_org_id → body).
const clubOrg = alias(schema.organisations, 'club_org')
const bodyOrg = alias(schema.organisations, 'body_org')

function toOrgSportWithNames(
  r: typeof schema.orgSports.$inferSelect,
  clubName: string | null,
  bodyName: string | null,
): OrgSportWithNames {
  return { ...toOrgSport(r), clubName: clubName ?? null, bodyName: bodyName ?? null }
}

/**
 * Every affiliation request/relationship pointing AT a governing body — its whole
 * subtree's, so a National sees what its Regionals were asked too. Newest request
 * first. Joins the club + body names for the register screen.
 */
export async function listAffiliationsForBody(bodyOrgId: string): Promise<OrgSportWithNames[]> {
  const scope = await descendantAndSelfOrgIds(bodyOrgId)
  const rows = await db
    .select({ sport: schema.orgSports, clubName: clubOrg.name, bodyName: bodyOrg.name })
    .from(schema.orgSports)
    .leftJoin(clubOrg, eq(clubOrg.id, schema.orgSports.orgId))
    .leftJoin(bodyOrg, eq(bodyOrg.id, schema.orgSports.nsoOrgId))
    .where(inArray(schema.orgSports.nsoOrgId, scope))
    .orderBy(desc(schema.orgSports.requestedAt))
  return rows.map(r => toOrgSportWithNames(r.sport, r.clubName, r.bodyName))
}

/** A club's own affiliations, for its Sports screen — with the body name joined. */
export async function listAffiliationsForClub(clubOrgId: string): Promise<OrgSportWithNames[]> {
  const rows = await db
    .select({ sport: schema.orgSports, bodyName: bodyOrg.name })
    .from(schema.orgSports)
    .leftJoin(bodyOrg, eq(bodyOrg.id, schema.orgSports.nsoOrgId))
    .where(eq(schema.orgSports.orgId, clubOrgId))
    .orderBy(asc(schema.orgSports.sortOrder))
  return rows.map(r => toOrgSportWithNames(r.sport, null, r.bodyName))
}

/** Pending affiliation requests aimed anywhere in a body's subtree — the nav badge. */
export async function pendingCountForBody(bodyOrgId: string): Promise<number> {
  const scope = await descendantAndSelfOrgIds(bodyOrgId)
  const rows = await db
    .select({ id: schema.orgSports.id })
    .from(schema.orgSports)
    .where(and(inArray(schema.orgSports.nsoOrgId, scope), eq(schema.orgSports.affiliationStatus, 'pending')))
  return rows.length
}

/** Governing-body picker options for the club's Sports editor — every org except
 *  the club itself (the editor filters to governing levels client-side). Carries
 *  default_sport_name so choosing a body seeds the canonical sport. */
export async function listGoverningBodies(excludeOrgId: string): Promise<GoverningBody[]> {
  const rows = await db
    .select({ id: schema.organisations.id, name: schema.organisations.name, orgLevel: schema.organisations.orgLevel, defaultSportName: schema.organisations.defaultSportName })
    .from(schema.organisations)
    .orderBy(asc(schema.organisations.name))
  return rows
    .filter(r => r.id !== excludeOrgId)
    .map(r => ({ id: r.id, name: r.name, orgLevel: r.orgLevel, defaultSportName: r.defaultSportName ?? null }))
}

/** The cross-club manager grants a governing org has issued, with the granted
 *  person's name joined for the assignments list. */
export async function listManagerGrants(orgId: string): Promise<OrgManagerGrant[]> {
  const rows = await db
    .select({ grant: schema.orgManagerGrants, firstName: schema.persons.firstName, lastName: schema.persons.lastName })
    .from(schema.orgManagerGrants)
    .leftJoin(schema.persons, eq(schema.persons.id, schema.orgManagerGrants.personId))
    .where(eq(schema.orgManagerGrants.orgId, orgId))
  return rows.map(r => {
    const name = [r.firstName, r.lastName].filter(Boolean).join(' ').trim()
    return { ...toManagerGrant(r.grant), personName: name || null }
  })
}

/** Replace a person's grants at a governing org (delete-then-insert). Org-scoped in
 *  the WHERE so a crafted person id can't reach into another tenant. */
export async function replaceManagerGrants(
  orgId: string,
  personId: string,
  grants: { targetOrgId: string | null; capabilities: string[] }[],
): Promise<void> {
  await db.delete(schema.orgManagerGrants)
    .where(and(eq(schema.orgManagerGrants.orgId, orgId), eq(schema.orgManagerGrants.personId, personId)))
  if (!grants.length) return
  await db.insert(schema.orgManagerGrants).values(grants.map(g => ({
    id: randomUUID(),
    orgId,
    personId,
    targetOrgId: g.targetOrgId ?? null,
    capabilities: g.capabilities ?? [],
  })) as any)
}

/** Remove a person as a manager entirely at a governing org. */
export async function removeManagerGrantsForPerson(orgId: string, personId: string): Promise<void> {
  await db.delete(schema.orgManagerGrants)
    .where(and(eq(schema.orgManagerGrants.orgId, orgId), eq(schema.orgManagerGrants.personId, personId)))
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

/** Per-site staff role assignments for a club, with the assigned person joined
 *  (avatar + name + email on the Locations screen). */
export async function listLocationStaff(orgId: string): Promise<LocationStaff[]> {
  const rows = await db
    .select({ staff: schema.locationStaff, personId: schema.persons.id, firstName: schema.persons.firstName, lastName: schema.persons.lastName, email: schema.persons.email })
    .from(schema.locationStaff)
    .leftJoin(schema.persons, eq(schema.persons.id, schema.locationStaff.personId))
    .where(eq(schema.locationStaff.orgId, orgId))
  return rows.map(r => ({
    ...toLocationStaff(r.staff),
    person: r.personId ? { id: r.personId, firstName: r.firstName ?? null, lastName: r.lastName ?? null, email: r.email ?? null } : null,
  }))
}

/** Grant a person a role at a site (or club-wide when locationId is null). */
export async function createLocationStaff(input: LocationStaffCreate): Promise<LocationStaff> {
  const id = randomUUID()
  await db.insert(schema.locationStaff).values({
    id,
    orgId: input.orgId,
    locationId: input.locationId ?? null,
    personId: input.personId,
    roleKey: input.roleKey ?? 'staff',
    sportId: input.sportId ?? null,
  } as any)
  const [r] = await db.select().from(schema.locationStaff).where(eq(schema.locationStaff.id, id)).limit(1)
  return toLocationStaff(r)
}

/** Change the role or sport-scope of an existing staff grant. */
export async function updateLocationStaff(id: string, patch: LocationStaffPatch): Promise<LocationStaff | null> {
  const set: Record<string, any> = {}
  if (patch.roleKey !== undefined) set.roleKey = patch.roleKey
  if (patch.sportId !== undefined) set.sportId = patch.sportId
  if (Object.keys(set).length) await db.update(schema.locationStaff).set(set).where(eq(schema.locationStaff.id, id))
  const [r] = await db.select().from(schema.locationStaff).where(eq(schema.locationStaff.id, id)).limit(1)
  return r ? toLocationStaff(r) : null
}

export async function deleteLocationStaff(id: string): Promise<void> {
  await db.delete(schema.locationStaff).where(eq(schema.locationStaff.id, id))
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

// An ISO 8601 string (or null) → a Date the DB timestamp column accepts.
function fromIso(v: string | null | undefined): Date | null | undefined {
  if (v === undefined) return undefined
  if (v === null) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
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
  // Handshake timestamps — how `request`/`decide` and a body-change on save express
  // the state transition. ISO strings in → Date; null clears (decidedAt/decidedBy on
  // a re-request). decidedBy is a plain user-id string.
  if (patch.requestedAt !== undefined) set.requestedAt = fromIso(patch.requestedAt)
  if (patch.decidedAt !== undefined) set.decidedAt = fromIso(patch.decidedAt)
  if (patch.decidedBy !== undefined) set.decidedBy = patch.decidedBy
  if (Object.keys(set).length) await db.update(schema.orgSports).set(set).where(eq(schema.orgSports.id, id))
  return getOrgSport(id)
}

export async function deleteOrgSport(id: string): Promise<void> {
  await db.delete(schema.orgSports).where(eq(schema.orgSports.id, id))
}

/** Clear the primary flag on every one of a club's sports — run before setting a new
 *  primary so the partial one-primary unique index never trips mid-write. */
export async function clearPrimarySports(orgId: string): Promise<void> {
  await db.update(schema.orgSports).set({ isPrimary: false }).where(eq(schema.orgSports.orgId, orgId))
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
