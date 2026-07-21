// The repository: the ONLY code that knows how the admin / master-data & reviews
// tables are stored. It turns DB rows into domain objects (the contract shape).
// Nitro routes call these functions; they never touch Drizzle or the DB directly.
// When the backend team's MySQL API replaces this, only this file changes.
//
// The master-data tables (brands, club_types, sport_categories, help_articles) are
// platform-global — NO org_id, so they are listed whole, never filtered by org.
// The config tables (dashboard_templates, page_reviewers) are org-scoped.
//
// json handling: default_modules / default_person_types / default_terminology,
// a help article's steps, and a dashboard template's config are `json` columns.
// mysql2 usually hands them back already parsed, but a driver/config can return the
// raw string — asJson/asObj normalise either (and never throw) so the domain always
// sees a real JS value. Booleans (is_overall_default) are coerced with Boolean() in
// case the driver hands back 0/1.
import { randomUUID } from 'node:crypto'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { db, schema } from '../client'
import type {
  Brand,
  ClubType,
  SportCategory,
  HelpArticle,
  HelpArticleCreate,
  HelpArticlePatch,
  DashboardTemplate,
  PageReviewer,
  BrandCreate,
  BrandPatch,
  ClubTypeCreate,
  ClubTypePatch,
  ClubTypeDefaults,
  CorePermissionGroup,
  CorePermissionGroupCreate,
  CorePermissionGroupPatch,
  OrgAdminRow,
  OrgAdminCreate,
  OrgHierarchyNode,
} from '../../../shared/contracts/admin'

// Coerce a json column into a string[]: already an array → use it; a string →
// parse; anything else / a parse failure → [].
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

// Coerce a json column into a plain object, parsing a raw string; non-object /
// failure → null.
function asObj(v: unknown): Record<string, any> | null {
  const parsed = asJson(v)
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
}

// Coerce a json column into its parsed value, leaving non-string payloads as-is.
function asJson(v: unknown): any {
  if (typeof v === 'string') {
    try {
      return JSON.parse(v)
    } catch {
      return v
    }
  }
  return v ?? null
}

function toBrand(r: typeof schema.brands.$inferSelect): Brand {
  return {
    id: r.id,
    name: r.name,
    logoUrl: r.logoUrl ?? null,
    iconUrl: r.iconUrl ?? null,
    color: r.color ?? null,
    sortOrder: r.sortOrder,
  }
}

function toClubType(r: typeof schema.clubTypes.$inferSelect): ClubType {
  return {
    id: r.id,
    name: r.name,
    defaultModules: asJson(r.defaultModules),
    defaultPersonTypes: asJson(r.defaultPersonTypes),
    defaultTerminology: asJson(r.defaultTerminology),
    defaultEventCategories: asJson(r.defaultEventCategories),
    isOverallDefault: Boolean(r.isOverallDefault),
    sortOrder: r.sortOrder,
  }
}

function toSportCategory(r: typeof schema.sportCategories.$inferSelect): SportCategory {
  return {
    id: r.id,
    name: r.name,
    sortOrder: r.sortOrder,
  }
}

function toHelpArticle(r: typeof schema.helpArticles.$inferSelect): HelpArticle {
  return {
    id: r.id,
    key: r.key,
    title: r.title,
    explanation: r.explanation,
    steps: asJson(r.steps),
    module: r.module ?? null,
    resource: r.resource ?? null,
    route: r.route ?? null,
    sortOrder: r.sortOrder,
    status: r.status,
  }
}

function toDashboardTemplate(r: typeof schema.dashboardTemplates.$inferSelect): DashboardTemplate {
  return {
    orgId: r.orgId,
    userType: r.userType,
    config: asJson(r.config),
  }
}

function toPageReviewer(r: typeof schema.pageReviewers.$inferSelect): PageReviewer {
  return {
    id: r.id,
    orgId: r.orgId,
    name: r.name,
    role: r.role ?? null,
    color: r.color ?? null,
    sortOrder: r.sortOrder,
  }
}

/** Every platform brand, in sort order. Global — no org filter. */
export async function listBrands(): Promise<Brand[]> {
  const rows = await db.select().from(schema.brands).orderBy(asc(schema.brands.sortOrder))
  return rows.map(toBrand)
}

/** Every club type (setup template), in sort order. Global — no org filter. */
export async function listClubTypes(): Promise<ClubType[]> {
  const rows = await db.select().from(schema.clubTypes).orderBy(asc(schema.clubTypes.sortOrder))
  return rows.map(toClubType)
}

/** Every sport category, in sort order. Global — no org filter. */
export async function listSportCategories(): Promise<SportCategory[]> {
  const rows = await db
    .select()
    .from(schema.sportCategories)
    .orderBy(asc(schema.sportCategories.sortOrder))
  return rows.map(toSportCategory)
}

/** Every help article, in sort order. Global — no org filter. */
export async function listHelpArticles(): Promise<HelpArticle[]> {
  const rows = await db
    .select()
    .from(schema.helpArticles)
    .orderBy(asc(schema.helpArticles.sortOrder))
  return rows.map(toHelpArticle)
}

/** The per-role dashboard default templates for one org. */
export async function listDashboardTemplates(orgId: string): Promise<DashboardTemplate[]> {
  const rows = await db
    .select()
    .from(schema.dashboardTemplates)
    .where(eq(schema.dashboardTemplates.orgId, orgId))
  return rows.map(toDashboardTemplate)
}

/** The named reviewers for one org, in sort order. */
export async function listPageReviewers(orgId: string): Promise<PageReviewer[]> {
  const rows = await db
    .select()
    .from(schema.pageReviewers)
    .where(eq(schema.pageReviewers.orgId, orgId))
    .orderBy(asc(schema.pageReviewers.sortOrder))
  return rows.map(toPageReviewer)
}

// ── Writes: Brands ───────────────────────────────────────────────────────────
// The repo owns the id (MySQL can't default a uuid). `as any` mirrors the app's
// insert idiom — the first-pass schema over-requires notNull columns the DB
// defaults (created_at). Reads stay via toBrand so shape never drifts.
export async function getBrand(id: string): Promise<Brand | null> {
  const [r] = await db.select().from(schema.brands).where(eq(schema.brands.id, id)).limit(1)
  return r ? toBrand(r) : null
}

export async function createBrand(input: BrandCreate): Promise<Brand> {
  const id = randomUUID()
  await db.insert(schema.brands).values({
    id, name: input.name, sortOrder: input.sortOrder ?? 0,
  } as any)
  return (await getBrand(id))!
}

export async function updateBrand(id: string, patch: BrandPatch): Promise<Brand | null> {
  const set: Record<string, any> = {}
  if (patch.name !== undefined) set.name = patch.name
  if (patch.logoUrl !== undefined) set.logoUrl = patch.logoUrl
  if (patch.iconUrl !== undefined) set.iconUrl = patch.iconUrl
  if (patch.color !== undefined) set.color = patch.color
  if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder
  if (Object.keys(set).length) await db.update(schema.brands).set(set).where(eq(schema.brands.id, id))
  return getBrand(id)
}

export async function deleteBrand(id: string): Promise<void> {
  await db.delete(schema.brands).where(eq(schema.brands.id, id))
}

// ── Writes: Club types ───────────────────────────────────────────────────────
export async function getClubType(id: string): Promise<ClubType | null> {
  const [r] = await db.select().from(schema.clubTypes).where(eq(schema.clubTypes.id, id)).limit(1)
  return r ? toClubType(r) : null
}

export async function createClubType(input: ClubTypeCreate): Promise<ClubType> {
  const id = randomUUID()
  // isOverallDefault defaults false — a NEW club type is never the overall default.
  await db.insert(schema.clubTypes).values({
    id, name: input.name, sortOrder: input.sortOrder ?? 0, isOverallDefault: false,
  } as any)
  return (await getClubType(id))!
}

export async function updateClubType(id: string, patch: ClubTypePatch): Promise<ClubType | null> {
  const set: Record<string, any> = {}
  if (patch.name !== undefined) set.name = patch.name
  if (Object.keys(set).length) await db.update(schema.clubTypes).set(set).where(eq(schema.clubTypes.id, id))
  return getClubType(id)
}

export async function deleteClubType(id: string): Promise<void> {
  await db.delete(schema.clubTypes).where(eq(schema.clubTypes.id, id))
}

// Save a club type's setup-template payloads. json columns take the RAW JS value
// (never JSON.stringify — drizzle's json() would double-encode).
export async function saveClubTypeDefaults(id: string, d: ClubTypeDefaults): Promise<void> {
  await db.update(schema.clubTypes).set({
    defaultModules: d.defaultModules ?? null,
    defaultPersonTypes: d.defaultPersonTypes ?? null,
    defaultTerminology: d.defaultTerminology ?? null,
    defaultEventCategories: d.defaultEventCategories ?? null,
  } as any).where(eq(schema.clubTypes.id, id))
}

/** The id of the platform-wide "Overall default" template row, or null. */
export async function overallDefaultClubTypeId(): Promise<string | null> {
  const [r] = await db
    .select({ id: schema.clubTypes.id })
    .from(schema.clubTypes)
    .where(eq(schema.clubTypes.isOverallDefault, true))
    .limit(1)
  return r?.id ?? null
}

// ── Writes: Core permission templates ────────────────────────────────────────
// The is_core=true / org_id=null groups every club inherits. `permissions` is the
// raw grant map (json) — passed as a plain JS object on write.
function toCorePermissionGroup(r: typeof schema.permissionGroups.$inferSelect): CorePermissionGroup {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    permissions: asObj(r.permissions) ?? {},
    sortOrder: r.sortOrder,
  }
}

export async function listCorePermissionGroups(): Promise<CorePermissionGroup[]> {
  const rows = await db
    .select()
    .from(schema.permissionGroups)
    .where(eq(schema.permissionGroups.isCore, true))
    .orderBy(asc(schema.permissionGroups.sortOrder), asc(schema.permissionGroups.name))
  return rows.map(toCorePermissionGroup)
}

async function getCorePermissionGroup(id: string): Promise<CorePermissionGroup | null> {
  const [r] = await db.select().from(schema.permissionGroups).where(eq(schema.permissionGroups.id, id)).limit(1)
  return r ? toCorePermissionGroup(r) : null
}

export async function createCorePermissionGroup(input: CorePermissionGroupCreate): Promise<CorePermissionGroup> {
  const id = randomUUID()
  await db.insert(schema.permissionGroups).values({
    id, orgId: null, isCore: true, isSystem: false,
    name: input.name, description: input.description ?? null,
    permissions: input.permissions ?? {}, sortOrder: input.sortOrder ?? 0,
  } as any)
  return (await getCorePermissionGroup(id))!
}

export async function updateCorePermissionGroup(id: string, patch: CorePermissionGroupPatch): Promise<CorePermissionGroup | null> {
  const set: Record<string, any> = {}
  if (patch.name !== undefined) set.name = patch.name
  if (patch.description !== undefined) set.description = patch.description
  if (patch.permissions !== undefined) set.permissions = patch.permissions
  if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder
  // Only ever touches a CORE template (is_core=true) — a stray non-core id can't be
  // rewritten by this admin path.
  if (Object.keys(set).length) {
    await db.update(schema.permissionGroups).set(set)
      .where(and(eq(schema.permissionGroups.id, id), eq(schema.permissionGroups.isCore, true)))
  }
  return getCorePermissionGroup(id)
}

export async function deleteCorePermissionGroup(id: string): Promise<void> {
  await db.delete(schema.permissionGroups)
    .where(and(eq(schema.permissionGroups.id, id), eq(schema.permissionGroups.isCore, true)))
}

/** Persist a new sort_order for each (saved, core) template row. */
export async function reorderCorePermissionGroups(items: { id: string; sortOrder: number }[]): Promise<void> {
  for (const it of items) {
    await db.update(schema.permissionGroups).set({ sortOrder: it.sortOrder })
      .where(and(eq(schema.permissionGroups.id, it.id), eq(schema.permissionGroups.isCore, true)))
  }
}

// ── Cross-org admin dashboard ────────────────────────────────────────────────
// The super-admin table: every non-sandbox org + its member/event counts. Counts
// are two grouped aggregates merged in JS (cheaper + clearer than a double left
// join, and mirrors what the page did before).
export async function listOrgsWithCounts(): Promise<OrgAdminRow[]> {
  const [orgs, personCounts, eventCounts] = await Promise.all([
    db.select({
      id: schema.organisations.id,
      name: schema.organisations.name,
      orgLevel: schema.organisations.orgLevel,
      parentId: schema.organisations.parentId,
      logoUrl: schema.organisations.logoUrl,
      brandId: schema.organisations.brandId,
      clubTypeIds: schema.organisations.clubTypeIds,
      isTemplate: schema.organisations.isTemplate,
    }).from(schema.organisations)
      .where(eq(schema.organisations.isSandbox, false))
      .orderBy(asc(schema.organisations.name)),
    db.select({ orgId: schema.persons.orgId, c: sql<number>`count(*)` })
      .from(schema.persons).groupBy(schema.persons.orgId),
    db.select({ orgId: schema.events.orgId, c: sql<number>`count(*)` })
      .from(schema.events).groupBy(schema.events.orgId),
  ])
  const memberBy = new Map(personCounts.map((r) => [r.orgId, Number(r.c)]))
  const eventBy = new Map(eventCounts.map((r) => [r.orgId, Number(r.c)]))
  return orgs.map((o) => ({
    id: o.id,
    name: o.name,
    orgLevel: o.orgLevel,
    parentId: o.parentId ?? null,
    logoUrl: o.logoUrl ?? null,
    brandId: o.brandId ?? null,
    clubTypeIds: asArray(o.clubTypeIds),
    isTemplate: !!o.isTemplate,
    members: memberBy.get(o.id) ?? 0,
    events: eventBy.get(o.id) ?? 0,
  }))
}

/** Mark/unmark an org as a reusable setup template. */
export async function setOrgTemplate(id: string, isTemplate: boolean): Promise<void> {
  await db.update(schema.organisations).set({ isTemplate }).where(eq(schema.organisations.id, id))
}

/** Create an org from the admin dashboard — the FULL row. Returns its new id. */
export async function createOrgAdmin(input: OrgAdminCreate): Promise<{ id: string }> {
  const id = randomUUID()
  await db.insert(schema.organisations).values({
    id,
    name: input.name,
    type: input.type,
    orgLevel: input.orgLevel,
    parentId: input.parentId ?? null,
    defaultSportName: input.defaultSportName ?? null,
    brandId: input.brandId ?? null,
    clubTypeIds: input.clubTypeIds ?? [],
  } as any)
  return { id }
}

/** Change an org's level (+ its type, kept consistent). A privileged admin op. */
export async function setOrgLevel(id: string, orgLevel: string, type: string): Promise<void> {
  await db.update(schema.organisations).set({ orgLevel, type }).where(eq(schema.organisations.id, id))
}

/** Assign a club's club types. json column takes the raw array. */
export async function setOrgClubTypes(id: string, ids: string[]): Promise<void> {
  await db.update(schema.organisations).set({ clubTypeIds: ids ?? [] } as any).where(eq(schema.organisations.id, id))
}

/** Connect (or clear) an org's brand. */
export async function setOrgBrand(id: string, brandId: string | null): Promise<void> {
  await db.update(schema.organisations).set({ brandId }).where(eq(schema.organisations.id, id))
}

/** The hidden Template Sandbox org's id (the preview canvas for dashboard templates), or null. */
export async function getSandboxOrgId(): Promise<string | null> {
  const [r] = await db
    .select({ id: schema.organisations.id })
    .from(schema.organisations)
    .where(eq(schema.organisations.isSandbox, true))
    .limit(1)
  return r?.id ?? null
}

/** Club-type ids (+ name) for a set of orgs — governing-chain inheritance resolution. */
export async function listOrgClubTypeIds(ids: string[]): Promise<{ id: string; name: string; clubTypeIds: string[] }[]> {
  if (!ids.length) return []
  const rows = await db.select({
    id: schema.organisations.id,
    name: schema.organisations.name,
    clubTypeIds: schema.organisations.clubTypeIds,
  }).from(schema.organisations).where(inArray(schema.organisations.id, ids))
  return rows.map((r) => ({ id: r.id, name: r.name, clubTypeIds: asArray(r.clubTypeIds) }))
}

// ── enabled_modules (Club setup) ─────────────────────────────────────────────
export async function getOrgModules(orgId: string): Promise<string[] | null> {
  const [r] = await db
    .select({ enabledModules: schema.organisations.enabledModules })
    .from(schema.organisations)
    .where(eq(schema.organisations.id, orgId))
    .limit(1)
  const v = r?.enabledModules
  return Array.isArray(v) ? (v as string[]) : (typeof v === 'string' ? asArray(v) : null)
}

/** Persist the enabled non-core module keys (null = reset to all-on). */
export async function setOrgModules(orgId: string, keys: string[] | null): Promise<void> {
  await db.update(schema.organisations).set({ enabledModules: keys } as any).where(eq(schema.organisations.id, orgId))
}

// ── Org hierarchy (recursive CTEs) ───────────────────────────────────────────
// Replaces the Postgres org_ancestors / org_descendants / org_sport_ancestors
// RPCs with MySQL 8 recursive CTEs. Raw SQL returns snake_case columns; map them.
// depth-capped at 20 (the parent_id chain has no DB cycle guard).
function rowsOf(result: any): any[] {
  if (Array.isArray(result)) return Array.isArray(result[0]) ? result[0] : result
  return result?.rows ?? []
}

function toHierNode(r: any, viaSport: string | null = null): OrgHierarchyNode {
  return {
    id: r.id,
    name: r.name,
    type: r.type ?? null,
    orgLevel: r.org_level,
    parentId: r.parent_id ?? null,
    depth: Number(r.depth),
    viaSport: r.via_sport ?? viaSport,
  }
}

/** Ancestors up the parent_id chain (immediate parent first). Excludes self. */
export async function orgAncestors(orgId: string): Promise<OrgHierarchyNode[]> {
  const result = await db.execute(sql`
    WITH RECURSIVE ancestors AS (
      SELECT id, name, type, org_level, parent_id, 0 AS depth
      FROM organisations WHERE id = ${orgId}
      UNION ALL
      SELECT p.id, p.name, p.type, p.org_level, p.parent_id, a.depth + 1
      FROM organisations p JOIN ancestors a ON p.id = a.parent_id
      WHERE a.depth < 20
    )
    SELECT * FROM ancestors WHERE id <> ${orgId} ORDER BY depth
  `)
  return rowsOf(result).map((r) => toHierNode(r))
}

/** Descendants down the parent_id tree (direct children first). Excludes self. */
export async function orgDescendants(orgId: string): Promise<OrgHierarchyNode[]> {
  const result = await db.execute(sql`
    WITH RECURSIVE descendants AS (
      SELECT id, name, type, org_level, parent_id, 0 AS depth
      FROM organisations WHERE id = ${orgId}
      UNION ALL
      SELECT c.id, c.name, c.type, c.org_level, c.parent_id, d.depth + 1
      FROM organisations c JOIN descendants d ON c.parent_id = d.id
      WHERE d.depth < 20
    )
    SELECT * FROM descendants WHERE id <> ${orgId} ORDER BY depth, name
  `)
  return rowsOf(result).map((r) => toHierNode(r))
}

/**
 * Every governing body above an org: the parent_id chain PLUS each APPROVED sport
 * affiliation's chain (org_sports.nso_org_id → walk that body's ancestors). Dedupe
 * by id, parent chain wins (a body reachable both ways is an ancestor proper). The
 * union is load-bearing — a multi-sport club reaches all but its primary body only
 * via org_sports (see useOrgHierarchy).
 */
export async function orgGoverning(orgId: string): Promise<OrgHierarchyNode[]> {
  // Parent chain (via_sport null) — the org itself included as the seed, excluded on output.
  const parentChain = await orgAncestors(orgId)
  // Sport chains: for each approved affiliation, that NSO + its ancestors, tagged with the sport.
  const sportResult = await db.execute(sql`
    WITH RECURSIVE sport_chain AS (
      SELECT o.id, o.name, o.type, o.org_level, o.parent_id, os.sport AS via_sport, 0 AS depth
      FROM org_sports os
      JOIN organisations o ON o.id = os.nso_org_id
      WHERE os.org_id = ${orgId} AND os.nso_org_id IS NOT NULL AND os.affiliation_status = 'approved'
      UNION ALL
      SELECT p.id, p.name, p.type, p.org_level, p.parent_id, sc.via_sport, sc.depth + 1
      FROM organisations p JOIN sport_chain sc ON p.id = sc.parent_id
      WHERE sc.depth < 20
    )
    SELECT * FROM sport_chain WHERE id <> ${orgId}
  `)
  const sportChain = rowsOf(sportResult).map((r) => toHierNode(r))
  // Parent chain first so it wins the dedupe.
  const byId = new Map<string, OrgHierarchyNode>()
  for (const o of [...parentChain, ...sportChain]) {
    if (!byId.has(o.id)) byId.set(o.id, o)
  }
  return [...byId.values()]
}

// ── Seed a new club from its club types' defaults (migrations 248 + 255) ──────
// Runs the whole applyClubTypeDefaults operation server-side so the composable
// stays one call. Reads club_types, patches the org (enabled_modules / terminology)
// and seeds any MISSING person_target_types + dashboard_templates. Never clobbers
// rows the org already has. json columns take raw JS values.
//
// NOTE (cross-domain): this writes person_target_types, whose WRITES are otherwise
// owned by the fields/types domain. It's kept here because seeding a new club is a
// single admin operation; the column set matches the app's original insert
// (personTargetTypes: key/label/kind/is_access/min_count/max_count/sort_order/
// permissions/menu_items/landing_path — plus the schema's other notNull columns
// filled by `as any` defaults).
export async function applyClubTypeDefaults(
  orgId: string,
  typeIds: string[],
  defaultDashboardFor: (key: string) => any[] | null,
): Promise<void> {
  if (!orgId) return
  // Overall default is the BASE; the club's own types extend/override it (later-wins).
  const overallId = await overallDefaultClubTypeId()
  const ids = [...(overallId ? [overallId] : []), ...(typeIds ?? [])]
  if (!ids.length) return
  const rawTypes = await db.select({
    id: schema.clubTypes.id,
    defaultModules: schema.clubTypes.defaultModules,
    defaultPersonTypes: schema.clubTypes.defaultPersonTypes,
    defaultTerminology: schema.clubTypes.defaultTerminology,
    defaultEventCategories: schema.clubTypes.defaultEventCategories,
  }).from(schema.clubTypes).where(inArray(schema.clubTypes.id, ids))
  if (!rawTypes.length) return
  // Re-order to match ids (overall default first) so later-wins is deterministic.
  const types = ids.map((id) => rawTypes.find((t) => t.id === id)).filter(Boolean) as typeof rawTypes

  // Modules — union of every type that specifies a set; if none, leave null (all on).
  // asJson tolerates a driver handing json back as a raw string.
  const moduleSets = types
    .map((t) => { const v = asJson(t.defaultModules); return Array.isArray(v) ? (v as string[]) : null })
    .filter((x): x is string[] => x !== null)
  const modules: string[] | null = moduleSets.length ? [...new Set(moduleSets.flat())] : null

  // Terminology — merge, later type wins.
  let terminology: Record<string, any> = {}
  for (const t of types) terminology = { ...terminology, ...(asObj(t.defaultTerminology) ?? {}) }

  const patch: Record<string, any> = {}
  if (modules) patch.enabledModules = modules
  if (Object.keys(terminology).length) patch.terminology = terminology
  if (Object.keys(patch).length) await db.update(schema.organisations).set(patch as any).where(eq(schema.organisations.id, orgId))

  // Person types — later-wins per key (overall default first), seeding the FULL config.
  const ptByKey = new Map<string, any>()
  for (const t of types) for (const pt of (asJson(t.defaultPersonTypes) ?? []) as any[]) {
    if (pt?.key) ptByKey.set(pt.key, pt)
  }
  if (ptByKey.size) {
    const existing = await db.select({ key: schema.personTargetTypes.key })
      .from(schema.personTargetTypes).where(eq(schema.personTargetTypes.orgId, orgId))
    const have = new Set(existing.map((r) => r.key))
    const rows = [...ptByKey.values()].filter((pt) => !have.has(pt.key)).map((pt, i) => ({
      id: randomUUID(), orgId, key: pt.key, label: pt.label, kind: 'person',
      isAccess: !!pt.is_access, minCount: 0, maxCount: null, sortOrder: i,
      permissions: pt.permissions ?? {}, memberSlots: [],
      menuItems: pt.menu_items ?? null, landingPath: pt.landing_path ?? null,
      isGlobal: false, isPublished: true,
    }))
    if (rows.length) await db.insert(schema.personTargetTypes).values(rows as any)
  }

  // Per-type starting DASHBOARD → dashboard_templates (user_type = the type key).
  const dashByKey = new Map<string, any[]>()
  for (const pt of ptByKey.values()) {
    const dash = pt.dashboard ?? defaultDashboardFor(pt.key)
    if (Array.isArray(dash) && dash.length) dashByKey.set(pt.key, dash)
  }
  if (dashByKey.size) {
    const existing = await db.select({ userType: schema.dashboardTemplates.userType })
      .from(schema.dashboardTemplates).where(eq(schema.dashboardTemplates.orgId, orgId))
    const have = new Set(existing.map((r) => r.userType))
    const dashRows = [...dashByKey.entries()].filter(([k]) => !have.has(k))
      .map(([userType, config]) => ({ orgId, userType, config }))
    if (dashRows.length) await db.insert(schema.dashboardTemplates).values(dashRows as any)
  }

  // Event categories — union of every type's list, first occurrence wins order, then
  // seed the `categories` rows the club doesn't already have (matched by name,
  // case-insensitive). A colour is assigned from a small cycling palette so seeded
  // categories aren't all grey.
  const catNames: string[] = []
  const seenCat = new Set<string>()
  for (const t of types) for (const raw of (asJson(t.defaultEventCategories) ?? []) as any[]) {
    const name = String(raw ?? '').trim()
    if (!name) continue
    const lower = name.toLowerCase()
    if (seenCat.has(lower)) continue
    seenCat.add(lower)
    catNames.push(name)
  }
  if (catNames.length) {
    const existing = await db.select({ name: schema.categories.name })
      .from(schema.categories).where(eq(schema.categories.orgId, orgId))
    const have = new Set(existing.map((r) => (r.name ?? '').toLowerCase()))
    const CAT_PALETTE = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6']
    const catRows = catNames.filter((n) => !have.has(n.toLowerCase())).map((name, i) => ({
      id: randomUUID(), orgId, name, color: CAT_PALETTE[i % CAT_PALETTE.length], sortOrder: i,
    }))
    if (catRows.length) await db.insert(schema.categories).values(catRows as any)
  }
}

/**
 * Clone a TEMPLATE org's config/structure into a freshly-created org. Copies ONLY
 * configuration + structure — never people or operational data. The confirmed allowlist:
 *   • organisations config columns (modules, terminology, core fields, brand, dashboards)
 *   • person_target_types (+ their field_definitions + profile_forms layouts)
 *   • dashboard_templates, categories (event), group_codes (empty structure)
 *   • scoped_role_defs, org-level permission_groups (overrides)
 * NEVER: persons, org_members, events/sessions/registrations/invitees, bookings,
 * member_groups/memberships, transactions, notes, communications, resources, org_terms.
 *
 * Uses select-all + spread-override so every column carries across; only id/org_id and a
 * few FKs into un-cloned operational data are re-mapped or nulled. Runs INSTEAD of
 * applyClubTypeDefaults when a club is created from a template (the template IS the config).
 */
export async function cloneOrgConfig(templateOrgId: string, targetOrgId: string): Promise<void> {
  if (!templateOrgId || !targetOrgId || templateOrgId === targetOrgId) return

  // 1. organisations — copy config/brand columns only (never identity: name/slug/type/
  //    parent/level/club-type/is_template/is_sandbox stay the new org's own).
  const [tpl] = await db.select({
    enabledModules: schema.organisations.enabledModules,
    terminology: schema.organisations.terminology,
    coreFields: schema.organisations.coreFields,
    brandId: schema.organisations.brandId,
    brandColor: schema.organisations.brandColor,
    brandTextColor: schema.organisations.brandTextColor,
    dashboardConfig: schema.organisations.dashboardConfig,
    profileDashboard: schema.organisations.profileDashboard,
    currency: schema.organisations.currency,
    locale: schema.organisations.locale,
    defaultMemberPositions: schema.organisations.defaultMemberPositions,
    peopleColumns: schema.organisations.peopleColumns,
  }).from(schema.organisations).where(eq(schema.organisations.id, templateOrgId)).limit(1)
  if (!tpl) return
  // Build the patch defensively: copy a config field only when it actually has content.
  // Some legacy rows store '' in a json column (terminology/core_fields) — writing '' to a
  // JSON column is invalid, and an empty value shouldn't overwrite the target's own default
  // anyway. Scalars (currency/locale/brand*) copy when non-empty; json cols parse via asJson
  // (the driver may hand json back as a string) and copy only when non-empty.
  const orgPatch: Record<string, any> = {}
  for (const k of ['currency', 'locale', 'brandId', 'brandColor', 'brandTextColor'] as const) {
    const v = (tpl as any)[k]
    if (v != null && v !== '') orgPatch[k] = v
  }
  for (const k of ['terminology', 'coreFields', 'dashboardConfig', 'profileDashboard', 'peopleColumns', 'defaultMemberPositions', 'enabledModules'] as const) {
    const v = asJson((tpl as any)[k])
    const empty = v == null
      || (Array.isArray(v) && v.length === 0)
      || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0)
    if (!empty) orgPatch[k] = v
  }
  if (Object.keys(orgPatch).length) {
    await db.update(schema.organisations).set(orgPatch as any).where(eq(schema.organisations.id, targetOrgId))
  }

  // 2. person_target_types — new id + org_id, everything else (permissions/slots/menu/
  //    landing/kind) carried across. Type KEYS are what fields target, so they stay stable.
  const ptypes = await db.select().from(schema.personTargetTypes).where(eq(schema.personTargetTypes.orgId, templateOrgId))
  if (ptypes.length) {
    await db.insert(schema.personTargetTypes).values(
      ptypes.map(r => ({ ...r, id: randomUUID(), orgId: targetOrgId })) as any)
  }

  // 3. field_definitions — the types' own custom fields. target/targets are type KEYS
  //    (identical in the clone), so no remap. default_form_id would point at an un-cloned
  //    form → not present on field_definitions, nothing to null.
  const fdefs = await db.select().from(schema.fieldDefinitions).where(eq(schema.fieldDefinitions.orgId, templateOrgId))
  if (fdefs.length) {
    await db.insert(schema.fieldDefinitions).values(
      fdefs.map(r => ({ ...r, id: randomUUID(), orgId: targetOrgId })) as any)
  }

  // 4. profile_forms — per-type form LAYOUT (pk org_id+type_key, no id).
  const pforms = await db.select().from(schema.profileForms).where(eq(schema.profileForms.orgId, templateOrgId))
  if (pforms.length) {
    await db.insert(schema.profileForms).values(
      pforms.map(r => ({ ...r, orgId: targetOrgId })) as any)
  }

  // 5. dashboard_templates — per-role starting dashboards (pk org_id+user_type, no id).
  const dtpls = await db.select().from(schema.dashboardTemplates).where(eq(schema.dashboardTemplates.orgId, templateOrgId))
  if (dtpls.length) {
    await db.insert(schema.dashboardTemplates).values(
      dtpls.map(r => ({ ...r, orgId: targetOrgId })) as any)
  }

  // 6. categories (event) — remap self parent_id; null default_form_id (form not cloned)
  //    and access_person_ids (points at TEMPLATE persons — never carry PII across).
  const cats = await db.select().from(schema.categories).where(eq(schema.categories.orgId, templateOrgId))
  if (cats.length) {
    const idMap = new Map(cats.map(c => [c.id, randomUUID()]))
    await db.insert(schema.categories).values(cats.map(c => ({
      ...c,
      id: idMap.get(c.id)!,
      orgId: targetOrgId,
      parentId: c.parentId ? (idMap.get(c.parentId) ?? null) : null,
      defaultFormId: null,
      accessPersonIds: [],
    })) as any)
  }

  // 7. group_codes — EMPTY structure (no member_groups cloned). Remap self parent_id;
  //    null term_id/sport_id/lineage_id (org_terms + org_sports are not cloned).
  const codes = await db.select().from(schema.groupCodes).where(eq(schema.groupCodes.orgId, templateOrgId))
  if (codes.length) {
    const idMap = new Map(codes.map(c => [c.id, randomUUID()]))
    await db.insert(schema.groupCodes).values(codes.map(c => ({
      ...c,
      id: idMap.get(c.id)!,
      orgId: targetOrgId,
      parentId: c.parentId ? (idMap.get(c.parentId) ?? null) : null,
      termId: null,
      sportId: null,
      lineageId: null,
    })) as any)
  }

  // 8. scoped_role_defs — the org's scoped role catalogue.
  const sroles = await db.select().from(schema.scopedRoleDefs).where(eq(schema.scopedRoleDefs.orgId, templateOrgId))
  if (sroles.length) {
    await db.insert(schema.scopedRoleDefs).values(
      sroles.map(r => ({ ...r, id: randomUUID(), orgId: targetOrgId })) as any)
  }

  // 9. permission_groups — the org's OWN overrides only (org_id=template). source_group_id
  //    points at a platform CORE group (org_id=null, shared) so it stays valid.
  const pgroups = await db.select().from(schema.permissionGroups).where(eq(schema.permissionGroups.orgId, templateOrgId))
  if (pgroups.length) {
    await db.insert(schema.permissionGroups).values(
      pgroups.map(r => ({ ...r, id: randomUUID(), orgId: targetOrgId })) as any)
  }
}

/** Upsert a per-role dashboard template (the template-edit-mode Save). Keyed by the
 *  (org, userType) composite pk: update the config when the row exists, else insert.
 *  config is a json column — takes the raw JS value (no JSON.stringify). */
export async function saveDashboardTemplate(orgId: string, userType: string, config: any): Promise<void> {
  const [existing] = await db
    .select({ userType: schema.dashboardTemplates.userType })
    .from(schema.dashboardTemplates)
    .where(and(eq(schema.dashboardTemplates.orgId, orgId), eq(schema.dashboardTemplates.userType, userType)))
    .limit(1)
  if (existing) {
    await db
      .update(schema.dashboardTemplates)
      .set({ config, updatedAt: new Date() } as any)
      .where(and(eq(schema.dashboardTemplates.orgId, orgId), eq(schema.dashboardTemplates.userType, userType)))
  } else {
    await db.insert(schema.dashboardTemplates).values({ orgId, userType, config } as any)
  }
}

/** Delete a per-role dashboard template (reverts that role to the standard layout).
 *  Keyed by the (org, userType) composite pk. */
export async function deleteDashboardTemplate(orgId: string, userType: string): Promise<void> {
  await db
    .delete(schema.dashboardTemplates)
    .where(and(eq(schema.dashboardTemplates.orgId, orgId), eq(schema.dashboardTemplates.userType, userType)))
}

// ── Help-article writes (/admin/help editor) ──
async function getHelpArticle(id: string): Promise<HelpArticle | null> {
  const [r] = await db.select().from(schema.helpArticles).where(eq(schema.helpArticles.id, id)).limit(1)
  return r ? toHelpArticle(r) : null
}

/** Create a help article. json `steps` takes the raw JS value. */
export async function createHelpArticle(input: HelpArticleCreate): Promise<HelpArticle> {
  const id = randomUUID()
  await db.insert(schema.helpArticles).values({
    id,
    key: input.key,
    title: input.title,
    explanation: input.explanation ?? '',
    steps: input.steps ?? [],
    module: input.module ?? null,
    resource: input.resource ?? null,
    route: input.route ?? null,
    sortOrder: input.sortOrder ?? 0,
    status: input.status ?? 'draft',
  } as any)
  return (await getHelpArticle(id))!
}

export async function updateHelpArticle(id: string, patch: HelpArticlePatch): Promise<HelpArticle | null> {
  const set: Record<string, any> = {}
  if (patch.key !== undefined) set.key = patch.key
  if (patch.title !== undefined) set.title = patch.title
  if (patch.explanation !== undefined) set.explanation = patch.explanation
  if (patch.steps !== undefined) set.steps = patch.steps
  if (patch.module !== undefined) set.module = patch.module
  if (patch.resource !== undefined) set.resource = patch.resource
  if (patch.route !== undefined) set.route = patch.route
  if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder
  if (patch.status !== undefined) set.status = patch.status
  if (Object.keys(set).length) {
    set.updatedAt = new Date()
    await db.update(schema.helpArticles).set(set as any).where(eq(schema.helpArticles.id, id))
  }
  return getHelpArticle(id)
}

export async function deleteHelpArticle(id: string): Promise<void> {
  await db.delete(schema.helpArticles).where(eq(schema.helpArticles.id, id))
}
