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
  const db = useDb()

  // Whole numeric age today from an ISO date-of-birth (null when unknown).
  function ageFromDob(dob: string | null): number | null {
    if (!dob) return null
    const d = new Date(dob)
    if (isNaN(d.getTime())) return null
    const now = new Date()
    let age = now.getFullYear() - d.getFullYear()
    const m = now.getMonth() - d.getMonth()
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
    return age >= 0 && age < 130 ? age : null
  }

  // Load every member_group_memberships row for the given group ids, keyed by
  // group id → AllocPerson[]. One query, then bucketed client-side.
  async function loadPeopleForGroups(groupIds: string[]): Promise<Record<string, AllocPerson[]>> {
    const out: Record<string, AllocPerson[]> = {}
    for (const id of groupIds) out[id] = []
    if (!groupIds.length) return out
    const { data } = await (db.from as any)('member_group_memberships')
      .select('group_id, role, roles, person:persons!inner(id, first_name, last_name, email, phone, dob, gender)')
      .in('group_id', groupIds)
    for (const r of data ?? []) {
      const p = r.person
      if (!p) continue
      const roles: string[] = Array.isArray(r.roles) ? r.roles : (r.role ? [r.role] : [])
      ;(out[r.group_id] ??= []).push({
        id: p.id,
        name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || '—',
        first_name: p.first_name ?? null,
        last_name: p.last_name ?? null,
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

  // Move a person from one group to another. Insert the destination membership
  // (skipping if one already exists — no duplicate rows) THEN delete the source
  // row. Carries the person's role/roles onto the new row + stamps the
  // destination group's term. Returns { ok, error? }.
  async function movePerson(
    person: AllocPerson,
    fromGroupId: string,
    toGroupId: string,
    destTermId: string | null,
  ): Promise<{ ok: boolean; error?: any }> {
    if (fromGroupId === toGroupId) return { ok: true }
    const { data: existing } = await (db.from as any)('member_group_memberships')
      .select('person_id')
      .eq('group_id', toGroupId)
      .eq('person_id', person.id)
      .maybeSingle()
    if (!existing) {
      const { error } = await (db.from as any)('member_group_memberships').insert({
        group_id: toGroupId,
        person_id: person.id,
        role: person.role ?? null,
        roles: person.roles.length ? person.roles : null,
        term_id: destTermId ?? null,
      })
      if (error) return { ok: false, error }
    }
    const { error: delErr } = await (db.from as any)('member_group_memberships')
      .delete()
      .eq('group_id', fromGroupId)
      .eq('person_id', person.id)
    if (delErr) return { ok: false, error: delErr }
    return { ok: true }
  }

  return { ageFromDob, loadPeopleForGroups, movePerson }
}
