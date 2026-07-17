// The CONTRACT for the admin / master-data & reviews domain: Zod schemas + the
// domain types inferred from them, shared by the client (typed composable) and the
// server (Nitro route output validation). DB-neutral by design.
//
// Two flavours of table live here:
//   • Platform-global master data — brands, club_types, sport_categories,
//     help_articles — have NO org_id; they are the catalogues every club draws
//     from, so they are never filtered by org.
//   • Org-scoped config — dashboard_templates, page_reviewers — carry an org_id
//     and are listed per org.
//
// The json columns (a club type's default_* payloads, a help article's steps, a
// dashboard template's config) are `json` in MySQL today, were Postgres jsonb
// before, and stay `any` at the boundary — the UI owns their shape, the contract
// only guarantees they arrive parsed.
import { z } from 'zod'

// A platform brand a club connects to (organisations.brand_id → this).
export const brandSchema = z.object({
  id: z.string(),
  name: z.string(),
  logoUrl: z.string().nullable(),
  iconUrl: z.string().nullable(),
  color: z.string().nullable(),
  sortOrder: z.number().int(),
})
export type Brand = z.infer<typeof brandSchema>
export const brandListSchema = z.array(brandSchema)

// A club-type SETUP TEMPLATE. The default_* payloads seed a new club of this type;
// isOverallDefault marks the one platform-wide base every club inherits.
export const clubTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  defaultModules: z.any().nullable(),
  defaultPersonTypes: z.any().nullable(),
  defaultTerminology: z.any().nullable(),
  isOverallDefault: z.boolean(),
  sortOrder: z.number().int(),
})
export type ClubType = z.infer<typeof clubTypeSchema>
export const clubTypeListSchema = z.array(clubTypeSchema)

// A platform sport-category catalogue entry.
export const sportCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  sortOrder: z.number().int(),
})
export type SportCategory = z.infer<typeof sportCategorySchema>
export const sportCategoryListSchema = z.array(sportCategorySchema)

// A help-documentation article (platform-global, terminology-tokenised at render).
export const helpArticleSchema = z.object({
  id: z.string(),
  key: z.string(),
  title: z.string(),
  explanation: z.string(),
  steps: z.any(),
  module: z.string().nullable(),
  resource: z.string().nullable(),
  route: z.string().nullable(),
  status: z.string(),
})
export type HelpArticle = z.infer<typeof helpArticleSchema>
export const helpArticleListSchema = z.array(helpArticleSchema)

// A per-role club-dashboard default template. userType = a permission group id or
// '_default'; config is the widget-layout payload.
export const dashboardTemplateSchema = z.object({
  orgId: z.string(),
  userType: z.string(),
  config: z.any().nullable(),
})
export type DashboardTemplate = z.infer<typeof dashboardTemplateSchema>
export const dashboardTemplateListSchema = z.array(dashboardTemplateSchema)

// A named reviewer in the in-app prototype review system.
export const pageReviewerSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  role: z.string().nullable(),
  color: z.string().nullable(),
  sortOrder: z.number().int(),
})
export type PageReviewer = z.infer<typeof pageReviewerSchema>
export const pageReviewerListSchema = z.array(pageReviewerSchema)
