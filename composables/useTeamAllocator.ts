// Team allocator — load the people in one group (the source) and the people in a
// set of destination groups, and MOVE a person between groups. A move persists
// immediately as insert-into-destination THEN delete-from-source, so a failure
// never loses the person from every group. Mirrors the legacy Group Allocation
// screen's `action=='transfer'` block (add to destination group + remove from
// source), adapted to member_group_memberships (which has NO org_id — scope via
// group_id). See pages/groups/allocator.vue.

export interface AllocPerson {
  id: string
  name: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  dob: string | null
  gender: string | null
  roles: string[]        // scoped roles carried onto the destination row
  role: string | null    // legacy anchor (roles[0])
}

export function useTeamAllocator() {
  const api = useGroupsApi()

  // Re-exported from useAge (THE age helper) so this composable's API is unchanged.

  // Load every member_group_memberships row for the given group ids, keyed by
  // group id → AllocPerson[]. One seam call, then bucketed client-side.
  async function loadPeopleForGroups(groupIds: string[]): Promise<Record<string, AllocPerson[]>> {
    const out: Record<string, AllocPerson[]> = {}
    for (const id of groupIds) out[id] = []
    if (!groupIds.length) return out
    const rows = await api.membershipsWithPersonForGroups(groupIds)
    for (const r of rows) {
      const p = r.person
      if (!p) continue
      const roles: string[] = Array.isArray(r.roles) ? r.roles : (r.role ? [r.role] : [])
      ;(out[r.groupId] ??= []).push({
        id: p.id,
        name: `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || '—',
        first_name: p.firstName ?? null,
        last_name: p.lastName ?? null,
        email: p.email ?? null,
        phone: p.phone ?? null,
        dob: p.dob ?? null,
        gender: p.gender ?? null,
        roles,
        role: r.role ?? roles[0] ?? null,
      })
    }
    for (const id of groupIds) out[id]?.sort((a, b) => a.name.localeCompare(b.name))
    return out
  }

  // Move a person from one group to another (seam: insert dest skip-if-exists, then
  // delete source). Carries role/roles + stamps the destination term. Returns { ok }.
  async function movePerson(
    person: AllocPerson,
    fromGroupId: string,
    toGroupId: string,
    destTermId: string | null,
  ): Promise<{ ok: boolean; error?: any }> {
    if (fromGroupId === toGroupId) return { ok: true }
    try {
      await api.moveMembership({
        fromGroupId,
        toGroupId,
        personId: person.id,
        role: person.role ?? null,
        roles: person.roles,
        termId: destTermId ?? null,
      })
      return { ok: true }
    } catch (error) {
      return { ok: false, error }
    }
  }

  return { ageFromDob, loadPeopleForGroups, movePerson }
}
