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
import type { OrgDashboardMeta } from '../../../shared/contracts/orgDashboard'
import type { OrgProfile, OrgProfilePatch } from '../../../shared/contracts/orgProfile'

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
    isTemplate: !!r.isTemplate,
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

// ── Dashboard / profile meta ──
// A focused read of the org columns the club dashboard + member profile screens
// need: name/logo, the dashboard hero banner + club-default dashboard config, the
// level, and the club-default profile-dashboard layout. Kept off the base contract
// (identity/tree only) and off getOrgSettings (the People directory's slice).
// json columns are passed through as-is (the page owns their shape). null when the
// org doesn't exist.
export async function getOrgDashboardMeta(id: string): Promise<OrgDashboardMeta | null> {
  const [r] = await db.select().from(schema.organisations).where(eq(schema.organisations.id, id)).limit(1)
  if (!r) return null
  return {
    name: r.name,
    logoUrl: r.logoUrl ?? null,
    dashboardBannerUrl: r.dashboardBannerUrl ?? null,
    dashboardConfig: r.dashboardConfig ?? null,
    orgLevel: r.orgLevel,
    profileDashboard: r.profileDashboard ?? null,
  }
}

// Set (or clear, with null) the dashboard hero banner URL.
export async function setDashboardBanner(id: string, url: string | null): Promise<void> {
  await db.update(schema.organisations).set({ dashboardBannerUrl: url } as any).where(eq(schema.organisations.id, id))
}

// Save the club-default member-profile dashboard layout (Settings → Profile dashboard).
// json column takes the raw JS value (no JSON.stringify). null clears the layout.
export async function setProfileDashboard(id: string, config: any[] | null): Promise<void> {
  await db.update(schema.organisations).set({ profileDashboard: config } as any).where(eq(schema.organisations.id, id))
}

// ── General settings (Settings → General tab) ──
// A focused read/write of the identity/branding/season/contact/defaults columns the
// General tab owns. Kept off getOrgSettings (People slice) and getOrgDashboardMeta
// (dashboard slice) so no shared contract carries screen-specific columns.

// date columns arrive as a Date from the driver, or a yyyy-mm-dd string. Keep as an
// ISO date (no time) — never invent a timezone-shifted timestamp.
function toDateStr(v: unknown): string | null {
  if (v == null) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).slice(0, 10)
}

// json columns — mysql2 usually hands them back parsed, but a driver/config can
// return the raw string. Normalise to an object (or null), tolerating both.
function asJsonObj(v: unknown): Record<string, any> | null {
  if (v == null) return null
  if (typeof v === 'object' && !Array.isArray(v)) return v as Record<string, any>
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

function asStrArray(v: unknown): string[] {
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

export async function getOrgProfile(id: string): Promise<OrgProfile | null> {
  const [r] = await db.select().from(schema.organisations).where(eq(schema.organisations.id, id)).limit(1)
  if (!r) return null
  return {
    name: r.name,
    currency: r.currency,
    locale: r.locale,
    seasonStart: toDateStr(r.seasonStart),
    seasonEnd: toDateStr(r.seasonEnd),
    parentId: r.parentId ?? null,
    orgLevel: r.orgLevel as OrgProfile['orgLevel'],
    defaultSportName: r.defaultSportName ?? null,
    clubTypeIds: asStrArray(r.clubTypeIds),
    logoUrl: r.logoUrl ?? null,
    iconUrl: r.iconUrl ?? null,
    brandColor: r.brandColor ?? null,
    brandTextColor: r.brandTextColor ?? null,
    defaultFormId: r.defaultFormId ?? null,
    defaultPaymentMethod: r.defaultPaymentMethod ?? null,
    defaultBankAccountId: r.defaultBankAccountId ?? null,
    eventsDefaultPaymentMethod: r.eventsDefaultPaymentMethod ?? null,
    eventsDefaultBankAccountId: r.eventsDefaultBankAccountId ?? null,
    shortName: r.shortName ?? null,
    address: r.address ?? null,
    country: r.country ?? null,
    timezone: r.timezone ?? null,
    email: r.email ?? null,
    phone: r.phone ?? null,
    website: r.website ?? null,
    defaultPaymentOptions: asJsonObj(r.defaultPaymentOptions),
    eventsDefaultPaymentOptions: asJsonObj(r.eventsDefaultPaymentOptions),
    bookerTheme: asJsonObj(r.bookerTheme),
  }
}

// Patch any subset of the writable General-tab columns. json columns take the raw JS
// value (no JSON.stringify — that would double-encode). parentId is NOT accepted here
// (privileged re-parenting, CRIT-3) — the contract already omits it.
export async function updateOrgProfile(id: string, patch: OrgProfilePatch): Promise<OrgProfile | null> {
  const set: Record<string, any> = {}
  const cols: Array<keyof OrgProfilePatch> = [
    'name', 'currency', 'locale', 'seasonStart', 'seasonEnd', 'orgLevel',
    'defaultSportName', 'clubTypeIds', 'logoUrl', 'iconUrl', 'brandColor', 'brandTextColor',
    'defaultFormId', 'defaultPaymentMethod', 'defaultBankAccountId',
    'eventsDefaultPaymentMethod', 'eventsDefaultBankAccountId',
    'shortName', 'address', 'country', 'timezone', 'email', 'phone', 'website',
    'defaultPaymentOptions', 'eventsDefaultPaymentOptions', 'bookerTheme',
  ]
  for (const c of cols) {
    if (patch[c] !== undefined) set[c] = patch[c]
  }
  if (Object.keys(set).length) await db.update(schema.organisations).set(set as any).where(eq(schema.organisations.id, id))
  return getOrgProfile(id)
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

// ── Focused fills for small consumers ──

// json array column (default_member_positions) → string[]; tolerate raw string.
function asStrArr(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[]
  if (typeof v === 'string') {
    try { const p = JSON.parse(v); return Array.isArray(p) ? p : [] } catch { return [] }
  }
  return []
}

/** The resolved brand theme for an org: the connected platform brand's colour (via
 *  brand_id → brands.color) + the level for the governing-body fallback. Null org →
 *  null. */
export async function getOrgBrandTheme(
  id: string,
): Promise<{ brandColor: string | null; brandName: string | null; orgLevel: string } | null> {
  const [r] = await db.select().from(schema.organisations).where(eq(schema.organisations.id, id)).limit(1)
  if (!r) return null
  let brandColor: string | null = null
  let brandName: string | null = null
  if (r.brandId) {
    const [b] = await db
      .select({ color: schema.brands.color, name: schema.brands.name })
      .from(schema.brands)
      .where(eq(schema.brands.id, r.brandId))
      .limit(1)
    brandColor = b?.color ?? null
    brandName = b?.name?.trim() || null
  }
  return { brandColor, brandName, orgLevel: r.orgLevel }
}

/** Privileged re-parent: move an org under a different governing body. Its own
 *  operation (not the general patch) — the security model gates this endpoint. */
export async function setOrgParent(id: string, parentId: string | null): Promise<void> {
  await db.update(schema.organisations).set({ parentId } as any).where(eq(schema.organisations.id, id))
}

/** Set the cross-club member-pull policy (null/'reference' = reference the club's
 *  row, 'copy' = mirror into a governing-owned row). */
export async function setMemberPullMode(id: string, mode: 'reference' | 'copy' | null): Promise<void> {
  await db.update(schema.organisations).set({ memberPullMode: mode } as any).where(eq(schema.organisations.id, id))
}

/** The org-wide default member positions (Captain/Wing/…). */
export async function getDefaultMemberPositions(id: string): Promise<string[]> {
  const [r] = await db.select({ p: schema.organisations.defaultMemberPositions }).from(schema.organisations).where(eq(schema.organisations.id, id)).limit(1)
  return r ? asStrArr(r.p) : []
}

// json column takes the raw JS value (no JSON.stringify — that would double-encode).
export async function setDefaultMemberPositions(id: string, positions: string[]): Promise<void> {
  await db.update(schema.organisations).set({ defaultMemberPositions: positions } as any).where(eq(schema.organisations.id, id))
}

/** The new-club onboarding checklist state (organisations.onboarding jsonb). Null
 *  org / never-saved → {}. */
export async function getOnboarding(id: string): Promise<{ dismissed?: boolean; completed_at?: string | null }> {
  const [r] = await db.select({ o: schema.organisations.onboarding }).from(schema.organisations).where(eq(schema.organisations.id, id)).limit(1)
  const raw: any = r?.o
  if (!raw || typeof raw !== 'object') return {}
  return { dismissed: !!raw.dismissed, completed_at: raw.completed_at ?? null }
}

export async function setOnboarding(id: string, state: { dismissed?: boolean; completed_at?: string | null }): Promise<void> {
  await db.update(schema.organisations).set({ onboarding: state } as any).where(eq(schema.organisations.id, id))
}

/**
 * Onboarding-checklist DETECTION: presence counts across seven domains' tables scoped
 * to one org, plus the org's own name. Returns the { stepKey: done } map the checklist
 * reads. This is a deliberately cross-domain COUNT aggregate (person types, terms, codes,
 * classes, fees, forms, people) with no single domain owner — it lives here beside the
 * onboarding state it decorates so the page needs one call, not eight. Guarded: a bad
 * read surfaces as all-false (checklist un-ticked), never a throw.
 */
export async function onboardingCounts(id: string): Promise<Record<string, boolean>> {
  try {
    const result = await db.execute(sql`
      SELECT
        (SELECT name FROM organisations WHERE id = ${id}) AS club_name,
        (SELECT COUNT(*) FROM person_target_types WHERE org_id = ${id}) AS types,
        (SELECT COUNT(*) FROM org_terms WHERE org_id = ${id}) AS terms,
        (SELECT COUNT(*) FROM group_codes WHERE org_id = ${id}) AS codes,
        (SELECT COUNT(*) FROM member_groups WHERE org_id = ${id} AND (kind IS NULL OR kind <> 'membership')) AS classes,
        (SELECT COUNT(*) FROM group_fee_options WHERE org_id = ${id}) AS fees,
        (SELECT COUNT(*) FROM registration_forms WHERE org_id = ${id}) AS forms,
        (SELECT COUNT(*) FROM persons WHERE org_id = ${id}) AS people
    `)
    const r: any = rowsOf(result)[0] ?? {}
    const n = (v: any) => Number(v) || 0
    return {
      club: !!(r.club_name && String(r.club_name).trim()),
      types: n(r.types) > 0,
      season: n(r.terms) > 0,
      programmes: n(r.codes) > 0,
      class: n(r.classes) > 0,
      fees: n(r.fees) > 0,
      form: n(r.forms) > 0,
      team: n(r.people) > 1,
    }
  } catch {
    return {}
  }
}

/** The clubs a login belongs to (org_members by auth user_id, joined to organisations
 *  for name + logo). The ProfileMenu club switcher. Alpha by name. Distinct from the
 *  persons-by-email read (useMyClubs) — keyed by the auth user id. */
export async function listOrgsForUser(userId: string): Promise<{ orgId: string; name: string; logoUrl: string | null }[]> {
  if (!userId) return []
  const rows = await db
    .select({ orgId: schema.orgMembers.orgId, name: schema.organisations.name, logoUrl: schema.organisations.logoUrl })
    .from(schema.orgMembers)
    .innerJoin(schema.organisations, eq(schema.orgMembers.orgId, schema.organisations.id))
    .where(eq(schema.orgMembers.userId, userId))
  return rows
    .map((r) => ({ orgId: r.orgId, name: r.name, logoUrl: r.logoUrl ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
