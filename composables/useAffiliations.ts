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
    const [bodyTypes, clubTypes] = await Promise.all([
      typesApi.listTypes(row.nso_org_id),
      typesApi.listTypes(row.org_id),
    ])
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
      // CROSS-DOMAIN GAP: the types domain has no person_type_link WRITE yet
      // (usePersonTypesApi.listLinks exists; a createLink/upsert does not). Guarded so
      // a missing method never crashes the approval — links start flowing the moment
      // the types domain adds the write. Mirrors the original's error tolerance.
      try {
        const createLink = (typesApi as any).createLink
        if (typeof createLink === 'function') {
          await createLink({ orgId: row.org_id, typeId: target.id, sourceTypeId: bt.id })
          linked++
        }
      } catch { /* tolerate — pre-linking is best-effort */ }
    }
    return { seeded, linked }
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

  return { loadForBody, loadForClub, decide, approveAndSeed, request, pendingCountForBody }
}
