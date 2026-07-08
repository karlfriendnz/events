// CROSS-CLUB IDENTITY. One login (Supabase auth user, keyed by email) can belong
// to several clubs — there's a `persons` row per club with the same email. This
// resolves the logged-in user's email to every club they have a record in, so we
// can land them in the right one (auto if one, a chooser if several) and offer a
// header switcher. Each entry knows their person + type in that club.
export interface MyClub {
  orgId: string
  orgName: string
  orgLevel: string | null
  personId: string
  typeKeys: string[]
  primaryType: string | null
}

export function useMyClubs() {
  const db = useDb()
  const user = useSupabaseUser()
  const clubs = useState<MyClub[]>('fm-my-clubs', () => [])
  const loaded = useState<boolean>('fm-my-clubs-loaded', () => false)

  async function loadMyClubs(force = false): Promise<MyClub[]> {
    if (loaded.value && !force) return clubs.value
    const email = user.value?.email
    if (!email) { clubs.value = []; loaded.value = true; return [] }
    // All persons rows across every org matching this login's email.
    const { data } = await (db.from as any)('persons')
      .select('id, org_id, person_type, person_types, organisations(name, org_level)')
      .ilike('email', email)
    const list: MyClub[] = (data ?? []).map((p: any) => ({
      orgId: p.org_id,
      orgName: p.organisations?.name ?? 'Club',
      orgLevel: p.organisations?.org_level ?? null,
      personId: p.id,
      typeKeys: p.person_types?.length ? p.person_types : (p.person_type ? [p.person_type] : []),
      primaryType: (p.person_types?.length ? p.person_types[0] : p.person_type) ?? null,
    }))
    // De-dupe by org (one card per club) + alpha.
    const byOrg = new Map<string, MyClub>()
    for (const c of list) if (!byOrg.has(c.orgId)) byOrg.set(c.orgId, c)
    clubs.value = [...byOrg.values()].sort((a, b) => a.orgName.localeCompare(b.orgName))
    loaded.value = true
    return clubs.value
  }

  return { clubs, loaded, loadMyClubs }
}
