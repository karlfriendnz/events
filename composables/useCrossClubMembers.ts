// Cross-club members (migration 250). A governing org (non-CLUB) can pull people
// from the clubs beneath it into its own groups. Two things live here:
//   • the PARENT's pull-mode setting (reference vs copy), and
//   • the queries that search club people + list the club-sourced people already
//     referenced by the governing org's groups (for the People page's own tab).
//
// Descendant clubs are resolved via useOrgManagers().descendantClubs (parent_id tree).

export type PullMode = 'reference' | 'copy'

export interface ClubPerson {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  gender: string | null
  club_id: string
  club_name: string
}

export function useCrossClubMembers() {
  const db = useDb()
  const { loadAllOrgs, descendantClubs } = useOrgManagers()

  async function loadPullMode(orgId: string): Promise<PullMode> {
    const { data } = await (db.from as any)('organisations').select('member_pull_mode').eq('id', orgId).maybeSingle()
    return data?.member_pull_mode === 'copy' ? 'copy' : 'reference'
  }
  async function savePullMode(orgId: string, mode: PullMode): Promise<void> {
    await (db.from as any)('organisations').update({ member_pull_mode: mode }).eq('id', orgId)
  }

  /** Descendant CLUB orgs of a governing org (id + name). */
  async function clubsBeneath(orgId: string): Promise<{ id: string; name: string }[]> {
    const all = await loadAllOrgs()
    return descendantClubs(orgId, all).map((o: any) => ({ id: o.id, name: o.name })).sort((a, b) => a.name.localeCompare(b.name))
  }

  /** Search people across the given clubs (for the governing group's "from clubs" picker). */
  async function searchClubPersons(clubs: { id: string; name: string }[], q: string): Promise<ClubPerson[]> {
    const ids = clubs.map(c => c.id)
    if (!ids.length) return []
    const nameById = new Map(clubs.map(c => [c.id, c.name]))
    let query = (db.from as any)('persons')
      .select('id, first_name, last_name, email, phone, gender, org_id')
      .in('org_id', ids).order('last_name').limit(25)
    const term = q.trim()
    if (term) query = query.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`)
    const { data } = await query
    return (data ?? []).map((p: any) => ({
      id: p.id, first_name: p.first_name, last_name: p.last_name, email: p.email, phone: p.phone, gender: p.gender,
      club_id: p.org_id, club_name: nameById.get(p.org_id) ?? '—',
    }))
  }

  /**
   * The club-owned people currently referenced by this governing org's groups —
   * i.e. people pulled up from clubs. Powers the People page "Club members" tab.
   */
  async function clubMembersForOrg(orgId: string): Promise<ClubPerson[]> {
    // Governing org's own groups → their memberships → person ids.
    const { data: groups } = await (db.from as any)('member_groups').select('id').eq('org_id', orgId)
    const groupIds = (groups ?? []).map((g: any) => g.id)
    if (!groupIds.length) return []
    const { data: mships } = await (db.from as any)('member_group_memberships').select('person_id').in('group_id', groupIds)
    const personIds = [...new Set((mships ?? []).map((m: any) => m.person_id))]
    if (!personIds.length) return []
    // Only those NOT owned by this org = pulled from a club.
    const { data: persons } = await (db.from as any)('persons')
      .select('id, first_name, last_name, email, phone, gender, org_id')
      .in('id', personIds).neq('org_id', orgId)
    const clubIds = [...new Set((persons ?? []).map((p: any) => p.org_id))]
    if (!clubIds.length) return []
    const { data: clubs } = await (db.from as any)('organisations').select('id, name').in('id', clubIds)
    const nameById = new Map((clubs ?? []).map((c: any) => [c.id, c.name]))
    return (persons ?? []).map((p: any) => ({
      id: p.id, first_name: p.first_name, last_name: p.last_name, email: p.email, phone: p.phone, gender: p.gender,
      club_id: p.org_id, club_name: nameById.get(p.org_id) ?? '—',
    })).sort((a, b) => (a.last_name || '').localeCompare(b.last_name || ''))
  }

  /**
   * Resolve the persons.id to attach to a governing group when adding a club person.
   * 'reference' → the club person's own id (no copy). 'copy' → create a governing-owned
   * mirror row and return its id.
   */
  async function resolvePulledPersonId(governingOrgId: string, clubPerson: ClubPerson, mode: PullMode): Promise<string | null> {
    if (mode === 'reference') return clubPerson.id
    // Copy: mirror core fields into a governing-owned persons row (idempotent by email when present).
    if (clubPerson.email) {
      const { data: existing } = await (db.from as any)('persons')
        .select('id').eq('org_id', governingOrgId).ilike('email', clubPerson.email).limit(1).maybeSingle()
      if (existing?.id) return existing.id
    }
    const { data: created } = await (db.from as any)('persons').insert({
      org_id: governingOrgId,
      first_name: clubPerson.first_name, last_name: clubPerson.last_name,
      email: clubPerson.email, phone: clubPerson.phone, gender: clubPerson.gender,
    }).select('id').single()
    return created?.id ?? null
  }

  return { loadPullMode, savePullMode, clubsBeneath, searchClubPersons, clubMembersForOrg, resolvePulledPersonId }
}
