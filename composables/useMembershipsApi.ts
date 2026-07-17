// The client side of the seam for memberships & terms. Components call this — never
// useDb(), never Supabase, never $fetch to a raw table. It returns fully-typed domain
// objects (the shared contract), so a component has no idea whether the data came
// from MySQL today or the backend team's API tomorrow.
//
// This is the template every migrated screen follows: a use<Thing>Api() composable
// wrapping typed $fetch to /api/v1/*.
import type {
  MembershipEntitlement,
  MembershipPlanWithOptions,
  OrgTerm,
  TermSet,
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
  /** Every term/season an org defines. */
  async function terms(orgId: string): Promise<OrgTerm[]> {
    return await $fetch<OrgTerm[]>('/api/v1/terms', { query: { orgId } })
  }
  /** Every term set (sequence) an org has. */
  async function termSets(orgId: string): Promise<TermSet[]> {
    return await $fetch<TermSet[]>('/api/v1/term-sets', { query: { orgId } })
  }
  return { plans, entitlements, terms, termSets }
}
