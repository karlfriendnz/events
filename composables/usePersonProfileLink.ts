/**
 * Where a person's NAME links to.
 *
 * Standalone, the module's own /people/[id] is the profile, and a NuxtLink to it
 * is right. INSIDE THE OLD PLATFORM'S IFRAME it is not: the profile that person
 * actually has is that platform's own /people/{id}#profile, and this module is
 * one tab of it. A NuxtLink there would open a second copy of the module inside
 * the events tab — a profile nested in the profile it came from.
 *
 * So embedded, we hand back an href and the caller renders a plain <a> with
 * target="_top". _top is the whole point: the link has to navigate the HOST page,
 * not the frame it was clicked in.
 *
 * The old platform's id arrives two ways, because a people picker in a bridged
 * club offers both rosters:
 *   - read straight off the old roster  → id is already `legacy-<id>`
 *   - one of ours, since bridged        → `legacyPersonId` carries the resolved id
 * Neither present means they have no profile over there yet (nobody has had to
 * resolve them), so we fall back to ours rather than linking somewhere 404.
 */

export interface ProfileLinkTarget {
  /** External — the caller MUST render this with target="_top". */
  href?: string
  /** Internal — a NuxtLink route in this module. */
  to?: string
}

/** Accepts either casing, because the two tabs map the payload differently. */
interface PersonLike {
  id?: string | null
  legacyPersonId?: number | null
  legacy_person_id?: number | null
}

export function usePersonProfileLink() {
  const embedded = useState<boolean>('fmEmbedSession', () => false)
  const platformUrl = useState<string>('fmEmbedPlatformUrl', () => '')

  function legacyIdOf(person?: PersonLike | null, personId?: string | null): number | null {
    const bridged = person?.legacyPersonId ?? person?.legacy_person_id
    if (bridged) return Number(bridged)
    const match = /^legacy-(\d+)$/i.exec(String(person?.id ?? personId ?? ''))
    return match ? Number(match[1]) : null
  }

  /**
   * `personId` is a fallback for callers that hold the id but not the person row
   * (the attendance table keys off `inv.person_id`, whose person can be null for
   * a guest).
   */
  function profileLink(person?: PersonLike | null, personId?: string | null): ProfileLinkTarget {
    const id = person?.id ?? personId
    // EMBEDDED → the old platform's profile, every time. Its numeric id is the one on
    // the person if we know it, otherwise whatever id we were handed (a `legacy-<n>`
    // is just that number with a prefix).
    if (embedded.value && platformUrl.value) {
      const legacyId = legacyIdOf(person, personId)
      const target = legacyId ?? String(id ?? '').replace(/^legacy-/i, '')
      return target ? { href: legacyProfileUrl(target) } : {}
    }
    // NOT embedded → this module's own profile page.
    return id ? { to: `/people/${id}` } : {}
  }

  /** The old platform's profile URL. One place builds this shape. */
  function legacyProfileUrl(legacyId: number | string): string {
    return `${platformUrl.value.replace(/\/$/, '')}/people/${legacyId}#profile`
  }

  /**
   * Same decision as profileLink, but for a bare route id and allowed to ASK.
   *
   * The middleware only has the id out of the URL — no person row — so a bridged
   * person (`legacyPersonId` on their row, not in their id) can only be resolved by
   * looking them up. Returns null when there is no profile over there, which means
   * "leave the navigation alone".
   */
  async function resolveProfileUrl(routeId: string): Promise<string | null> {
    if (!embedded.value || !platformUrl.value) return null
    const direct = legacyIdOf(null, routeId)
    if (direct) return legacyProfileUrl(direct)
    // A uuid: ask for the row. Failure is not an error here — it just means we
    // navigate normally rather than blocking on the old platform being reachable.
    try {
      const p: any = await $fetch(`/api/v1/people/${encodeURIComponent(routeId)}`)
      const bridged = p?.legacyPersonId ?? p?.legacy_person_id
      return bridged ? legacyProfileUrl(Number(bridged)) : null
    } catch {
      return null
    }
  }

  return { profileLink, resolveProfileUrl }
}
