// The client side of the seam for memberships & terms. Components call this — never
// useDb(), never Supabase, never $fetch to a raw table. It returns fully-typed domain
// objects (the shared contract), so a component has no idea whether the data came
// from MySQL today or the backend team's API tomorrow.
//
// This is the template every migrated screen follows: a use<Thing>Api() composable
// wrapping typed $fetch to /api/v1/*.
import type {
  MembershipEntitlement,
  MembershipEntitlementInput,
  MembershipPlan,
  MembershipPlanOption,
  MembershipPlanOptionCreate,
  MembershipPlanOptionPatch,
  MembershipPlanWithOptions,
  MembershipPlanCreate,
  MembershipPlanPatch,
  OrgTerm,
  OrgTermCreate,
  OrgTermPatch,
  TermSet,
  TermSetCreate,
  TermSetPatch,
  GroupBilling,
} from '../shared/contracts/membership'

export function useMembershipsApi() {
  /** Every membership plan an org has, each hydrated with its duration options. */
  async function plans(orgId: string): Promise<MembershipPlanWithOptions[]> {
    return await $fetch<MembershipPlanWithOptions[]>('/api/v1/memberships/plans', {
      query: { orgId },
    })
  }
  /** What one membership group includes — its entitlement rows. */
  async function entitlements(membershipGroupId: string): Promise<MembershipEntitlement[]> {
    return await $fetch<MembershipEntitlement[]>('/api/v1/memberships/entitlements', {
      query: { membershipGroupId },
    })
  }
  /** Every entitlement in an org (coverage resolution across all memberships). */
  async function entitlementsByOrg(orgId: string): Promise<MembershipEntitlement[]> {
    return await $fetch<MembershipEntitlement[]>('/api/v1/memberships/entitlements', {
      query: { orgId },
    })
  }
  /** Replace what one membership includes (delete-then-insert). */
  async function saveEntitlements(
    orgId: string,
    membershipGroupId: string,
    rows: MembershipEntitlementInput[],
  ): Promise<MembershipEntitlement[]> {
    return await $fetch<MembershipEntitlement[]>('/api/v1/memberships/entitlements', {
      method: 'POST',
      body: { orgId, membershipGroupId, rows },
    })
  }
  /** One group's billing links (terms + fees + plans). */
  async function groupBilling(groupId: string): Promise<GroupBilling> {
    return await $fetch<GroupBilling>('/api/v1/memberships/group-billing', { query: { groupId } })
  }
  /** Replace a group's billing links (delete-then-insert). */
  async function saveGroupBilling(
    groupId: string,
    termFees: { termId: string; fee: string | number | null }[],
    planIds: string[],
  ): Promise<GroupBilling> {
    return await $fetch<GroupBilling>('/api/v1/memberships/group-billing', {
      method: 'POST',
      body: { groupId, termFees, planIds },
    })
  }
  /** Create a term set (sequence). */
  async function createTermSet(input: TermSetCreate): Promise<TermSet> {
    return await $fetch<TermSet>('/api/v1/term-sets', { method: 'POST', body: input })
  }
  /** Update a term set (name / sport / locations). */
  async function updateTermSet(id: string, patch: TermSetPatch): Promise<TermSet> {
    return await $fetch<TermSet>(`/api/v1/term-sets/${id}`, { method: 'PATCH', body: patch })
  }
  /** Delete a term set (its terms fall back to the default sequence). */
  async function removeTermSet(id: string): Promise<void> {
    await $fetch(`/api/v1/term-sets/${id}`, { method: 'DELETE' })
  }
  /** Every term/season an org defines. */
  async function terms(orgId: string): Promise<OrgTerm[]> {
    return await $fetch<OrgTerm[]>('/api/v1/terms', { query: { orgId } })
  }
  /** Every term set (sequence) an org has. */
  async function termSets(orgId: string): Promise<TermSet[]> {
    return await $fetch<TermSet[]>('/api/v1/term-sets', { query: { orgId } })
  }
  /** Create a term/season. */
  async function createTerm(input: OrgTermCreate): Promise<OrgTerm> {
    return await $fetch<OrgTerm>('/api/v1/terms', { method: 'POST', body: input })
  }
  /** Update a term/season. */
  async function updateTerm(id: string, patch: OrgTermPatch): Promise<OrgTerm> {
    return await $fetch<OrgTerm>(`/api/v1/terms/${id}`, { method: 'PATCH', body: patch })
  }
  /** Delete a term/season. */
  async function removeTerm(id: string): Promise<void> {
    await $fetch(`/api/v1/terms/${id}`, { method: 'DELETE' })
  }
  /** Create a membership plan. */
  async function createPlan(input: MembershipPlanCreate): Promise<MembershipPlan> {
    return await $fetch<MembershipPlan>('/api/v1/memberships/plans', { method: 'POST', body: input })
  }
  /** Update a membership plan. */
  async function updatePlan(id: string, patch: MembershipPlanPatch): Promise<MembershipPlan> {
    return await $fetch<MembershipPlan>(`/api/v1/memberships/plans/${id}`, { method: 'PATCH', body: patch })
  }
  /** Delete a membership plan. */
  async function removePlan(id: string): Promise<void> {
    await $fetch(`/api/v1/memberships/plans/${id}`, { method: 'DELETE' })
  }
  /** Create a plan's duration option. */
  async function createPlanOption(input: MembershipPlanOptionCreate): Promise<MembershipPlanOption> {
    return await $fetch<MembershipPlanOption>('/api/v1/membership-plan-options', { method: 'POST', body: input })
  }
  /** Update a plan's duration option. */
  async function updatePlanOption(id: string, patch: MembershipPlanOptionPatch): Promise<MembershipPlanOption> {
    return await $fetch<MembershipPlanOption>(`/api/v1/membership-plan-options/${id}`, { method: 'PATCH', body: patch })
  }
  /** Bulk-delete a plan's duration options by id (scoped by planId). */
  async function removePlanOptions(planId: string, ids: string[]): Promise<void> {
    await $fetch('/api/v1/membership-plan-options/delete', { method: 'POST', body: { planId, ids } })
  }
  return {
    plans, entitlements, entitlementsByOrg, saveEntitlements, groupBilling, saveGroupBilling,
    terms, termSets, createTermSet, updateTermSet, removeTermSet,
    createTerm, updateTerm, removeTerm, createPlan, updatePlan, removePlan,
    createPlanOption, updatePlanOption, removePlanOptions,
  }
}
