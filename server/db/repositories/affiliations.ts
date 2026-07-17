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
import { asc, eq } from 'drizzle-orm'
import { db, schema } from '../client'
import type {
  Location,
  LocationStaff,
  OrgManagerGrant,
  OrgSport,
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
