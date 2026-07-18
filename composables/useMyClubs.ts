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
  // On the seam: the cross-club identity read (persons-across-all-orgs by email, joined
  // to organisations for name/level) is people.findAllByEmail. Guarded: a failed read
  // just yields no clubs (login routing falls back).
  const { findAllByEmail } = usePeopleApi()
  const user = useSupabaseUser()
  const clubs = useState<MyClub[]>('fm-my-clubs', () => [])
  const loaded = useState<boolean>('fm-my-clubs-loaded', () => false)

  async function loadMyClubs(force = false): Promise<MyClub[]> {
    if (loaded.value && !force) return clubs.value
    const email = user.value?.email
    if (!email) { clubs.value = []; loaded.value = true; return [] }
    // All persons rows across every org matching this login's email.
    const data = await findAllByEmail(email).catch(() => [])
    const list: MyClub[] = data.map((p) => ({
      orgId: p.orgId,
      orgName: p.orgName || 'Club',
      orgLevel: p.orgLevel ?? null,
      personId: p.id,
      typeKeys: p.personTypes.length ? p.personTypes : (p.personType ? [p.personType] : []),
      primaryType: (p.personTypes.length ? p.personTypes[0] : p.personType) ?? null,
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
