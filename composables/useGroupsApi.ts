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
  MemberGroupCreate,
  MemberGroupPatch,
  GroupCodeCreate,
  GroupCodePatch,
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
  /** Every membership in an org as (person, group, location) refs — for the People
   *  directory's location lens (not a full roster). */
  async function membershipsByOrg(
    orgId: string,
  ): Promise<{ personId: string; groupId: string; locationId: string | null }[]> {
    return await $fetch(`/api/v1/groups/memberships`, { query: { orgId } })
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
  /** Create a group. */
  async function create(input: MemberGroupCreate): Promise<MemberGroup> {
    return await $fetch<MemberGroup>('/api/v1/groups', { method: 'POST', body: input })
  }
  /** Update a group. */
  async function update(id: string, patch: MemberGroupPatch): Promise<MemberGroup> {
    return await $fetch<MemberGroup>(`/api/v1/groups/${id}`, { method: 'PATCH', body: patch })
  }
  /** Delete a group. */
  async function remove(id: string): Promise<void> {
    await $fetch(`/api/v1/groups/${id}`, { method: 'DELETE' })
  }
  /** Create a code. */
  async function createCode(input: GroupCodeCreate): Promise<GroupCode> {
    return await $fetch<GroupCode>('/api/v1/group-codes', { method: 'POST', body: input })
  }
  /** Update a code. */
  async function updateCode(id: string, patch: GroupCodePatch): Promise<GroupCode> {
    return await $fetch<GroupCode>(`/api/v1/group-codes/${id}`, { method: 'PATCH', body: patch })
  }
  /** Delete a code. */
  async function removeCode(id: string): Promise<void> {
    await $fetch(`/api/v1/group-codes/${id}`, { method: 'DELETE' })
  }
  return {
    list, get, memberships, membershipsByOrg, schedules, codes, feeOptions,
    create, update, remove, createCode, updateCode, removeCode,
  }
}
