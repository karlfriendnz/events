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
  return { brands, clubTypes, sportCategories, helpArticles, dashboardTemplates, pageReviewers }
}
