// The client side of the seam for organisations. Components call this — never
// useDb(), never Supabase, never $fetch to a raw table. It returns fully-typed
// domain objects (the shared contract), so a component has no idea whether the
// data came from MySQL today or the backend team's API tomorrow.
//
// This is the template every migrated screen follows: a use<Thing>Api() composable
// wrapping typed $fetch to /api/v1/*.
import type { Organisation, OrgTreeNode, OrganisationCreate, OrganisationPatch, OrgBrandTheme, OnboardingState, UserOrgMembership } from '../shared/contracts/organisation'
import type { OrgSettings } from '../shared/contracts/orgSettings'
import type { OrgDashboardMeta } from '../shared/contracts/orgDashboard'
import type { OrgProfile, OrgProfilePatch } from '../shared/contracts/orgProfile'

export function useOrganisationsApi() {
  async function list(): Promise<Organisation[]> {
    return await $fetch<Organisation[]>('/api/v1/organisations')
  }
  /** A single organisation (identity/tree slice). */
  async function get(id: string): Promise<Organisation> {
    return await $fetch<Organisation>(`/api/v1/organisations/${id}`)
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
  /** Save (or clear with null) the club-default member-profile dashboard layout. */
  async function setProfileDashboard(orgId: string, config: any[] | null): Promise<void> {
    await $fetch(`/api/v1/organisations/${orgId}/profile-dashboard`, { method: 'PATCH', body: { profileDashboard: config } })
  }
  /** The Settings → General tab's view of the org (identity, branding, season,
   *  contact, club-level payment/booker defaults) — a focused slice, not the base
   *  organisation contract. */
  async function getProfile(orgId: string): Promise<OrgProfile> {
    return await $fetch<OrgProfile>(`/api/v1/organisations/${orgId}/profile`)
  }
  /** Save any subset of the General-tab columns; returns the updated profile.
   *  parentId is NOT writable here (privileged re-parenting, CRIT-3). */
  async function updateProfile(orgId: string, patch: OrgProfilePatch): Promise<OrgProfile> {
    return await $fetch<OrgProfile>(`/api/v1/organisations/${orgId}/profile`, { method: 'PATCH', body: patch })
  }
  /** Privileged re-parent — move an org under a different governing body (its own
   *  endpoint, not the general patch; security audit CRIT-3). */
  async function setParent(orgId: string, parentId: string | null): Promise<void> {
    await $fetch(`/api/v1/organisations/${orgId}/parent`, { method: 'POST', body: { parentId } })
  }
  /** Set the cross-club member-pull policy. */
  async function setMemberPullMode(orgId: string, mode: 'reference' | 'copy' | null): Promise<void> {
    await $fetch(`/api/v1/organisations/${orgId}/member-pull-mode`, { method: 'PATCH', body: { memberPullMode: mode } })
  }
  /** The resolved brand theme (connected brand colour + level) for the theme composable. */
  async function getBrandTheme(orgId: string): Promise<OrgBrandTheme> {
    return await $fetch<OrgBrandTheme>(`/api/v1/organisations/${orgId}/brand-theme`)
  }
  /** The org-wide default member positions (Captain/Wing/…). */
  async function getDefaultPositions(orgId: string): Promise<string[]> {
    return await $fetch<string[]>(`/api/v1/organisations/${orgId}/default-positions`)
  }
  /** Replace the org-wide default member positions. */
  async function setDefaultPositions(orgId: string, positions: string[]): Promise<void> {
    await $fetch(`/api/v1/organisations/${orgId}/default-positions`, { method: 'PATCH', body: { positions } })
  }
  /** The clubs a login belongs to (org_members by auth user id) — the ProfileMenu
   *  club switcher. */
  async function orgsForUser(userId: string): Promise<UserOrgMembership[]> {
    if (!userId) return []
    return await $fetch<UserOrgMembership[]>('/api/v1/organisations/for-user', { query: { userId } })
  }
  /** The new-club onboarding checklist state. */
  async function getOnboarding(orgId: string): Promise<OnboardingState> {
    return await $fetch<OnboardingState>(`/api/v1/organisations/${orgId}/onboarding`)
  }
  /** Save the onboarding checklist state. */
  async function setOnboarding(orgId: string, state: OnboardingState): Promise<void> {
    await $fetch(`/api/v1/organisations/${orgId}/onboarding`, { method: 'PATCH', body: state })
  }
  /** DETECT which onboarding steps are complete from real data ({ stepKey: bool }). */
  async function onboardingCounts(orgId: string): Promise<Record<string, boolean>> {
    return await $fetch<Record<string, boolean>>(`/api/v1/organisations/${orgId}/onboarding-counts`)
  }
  return { list, get, create, update, remove, ancestors, descendants, getSettings, setPeopleColumns, getDashboardMeta, setDashboardBanner, setProfileDashboard, getProfile, updateProfile, setParent, setMemberPullMode, getBrandTheme, getDefaultPositions, setDefaultPositions, orgsForUser, getOnboarding, setOnboarding, onboardingCounts }
}
