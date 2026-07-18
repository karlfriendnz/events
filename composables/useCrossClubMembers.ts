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
  const { loadAllOrgs, descendantClubs } = useOrgManagers()
  const peopleApi = usePeopleApi()
  const groupsApi = useGroupsApi()
  const orgsApi = useOrganisationsApi()

  async function loadPullMode(orgId: string): Promise<PullMode> {
    const s = await orgsApi.getSettings(orgId)
    return s?.memberPullMode === 'copy' ? 'copy' : 'reference'
  }
  async function savePullMode(orgId: string, mode: PullMode): Promise<void> {
    await orgsApi.setMemberPullMode(orgId, mode)
  }

  /** Descendant CLUB orgs of a governing org (id + name). */
  async function clubsBeneath(orgId: string): Promise<{ id: string; name: string }[]> {
    const all = await loadAllOrgs()
    return descendantClubs(orgId, all).map((o: any) => ({ id: o.id, name: o.name })).sort((a, b) => a.name.localeCompare(b.name))
  }

  /** Search people across the given clubs (for the governing group's "from clubs" picker).
   *  One org-scoped people query per club (the seam lists by org), merged + capped at 25
   *  to preserve the old single-query feel. */
  async function searchClubPersons(clubs: { id: string; name: string }[], q: string): Promise<ClubPerson[]> {
    if (!clubs.length) return []
    const term = q.trim()
    const nameById = new Map(clubs.map(c => [c.id, c.name]))
    const perClub = await Promise.all(clubs.map(c => peopleApi.list(c.id, { q: term || undefined, limit: 25 })))
    const out: ClubPerson[] = []
    clubs.forEach((c, i) => {
      for (const p of perClub[i]) out.push({
        id: p.id, first_name: p.firstName, last_name: p.lastName, email: p.email, phone: p.phone, gender: p.gender,
        club_id: c.id, club_name: nameById.get(c.id) ?? '—',
      })
    })
    return out.sort((a, b) => (a.last_name || '').localeCompare(b.last_name || '')).slice(0, 25)
  }

  /**
   * The club-owned people currently referenced by this governing org's groups —
   * i.e. people pulled up from clubs. Powers the People page "Club members" tab.
   */
  async function clubMembersForOrg(orgId: string): Promise<ClubPerson[]> {
    // Governing org's own groups' memberships → person ids (the seam joins member_groups
    // for the org scope; member_group_memberships has no org_id of its own).
    const mships = await groupsApi.membershipsByOrg(orgId)
    const personIds = [...new Set(mships.map(m => m.personId))]
    if (!personIds.length) return []
    // Resolve each person; only those NOT owned by this org = pulled from a club.
    const people = await Promise.all(personIds.map(id => peopleApi.get(id).catch(() => null)))
    const clubSourced = people.filter((p): p is NonNullable<typeof p> => !!p && p.orgId !== orgId)
    if (!clubSourced.length) return []
    const allOrgs = await orgsApi.list()
    const nameById = new Map(allOrgs.map(o => [o.id, o.name]))
    return clubSourced.map(p => ({
      id: p.id, first_name: p.firstName, last_name: p.lastName, email: p.email, phone: p.phone, gender: p.gender,
      club_id: p.orgId, club_name: nameById.get(p.orgId) ?? '—',
    })).sort((a, b) => (a.last_name || '').localeCompare(b.last_name || ''))
  }

  /**
   * Resolve the persons.id to attach to a governing group when adding a club person.
   * 'reference' → the club person's own id (no copy). 'copy' → create a governing-owned
   * mirror row and return its id (idempotent by email when present).
   */
  async function resolvePulledPersonId(governingOrgId: string, clubPerson: ClubPerson, mode: PullMode): Promise<string | null> {
    if (mode === 'reference') return clubPerson.id
    if (clubPerson.email) {
      const existing = await peopleApi.findByEmail(governingOrgId, clubPerson.email)
      if (existing?.id) return existing.id
    }
    const created = await peopleApi.create({
      orgId: governingOrgId,
      firstName: clubPerson.first_name || 'Member',
      lastName: clubPerson.last_name ?? undefined,
      email: clubPerson.email ?? undefined,
      phone: clubPerson.phone ?? undefined,
      gender: clubPerson.gender ?? undefined,
    })
    return created?.id ?? null
  }

  return { loadPullMode, savePullMode, clubsBeneath, searchClubPersons, clubMembersForOrg, resolvePulledPersonId }
}
