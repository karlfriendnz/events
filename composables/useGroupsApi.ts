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
  GroupView,
  GroupViewCreate,
  GroupViewPatch,
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
  ): Promise<
    { personId: string; groupId: string; locationId: string | null; role: string | null; roles: string[] }[]
  > {
    return await $fetch(`/api/v1/groups/memberships`, { query: { orgId } })
  }
  /** One person's memberships across an org (with each group's primary location). */
  async function membershipsForPerson(
    orgId: string,
    personId: string,
  ): Promise<
    { groupId: string; personId: string; role: string | null; roles: string[]; locationId: string | null }[]
  > {
    return await $fetch(`/api/v1/groups/memberships`, { query: { orgId, personId } })
  }
  /** Groups whose code is one of the given codes (public-reg code expansion). */
  async function groupsByCodeIds(codeIds: string[]): Promise<MemberGroup[]> {
    if (codeIds.length === 0) return []
    return await $fetch<MemberGroup[]>('/api/v1/groups', { query: { codeIds: codeIds.join(',') } })
  }
  /** Add/update one person's membership on a group. */
  async function upsertMembership(input: {
    groupId: string
    personId: string
    role?: string | null
    roles?: string[]
    positions?: string[]
    subGroupId?: string | null
    termId?: string | null
    planOptionId?: string | null
    feeOptionId?: string | null
    startDate?: string | null
    endDate?: string | null
    autoRenew?: boolean | null
    membershipStatus?: string | null
  }): Promise<MemberGroupMembership> {
    return await $fetch<MemberGroupMembership>('/api/v1/groups/memberships', {
      method: 'POST',
      body: input,
    })
  }
  /** Remove one person from a group. */
  async function removeMembership(groupId: string, personId: string): Promise<void> {
    await $fetch('/api/v1/groups/memberships', { method: 'DELETE', body: { groupId, personId } })
  }
  /** The weekly training schedules of one group. */
  async function schedules(groupId: string): Promise<MemberGroupSchedule[]> {
    return await $fetch<MemberGroupSchedule[]>(`/api/v1/groups/${groupId}/schedules`)
  }
  /** The weekly training schedules across many groups (Week View / class finder). */
  async function schedulesForGroups(groupIds: string[]): Promise<MemberGroupSchedule[]> {
    if (groupIds.length === 0) return []
    return await $fetch<MemberGroupSchedule[]>('/api/v1/groups/schedules', {
      query: { groupIds: groupIds.join(',') },
    })
  }
  /** Every code an org defines. */
  async function codes(orgId: string): Promise<GroupCode[]> {
    return await $fetch<GroupCode[]>('/api/v1/group-codes', { query: { orgId } })
  }
  /** The fee options of one group, each with its line items. */
  async function feeOptions(groupId: string): Promise<GroupFeeOption[]> {
    return await $fetch<GroupFeeOption[]>(`/api/v1/groups/${groupId}/fee-options`)
  }
  /** Every group's fee options across an org (Fees overview / Classes board). */
  async function feeOptionsByOrg(orgId: string): Promise<GroupFeeOption[]> {
    return await $fetch<GroupFeeOption[]>('/api/v1/group-fees', { query: { orgId } })
  }
  /** Replace a group's fee options (delete-then-insert, incl. line items). */
  async function saveFeeOptions(
    groupId: string,
    orgId: string,
    options: any[],
  ): Promise<GroupFeeOption[]> {
    return await $fetch<GroupFeeOption[]>(`/api/v1/groups/${groupId}/fee-options`, {
      method: 'POST',
      body: { orgId, options },
    })
  }
  /** Append ONE fee option to many groups (bulk; never wipes existing). */
  async function addFeeOptionToGroups(orgId: string, groupIds: string[], option: any): Promise<void> {
    await $fetch('/api/v1/group-fees/bulk', { method: 'POST', body: { orgId, groupIds, option } })
  }
  /** Memberships of a set of groups, each with the person's display fields (allocator). */
  async function membershipsWithPersonForGroups(groupIds: string[]): Promise<
    {
      groupId: string
      personId: string
      role: string | null
      roles: string[]
      person: {
        id: string
        firstName: string | null
        lastName: string | null
        email: string | null
        phone: string | null
        dob: string | null
        gender: string | null
      } | null
    }[]
  > {
    if (groupIds.length === 0) return []
    return await $fetch('/api/v1/groups/memberships-with-person', {
      query: { groupIds: groupIds.join(',') },
    })
  }
  /** Memberships of a set of groups with membership start_date + person name/email/
   *  phone/created_at, for the retention report. */
  async function membershipsForRetention(groupIds: string[]): Promise<
    {
      groupId: string
      personId: string
      role: string | null
      roles: string[]
      startDate: string | null
      person: {
        firstName: string | null
        lastName: string | null
        email: string | null
        phone: string | null
        createdAt: string | null
      } | null
    }[]
  > {
    if (groupIds.length === 0) return []
    return await $fetch('/api/v1/groups/memberships-for-retention', {
      query: { groupIds: groupIds.join(',') },
    })
  }
  /** Move a person from one group to another (insert dest skip-if-exists, delete source). */
  async function moveMembership(input: {
    fromGroupId: string
    toGroupId: string
    personId: string
    role?: string | null
    roles?: string[]
    termId?: string | null
  }): Promise<void> {
    await $fetch('/api/v1/groups/move-membership', { method: 'POST', body: input })
  }
  /** Roster of many groups (role/roles + subGroupId + person name) — term rollover. */
  async function roster(groupIds: string[]): Promise<
    {
      groupId: string
      personId: string
      role: string | null
      roles: string[]
      subGroupId: string | null
      firstName: string | null
      lastName: string | null
    }[]
  > {
    if (groupIds.length === 0) return []
    return await $fetch('/api/v1/groups/roster', { query: { groupIds: groupIds.join(',') } })
  }
  /** Clone a term's chosen groups into a target term (the whole rollover). */
  async function rollover(input: {
    orgId: string
    targetTerm: { id: string; name: string | null; startDate: string | null; endDate: string | null }
    plans: any[]
  }): Promise<{ created: number }> {
    return await $fetch('/api/v1/groups/rollover', { method: 'POST', body: input })
  }
  /** Replace a group's weekly training schedules (delete-then-insert). */
  async function saveSchedules(
    groupId: string,
    orgId: string,
    rows: any[],
  ): Promise<MemberGroupSchedule[]> {
    return await $fetch<MemberGroupSchedule[]>(`/api/v1/groups/${groupId}/schedules`, {
      method: 'POST',
      body: { orgId, rows },
    })
  }
  /** ID-PRESERVING schedule save: updates existing rows in place by id (so training
   *  events linked via member_group_schedule_id stay attached), inserts rows with no
   *  id, deletes the rest. Each row: { id?: string|null, name, dayOfWeek, startTime,
   *  endTime, location, sortOrder }. */
  async function syncSchedules(
    groupId: string,
    orgId: string,
    rows: any[],
  ): Promise<MemberGroupSchedule[]> {
    return await $fetch<MemberGroupSchedule[]>(`/api/v1/groups/${groupId}/schedules-sync`, {
      method: 'POST',
      body: { orgId, rows },
    })
  }
  /** The roster of a set of groups with the full person projection the discipline-flag
   *  evaluator needs (custom_fields + person_types + dob/gender). */
  async function rosterWithPerson(groupIds: string[]): Promise<
    {
      roles: string[]
      role: string | null
      positions: string[]
      subGroupId: string | null
      person: {
        id: string
        firstName: string | null
        lastName: string | null
        email: string | null
        phone: string | null
        dob: string | null
        gender: string | null
        customFields: any
        personTypes: string[]
        personType: string | null
      } | null
    }[]
  > {
    if (groupIds.length === 0) return []
    return await $fetch('/api/v1/groups/roster-with-person', { query: { groupIds: groupIds.join(',') } })
  }
  /** Save a group's per-term fee link + membership-plan connections (member_group_terms
   *  + member_group_plans, delete-then-insert). The group's own term_id/term_fee are
   *  written separately via update(). */
  async function saveBilling(
    groupId: string,
    input: { termId: string | null; fee: string | number | null; planIds: string[] },
  ): Promise<void> {
    await $fetch(`/api/v1/groups/${groupId}/billing`, { method: 'POST', body: input })
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
  /** Every saved Classes-style view an org has. */
  async function views(orgId: string): Promise<GroupView[]> {
    return await $fetch<GroupView[]>('/api/v1/group-views', { query: { orgId } })
  }
  /** One saved view by id. */
  async function view(id: string): Promise<GroupView> {
    return await $fetch<GroupView>('/api/v1/group-views', { query: { id } })
  }
  async function createView(input: GroupViewCreate): Promise<GroupView> {
    return await $fetch<GroupView>('/api/v1/group-views', { method: 'POST', body: input })
  }
  async function updateView(id: string, patch: GroupViewPatch): Promise<GroupView> {
    return await $fetch<GroupView>(`/api/v1/group-views/${id}`, { method: 'PATCH', body: patch })
  }
  async function removeView(id: string): Promise<void> {
    await $fetch(`/api/v1/group-views/${id}`, { method: 'DELETE' })
  }
  return {
    list, get, memberships, membershipsByOrg, membershipsForPerson, groupsByCodeIds,
    upsertMembership, removeMembership, membershipsWithPersonForGroups,
    membershipsForRetention, moveMembership, roster, rollover,
    schedules, schedulesForGroups, codes, feeOptions, feeOptionsByOrg,
    saveFeeOptions, addFeeOptionToGroups, saveSchedules, syncSchedules,
    rosterWithPerson, saveBilling,
    create, update, remove, createCode, updateCode, removeCode,
    views, view, createView, updateView, removeView,
  }
}
