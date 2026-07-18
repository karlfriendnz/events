// The client side of the seam for organisations. Components call this — never
// useDb(), never Supabase, never $fetch to a raw table. It returns fully-typed
// domain objects (the shared contract), so a component has no idea whether the
// data came from MySQL today or the backend team's API tomorrow.
//
// This is the template every migrated screen follows: a use<Thing>Api() composable
// wrapping typed $fetch to /api/v1/*.
import type { Organisation, OrgTreeNode, OrganisationCreate, OrganisationPatch } from '../shared/contracts/organisation'
import type { OrgSettings } from '../shared/contracts/orgSettings'
import type { OrgDashboardMeta } from '../shared/contracts/orgDashboard'

export function useOrganisationsApi() {
  async function list(): Promise<Organisation[]> {
    return await $fetch<Organisation[]>('/api/v1/organisations')
  }
  async function create(input: OrganisationCreate): Promise<Organisation> {
    return await $fetch<Organisation>('/api/v1/organisations', { method: 'POST', body: input })
  }
  async function update(id: string, patch: OrganisationPatch): Promise<Organisation> {
    return await $fetch<Organisation>(`/api/v1/organisations/${id}`, { method: 'PATCH', body: patch })
  }
  async function remove(id: string): Promise<void> {
    await $fetch(`/api/v1/organisations/${id}`, { method: 'DELETE' })
  }
  /** The governing chain above an org (immediate parent first). */
  async function ancestors(id: string): Promise<OrgTreeNode[]> {
    return await $fetch<OrgTreeNode[]>(`/api/v1/organisations/${id}/ancestors`)
  }
  /** The subtree beneath an org — what a governing body "can talk to". */
  async function descendants(id: string): Promise<OrgTreeNode[]> {
    return await $fetch<OrgTreeNode[]>(`/api/v1/organisations/${id}/descendants`)
  }
  /** The org settings the People directory needs (level, member-pull mode, column
   *  selection) — a focused read, not the base organisation contract. */
  async function getSettings(orgId: string): Promise<OrgSettings> {
    return await $fetch<OrgSettings>(`/api/v1/organisations/${orgId}/settings`)
  }
  /** Save the People directory's per-tab visible-column selection. */
  async function setPeopleColumns(orgId: string, cols: OrgSettings['peopleColumns']): Promise<void> {
    await $fetch(`/api/v1/organisations/${orgId}/people-columns`, { method: 'PATCH', body: { peopleColumns: cols } })
  }
  /** The org columns the club dashboard + member profile need (name/logo, hero
   *  banner, club-default dashboard + profile-dashboard configs, level). */
  async function getDashboardMeta(orgId: string): Promise<OrgDashboardMeta> {
    return await $fetch<OrgDashboardMeta>(`/api/v1/organisations/${orgId}/dashboard-meta`)
  }
  /** Set (or clear with null) the dashboard hero banner image. */
  async function setDashboardBanner(orgId: string, url: string | null): Promise<void> {
    await $fetch(`/api/v1/organisations/${orgId}/dashboard-banner`, { method: 'PATCH', body: { dashboardBannerUrl: url } })
  }
  return { list, create, update, remove, ancestors, descendants, getSettings, setPeopleColumns, getDashboardMeta, setDashboardBanner }
}
