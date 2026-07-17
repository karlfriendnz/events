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
import { asc, eq } from 'drizzle-orm'
import { db, schema } from '../client'
import type {
  Brand,
  ClubType,
  SportCategory,
  HelpArticle,
  DashboardTemplate,
  PageReviewer,
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
