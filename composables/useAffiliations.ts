// Affiliation between a club and a governing body (migration 273).
//
// Affiliation is a SWITCH, not a transfer. The club requests, the body approves,
// and from that moment the body's fields / disciplines / terminology APPLY via
// the existing live read-time joins — nothing is copied, so nothing goes stale
// and there is no sync to break. The single exception is the club's person types,
// seeded pre-linked on approval, because renaming them IS what ownership means.
//
// Before this, a club affiliated unilaterally and silently: pick a body from a
// dropdown, save, and the body's fields had authority over your members' data
// without the body ever being asked or told.

export type AffiliationStatus = 'pending' | 'approved' | 'revoked'

export interface AffiliationRow {
  id: string
  org_id: string            // the CLUB
  sport: string
  display_name: string | null
  nso_org_id: string | null // the BODY
  is_primary: boolean
  affiliation_status: AffiliationStatus
  requested_at: string | null
  decided_at: string | null
  clubName?: string
  bodyName?: string
}

/** One club a governing body can invite (e.g. to an event) — an APPROVED affiliation
 *  aimed anywhere in the body's subtree. `bodyName` is the heading it sits under so
 *  the picker reads as the NSO's hierarchy (National › Regional › club). */
export interface AffiliatedClub {
  id: string            // the club org id
  name: string
  sport: string         // which affiliation reached it
  bodyId: string | null // the governing body it affiliated to (may be a sub-body)
  bodyName: string
}
/** Clubs grouped under the governing body that approved them — the tab's tree shape. */
export interface AffiliatedClubGroup { label: string; clubs: AffiliatedClub[] }

export const AFFILIATION_LABELS: Record<AffiliationStatus, string> = {
  pending: 'Awaiting approval',
  approved: 'Affiliated',
  revoked: 'Ended',
}

/** Only an approved affiliation inherits — mirrors org_sport_ancestors' filter.
 *  Kept as a named predicate so the rule reads the same in SQL and in the UI. */
export function inherits(row: Pick<AffiliationRow, 'nso_org_id' | 'affiliation_status'>): boolean {
  return !!row.nso_org_id && row.affiliation_status === 'approved'
}

// The seam returns camelCase OrgSportWithNames; this screen (and the shared
// AffiliationRow type) speaks snake_case. Map once at the boundary.
function toRow(r: import('../shared/contracts/affiliation').OrgSportWithNames): AffiliationRow {
  return {
    id: r.id,
    org_id: r.orgId,
    sport: r.sport,
    display_name: r.displayName ?? null,
    nso_org_id: r.nsoOrgId ?? null,
    is_primary: r.isPrimary,
    affiliation_status: r.affiliationStatus as AffiliationStatus,
    requested_at: r.requestedAt ?? null,
    decided_at: r.decidedAt ?? null,
    clubName: r.clubName ?? '',
    bodyName: r.bodyName ?? '',
  }
}

export function useAffiliations() {
  const { orgId } = useOrg()
  const user = useSupabaseUser()
  const api = useAffiliationsApi()
  const typesApi = usePersonTypesApi()

  /** Every affiliation request/relationship pointing AT this governing body —
   *  the register a body has never had. Includes its whole subtree's bodies so a
   *  National sees what its Regionals were asked, too. */
  async function loadForBody(bodyOrgId: string): Promise<AffiliationRow[]> {
    return (await api.affiliationsForBody(bodyOrgId)).map(toRow)
  }

  /** The club's own affiliations, for its Sports screen. */
  async function loadForClub(clubOrgId: string): Promise<AffiliationRow[]> {
    return (await api.affiliationsForClub(clubOrgId)).map(toRow)
  }

  async function decide(rowId: string, status: AffiliationStatus) {
    try {
      await api.updateOrgSport(rowId, { affiliationStatus: status, decidedAt: new Date().toISOString(), decidedBy: user.value?.id ?? null })
      return { error: null as any }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Approve, then seed the club's person types from the body's — pre-linked.
   *
   * FOLD, don't duplicate. A club affiliated to four bodies who each call them
   * "Player" must end up with ONE Player type carrying four links, not four types
   * — one human plays four sports at one club. So an incoming type folds onto an
   * existing club type when the KEY matches, and only creates a new one when it
   * doesn't.
   *
   * NB the fold is by key, which is the very spelling-match this whole feature
   * exists to escape. That is deliberate and safe here: matching only ever means
   * "link them together" (recoverable — unlink), never "hide a field" (silent).
   * A body calling them "Athlete" against a club "Player" therefore produces a
   * second type, which the club can merge by hand. Auto-merging on a guess would
   * be the trap wearing a different hat.
   */
  async function approveAndSeed(row: AffiliationRow): Promise<{ error?: any; seeded: number; linked: number }> {
    const { error } = await decide(row.id, 'approved')
    if (error) return { error, seeded: 0, linked: 0 }
    if (!row.nso_org_id) return { seeded: 0, linked: 0 }

    // The body's + club's person/entity types (types domain, via the seam).
    // Only the body's PUBLISHED types seed/link — a published type is what a body
    // OFFERS its clubs (mig 275), and this is the SAME set the manual linker
    // (loadLinkableTypes → listPublishedTypesForOrgs) shows. A body's own internal
    // Admin/Club-manager types are its staff, never a club's to answer to, so
    // auto-seeding them would diverge from what the linker ever lets a club pick.
    const [allBodyTypes, clubTypes] = await Promise.all([
      typesApi.listTypes(row.nso_org_id),
      typesApi.listTypes(row.org_id),
    ])
    const bodyTypes = allBodyTypes.filter(t => t.isPublished)
    if (!bodyTypes.length) return { seeded: 0, linked: 0 }

    const lc = (s: string) => (s || '').toLowerCase()
    const mine = new Map<string, { id: string; kind: string }>(clubTypes.map(t => [lc(t.key), { id: t.id, kind: t.kind }]))

    let seeded = 0, linked = 0
    for (const bt of bodyTypes) {
      let target = mine.get(lc(bt.key))
      if (!target) {
        // No equivalent — bring the body's type down as the club's OWN row, which
        // it may rename to anything. The link is what keeps the fields flowing.
        try {
          const created = await typesApi.createType({
            orgId: row.org_id, key: bt.key, label: bt.label, kind: bt.kind ?? 'person',
            isAccess: false, sortOrder: clubTypes.length + seeded, memberSlots: [],
          } as any)
          target = { id: created.id, kind: created.kind }
          mine.set(lc(bt.key), target)
          seeded++
        } catch {
          continue   // a clash is not worth failing the approval over
        }
      }
      if (target.kind !== (bt.kind ?? 'person')) continue   // a Team must not answer to a Player
      // Pre-link the club's type to the body's, so the body's fields flow to the
      // club's people the moment they're typed. Best-effort: a link failure must
      // never fail the approval itself — the affiliation is already switched on.
      try {
        await typesApi.createLink({ orgId: row.org_id, typeId: target.id, sourceTypeId: bt.id })
        linked++
      } catch { /* tolerate — pre-linking is best-effort */ }
    }
    return { seeded, linked }
  }

  /**
   * The clubs a governing body may invite — every APPROVED affiliation aimed at the
   * body or anywhere in its subtree (loadForBody already scopes to the subtree so a
   * National sees its Regionals' clubs too). Deduped to one entry per club (a club
   * affiliated for several sports invites once), grouped under the body that
   * approved it so the picker renders as the NSO's hierarchy.
   *
   * READ-ONLY: returns options. It does not write event_org_invitees — the host
   * (EventInviteeManager) owns persistence, exactly as it does for person invitees.
   */
  async function affiliatedClubs(bodyOrgId?: string): Promise<{ flat: AffiliatedClub[]; groups: AffiliatedClubGroup[] }> {
    const id = bodyOrgId ?? orgId.value
    if (!id) return { flat: [], groups: [] }
    const rows = (await loadForBody(id)).filter(r => r.affiliation_status === 'approved' && r.org_id)
    const byClub = new Map<string, AffiliatedClub>()
    for (const r of rows) {
      if (byClub.has(r.org_id)) continue
      byClub.set(r.org_id, { id: r.org_id, name: r.clubName || '', sport: r.sport, bodyId: r.nso_org_id, bodyName: r.bodyName || '' })
    }
    const flat = [...byClub.values()].sort((a, b) => a.name.localeCompare(b.name))
    const byBody = new Map<string, AffiliatedClub[]>()
    for (const c of flat) {
      const key = c.bodyName || 'Affiliated clubs'
      if (!byBody.has(key)) byBody.set(key, [])
      byBody.get(key)!.push(c)
    }
    const groups: AffiliatedClubGroup[] = [...byBody.entries()].map(([label, clubs]) => ({ label, clubs }))
    return { flat, groups }
  }

  /** Ask a body to affiliate. Nothing inherits until they say yes. */
  async function request(rowId: string) {
    try {
      await api.updateOrgSport(rowId, { affiliationStatus: 'pending', requestedAt: new Date().toISOString(), decidedAt: null, decidedBy: null })
      return { error: null as any }
    } catch (error: any) {
      return { error }
    }
  }

  /** Pending requests aimed at the current org (or its subtree) — drives the nav badge. */
  async function pendingCountForBody(bodyOrgId?: string): Promise<number> {
    const id = bodyOrgId ?? orgId.value
    if (!id) return 0
    return await api.pendingCountForBody(id)
  }

  return { loadForBody, loadForClub, decide, approveAndSeed, request, pendingCountForBody, affiliatedClubs }
}
