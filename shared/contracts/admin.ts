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
  sortOrder: z.number().int(),
  status: z.string(),
})
export type HelpArticle = z.infer<typeof helpArticleSchema>
export const helpArticleListSchema = z.array(helpArticleSchema)

// WRITE contracts for the /admin/help editor. Create needs key + title; everything
// else defaults in the repo. steps is a free json array.
export const helpArticleCreateSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  explanation: z.string().optional(),
  steps: z.any().optional(),
  module: z.string().nullable().optional(),
  resource: z.string().nullable().optional(),
  route: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  status: z.string().optional(),
})
export type HelpArticleCreate = z.infer<typeof helpArticleCreateSchema>

export const helpArticlePatchSchema = helpArticleCreateSchema.partial().extend({ key: z.string().min(1).optional() })
export type HelpArticlePatch = z.infer<typeof helpArticlePatchSchema>

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

// ── WRITE contracts ──────────────────────────────────────────────────────────
// The super-admin Master screens (brands, club types), the permission-template
// editor and the cross-org admin dashboard all mutate. Create omits server-owned
// fields (id — the repo generates it); patches are partials.

// Brands.
export const brandCreateSchema = z.object({
  name: z.string().min(1),
  sortOrder: z.number().int().optional(),
})
export type BrandCreate = z.infer<typeof brandCreateSchema>
export const brandPatchSchema = z.object({
  name: z.string().min(1).optional(),
  logoUrl: z.string().nullable().optional(),
  iconUrl: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
})
export type BrandPatch = z.infer<typeof brandPatchSchema>

// Club types. Create/rename only touch identity; the setup-template payloads are
// saved separately (defaults route) so the two concerns don't fight one PATCH.
export const clubTypeCreateSchema = z.object({
  name: z.string().min(1),
  sortOrder: z.number().int().optional(),
})
export type ClubTypeCreate = z.infer<typeof clubTypeCreateSchema>
export const clubTypePatchSchema = z.object({
  name: z.string().min(1).optional(),
})
export type ClubTypePatch = z.infer<typeof clubTypePatchSchema>

// The setup-template defaults a club type carries (json payloads stay `any`).
export const clubTypeDefaultsSchema = z.object({
  defaultModules: z.any().nullable(),
  defaultPersonTypes: z.any().nullable(),
  defaultTerminology: z.any().nullable(),
})
export type ClubTypeDefaults = z.infer<typeof clubTypeDefaultsSchema>

// A core permission TEMPLATE (permission_groups where is_core=true, org_id=null),
// as the super-admin editor sees it: it carries `description` and the raw
// `permissions` map (unlike the org-facing PermissionGroup shape, which renames
// permissions → grants and drops description).
export const corePermissionGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  permissions: z.any(),
  sortOrder: z.number().int(),
})
export type CorePermissionGroup = z.infer<typeof corePermissionGroupSchema>
export const corePermissionGroupListSchema = z.array(corePermissionGroupSchema)
export const corePermissionGroupCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  permissions: z.any().optional(),
  sortOrder: z.number().int().optional(),
})
export type CorePermissionGroupCreate = z.infer<typeof corePermissionGroupCreateSchema>
export const corePermissionGroupPatchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  permissions: z.any().optional(),
  sortOrder: z.number().int().optional(),
})
export type CorePermissionGroupPatch = z.infer<typeof corePermissionGroupPatchSchema>
// A reorder = the new sort_order for each saved row.
export const reorderItemSchema = z.object({ id: z.string(), sortOrder: z.number().int() })
export const reorderListSchema = z.array(reorderItemSchema)

// A row in the super-admin cross-org table: identity + brand/type wiring + the
// member/event counts the dashboard shows. Deliberately richer than the base
// Organisation contract (which is identity/tree only), and admin-domain owned.
export const orgAdminRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  orgLevel: z.string(),
  parentId: z.string().nullable(),
  logoUrl: z.string().nullable(),
  brandId: z.string().nullable(),
  clubTypeIds: z.array(z.string()),
  members: z.number().int(),
  events: z.number().int(),
})
export type OrgAdminRow = z.infer<typeof orgAdminRowSchema>
export const orgAdminRowListSchema = z.array(orgAdminRowSchema)

// Creating an org from the admin dashboard writes the FULL row (type / level /
// parent / default sport / brand / club types) — more than the slim base create,
// so it's an admin-domain contract.
export const orgAdminCreateSchema = z.object({
  name: z.string().min(1),
  orgLevel: z.string(),
  type: z.string(),
  parentId: z.string().nullable().optional(),
  defaultSportName: z.string().nullable().optional(),
  brandId: z.string().nullable().optional(),
  clubTypeIds: z.array(z.string()).optional(),
})
export type OrgAdminCreate = z.infer<typeof orgAdminCreateSchema>

// A club's own + effective club-type ids, keyed by id (for governing-chain
// inheritance resolution).
export const orgClubTypeIdsSchema = z.object({
  id: z.string(),
  name: z.string(),
  clubTypeIds: z.array(z.string()),
})
export const orgClubTypeIdsListSchema = z.array(orgClubTypeIdsSchema)

// A node in an org-hierarchy walk as useOrgHierarchy consumes it — carries `type`
// and `viaSport` (which sport affiliation reached a governing body), unlike the
// slim OrgTreeNode. camelCase at the boundary; the composable maps to its
// snake_case OrgNode for existing consumers.
export const orgHierarchyNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string().nullable(),
  orgLevel: z.string(),
  parentId: z.string().nullable(),
  depth: z.number().int(),
  viaSport: z.string().nullable(),
})
export type OrgHierarchyNode = z.infer<typeof orgHierarchyNodeSchema>
export const orgHierarchyNodeListSchema = z.array(orgHierarchyNodeSchema)

// A nullable single-id lookup (overall-default club type, sandbox org).
export const idResultSchema = z.object({ id: z.string().nullable() })
export type IdResult = z.infer<typeof idResultSchema>

// enabled_modules is null (all on) or an explicit key list.
export const orgModulesSchema = z.object({ enabledModules: z.array(z.string()).nullable() })
export type OrgModules = z.infer<typeof orgModulesSchema>
