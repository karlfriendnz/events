// The client side of the seam for admin / master-data & reviews. Components call
// this — never useDb(), never Supabase, never $fetch to a raw table. It returns
// fully-typed domain objects (the shared contract), so a component has no idea
// whether the data came from MySQL today or the backend team's API tomorrow.
//
// brands / clubTypes / sportCategories / helpArticles are platform-global (no org
// argument); dashboardTemplates / pageReviewers are org-scoped.
import type {
  Brand,
  ClubType,
  SportCategory,
  HelpArticle,
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
} from '../shared/contracts/admin'

export function useAdminApi() {
  /** The platform brand catalogue (global). */
  async function brands(): Promise<Brand[]> {
    return await $fetch<Brand[]>('/api/v1/brands')
  }
  /** The club-type setup-template catalogue (global). */
  async function clubTypes(): Promise<ClubType[]> {
    return await $fetch<ClubType[]>('/api/v1/club-types')
  }
  /** The sport-category catalogue (global). */
  async function sportCategories(): Promise<SportCategory[]> {
    return await $fetch<SportCategory[]>('/api/v1/sport-categories')
  }
  /** The help-documentation catalogue (global). */
  async function helpArticles(): Promise<HelpArticle[]> {
    return await $fetch<HelpArticle[]>('/api/v1/help-articles')
  }
  /** The per-role dashboard default templates for one org. */
  async function dashboardTemplates(orgId: string): Promise<DashboardTemplate[]> {
    return await $fetch<DashboardTemplate[]>('/api/v1/dashboard-templates', { query: { orgId } })
  }
  /** The named reviewers for one org. */
  async function pageReviewers(orgId: string): Promise<PageReviewer[]> {
    return await $fetch<PageReviewer[]>('/api/v1/page-reviewers', { query: { orgId } })
  }

  // ── Brands (writes) ──
  async function createBrand(input: BrandCreate): Promise<Brand> {
    return await $fetch<Brand>('/api/v1/brands', { method: 'POST', body: input })
  }
  async function updateBrand(id: string, patch: BrandPatch): Promise<Brand> {
    return await $fetch<Brand>(`/api/v1/brands/${id}`, { method: 'PATCH', body: patch })
  }
  async function deleteBrand(id: string): Promise<void> {
    await $fetch(`/api/v1/brands/${id}`, { method: 'DELETE' })
  }

  // ── Club types (writes + defaults) ──
  async function getClubType(id: string): Promise<ClubType> {
    return await $fetch<ClubType>(`/api/v1/club-types/${id}`)
  }
  async function createClubType(input: ClubTypeCreate): Promise<ClubType> {
    return await $fetch<ClubType>('/api/v1/club-types', { method: 'POST', body: input })
  }
  async function updateClubType(id: string, patch: ClubTypePatch): Promise<ClubType> {
    return await $fetch<ClubType>(`/api/v1/club-types/${id}`, { method: 'PATCH', body: patch })
  }
  async function deleteClubType(id: string): Promise<void> {
    await $fetch(`/api/v1/club-types/${id}`, { method: 'DELETE' })
  }
  async function saveClubTypeDefaults(id: string, defaults: ClubTypeDefaults): Promise<void> {
    await $fetch(`/api/v1/club-types/${id}/defaults`, { method: 'PATCH', body: defaults })
  }
  /** The id of the platform "Overall default" club-type template, or null. */
  async function overallDefaultClubTypeId(): Promise<string | null> {
    const r = await $fetch<{ id: string | null }>('/api/v1/club-types/overall-default')
    return r.id
  }

  // ── Core permission templates ──
  async function corePermissionGroups(): Promise<CorePermissionGroup[]> {
    return await $fetch<CorePermissionGroup[]>('/api/v1/admin/permission-templates')
  }
  async function createCorePermissionGroup(input: CorePermissionGroupCreate): Promise<CorePermissionGroup> {
    return await $fetch<CorePermissionGroup>('/api/v1/admin/permission-templates', { method: 'POST', body: input })
  }
  async function updateCorePermissionGroup(id: string, patch: CorePermissionGroupPatch): Promise<CorePermissionGroup> {
    return await $fetch<CorePermissionGroup>(`/api/v1/admin/permission-templates/${id}`, { method: 'PATCH', body: patch })
  }
  async function deleteCorePermissionGroup(id: string): Promise<void> {
    await $fetch(`/api/v1/admin/permission-templates/${id}`, { method: 'DELETE' })
  }
  async function reorderCorePermissionGroups(items: { id: string; sortOrder: number }[]): Promise<void> {
    await $fetch('/api/v1/admin/permission-templates/reorder', { method: 'POST', body: items })
  }

  // ── Cross-org admin dashboard ──
  async function orgsWithCounts(): Promise<OrgAdminRow[]> {
    return await $fetch<OrgAdminRow[]>('/api/v1/admin/organisations')
  }
  /** Create an org from the admin dashboard (full row). Returns its new id. */
  async function createOrg(input: OrgAdminCreate): Promise<string | null> {
    const r = await $fetch<{ id: string | null }>('/api/v1/admin/organisations', { method: 'POST', body: input })
    return r.id
  }
  async function setOrgLevel(id: string, orgLevel: string, type: string): Promise<void> {
    await $fetch(`/api/v1/admin/organisations/${id}/level`, { method: 'PATCH', body: { orgLevel, type } })
  }
  async function setOrgClubTypes(id: string, clubTypeIds: string[]): Promise<void> {
    await $fetch(`/api/v1/admin/organisations/${id}/club-types`, { method: 'PATCH', body: { clubTypeIds } })
  }
  async function setOrgBrand(id: string, brandId: string | null): Promise<void> {
    await $fetch(`/api/v1/admin/organisations/${id}/brand`, { method: 'PATCH', body: { brandId } })
  }
  /** Club-type ids (+ name) for a set of orgs — governing-chain inheritance. */
  async function orgClubTypeIds(ids: string[]): Promise<{ id: string; name: string; clubTypeIds: string[] }[]> {
    if (!ids.length) return []
    return await $fetch('/api/v1/admin/organisations/club-type-ids', { query: { ids: ids.join(',') } })
  }
  /** Seed a newly-created club from its club types' setup templates. */
  async function applyClubTypeDefaults(orgId: string, typeIds: string[]): Promise<void> {
    await $fetch('/api/v1/admin/apply-club-type-defaults', { method: 'POST', body: { orgId, typeIds } })
  }
  /** The Template Sandbox org's id (dashboard-template preview canvas), or null. */
  async function sandboxOrgId(): Promise<string | null> {
    const r = await $fetch<{ id: string | null }>('/api/v1/admin/sandbox-org')
    return r.id
  }

  // ── enabled_modules (Club setup) ──
  async function orgModules(orgId: string): Promise<string[] | null> {
    const r = await $fetch<{ enabledModules: string[] | null }>(`/api/v1/admin/organisations/${orgId}/modules`)
    return r.enabledModules
  }
  async function setOrgModules(orgId: string, keys: string[] | null): Promise<void> {
    await $fetch(`/api/v1/admin/organisations/${orgId}/modules`, { method: 'PATCH', body: { enabledModules: keys } })
  }

  // ── Org hierarchy (recursive walks) ──
  async function orgAncestors(orgId: string): Promise<OrgHierarchyNode[]> {
    return await $fetch<OrgHierarchyNode[]>('/api/v1/org-hierarchy/ancestors', { query: { orgId } })
  }
  async function orgDescendants(orgId: string): Promise<OrgHierarchyNode[]> {
    return await $fetch<OrgHierarchyNode[]>('/api/v1/org-hierarchy/descendants', { query: { orgId } })
  }
  async function orgGoverning(orgId: string): Promise<OrgHierarchyNode[]> {
    return await $fetch<OrgHierarchyNode[]>('/api/v1/org-hierarchy/governing', { query: { orgId } })
  }

  return {
    brands, clubTypes, sportCategories, helpArticles, dashboardTemplates, pageReviewers,
    createBrand, updateBrand, deleteBrand,
    getClubType, createClubType, updateClubType, deleteClubType, saveClubTypeDefaults, overallDefaultClubTypeId,
    corePermissionGroups, createCorePermissionGroup, updateCorePermissionGroup, deleteCorePermissionGroup, reorderCorePermissionGroups,
    orgsWithCounts, createOrg, setOrgLevel, setOrgClubTypes, setOrgBrand, orgClubTypeIds, applyClubTypeDefaults, sandboxOrgId,
    orgModules, setOrgModules,
    orgAncestors, orgDescendants, orgGoverning,
  }
}
