// The client side of the seam for groups. Components call this — never useDb(),
// never Supabase, never $fetch to a raw table. It returns fully-typed domain objects
// (the shared contract), so a component has no idea whether the data came from MySQL
// today or the backend team's API tomorrow.
//
// This is the template every migrated screen follows: a use<Thing>Api() composable
// wrapping typed $fetch to /api/v1/*.
import type {
  MemberGroup,
  GroupCode,
  MemberGroupMembership,
  MemberGroupSchedule,
  GroupFeeOption,
} from '../shared/contracts/group'

export function useGroupsApi() {
  /** Every group an org has. */
  async function list(orgId: string): Promise<MemberGroup[]> {
    return await $fetch<MemberGroup[]>('/api/v1/groups', { query: { orgId } })
  }
  /** One group by id. */
  async function get(id: string): Promise<MemberGroup> {
    return await $fetch<MemberGroup>(`/api/v1/groups/${id}`)
  }
  /** The roster of one group. */
  async function memberships(groupId: string): Promise<MemberGroupMembership[]> {
    return await $fetch<MemberGroupMembership[]>(`/api/v1/groups/${groupId}/memberships`)
  }
  /** The weekly training schedules of one group. */
  async function schedules(groupId: string): Promise<MemberGroupSchedule[]> {
    return await $fetch<MemberGroupSchedule[]>(`/api/v1/groups/${groupId}/schedules`)
  }
  /** Every code an org defines. */
  async function codes(orgId: string): Promise<GroupCode[]> {
    return await $fetch<GroupCode[]>('/api/v1/group-codes', { query: { orgId } })
  }
  /** The fee options of one group, each with its line items. */
  async function feeOptions(groupId: string): Promise<GroupFeeOption[]> {
    return await $fetch<GroupFeeOption[]>(`/api/v1/groups/${groupId}/fee-options`)
  }
  return { list, get, memberships, schedules, codes, feeOptions }
}
