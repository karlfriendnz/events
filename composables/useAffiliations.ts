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

export function useAffiliations() {
  const db = useDb()
  const { orgId } = useOrg()
  const user = useSupabaseUser()
  const { descendantScope } = useOrgHierarchy()

  /** Every affiliation request/relationship pointing AT this governing body —
   *  the register a body has never had. Includes its whole subtree's bodies so a
   *  National sees what its Regionals were asked, too. */
  async function loadForBody(bodyOrgId: string): Promise<AffiliationRow[]> {
    const scope = await descendantScope(bodyOrgId)   // this body + everything under it
    const { data } = await (db.from as any)('org_sports')
      .select('id, org_id, sport, display_name, nso_org_id, is_primary, affiliation_status, requested_at, decided_at, club:organisations!org_sports_org_id_fkey(name), body:organisations!org_sports_nso_org_id_fkey(name)')
      .in('nso_org_id', scope)
      .order('requested_at', { ascending: false })
    return (data ?? []).map((r: any) => ({
      ...r,
      clubName: r.club?.name ?? '',
      bodyName: r.body?.name ?? '',
    }))
  }

  /** The club's own affiliations, for its Sports screen. */
  async function loadForClub(clubOrgId: string): Promise<AffiliationRow[]> {
    const { data } = await (db.from as any)('org_sports')
      .select('id, org_id, sport, display_name, nso_org_id, is_primary, affiliation_status, requested_at, decided_at, body:organisations!org_sports_nso_org_id_fkey(name)')
      .eq('org_id', clubOrgId)
      .order('sort_order')
    return (data ?? []).map((r: any) => ({ ...r, bodyName: r.body?.name ?? '' }))
  }

  async function decide(rowId: string, status: AffiliationStatus) {
    const { error } = await (db.from as any)('org_sports')
      .update({ affiliation_status: status, decided_at: new Date().toISOString(), decided_by: user.value?.id ?? null })
      .eq('id', rowId)
    return { error }
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

    // The body's person/entity types.
    const { data: bodyTypes } = await (db.from as any)('person_target_types')
      .select('id, key, label, kind').eq('org_id', row.nso_org_id).order('sort_order')
    if (!bodyTypes?.length) return { seeded: 0, linked: 0 }

    const { data: clubTypes } = await (db.from as any)('person_target_types')
      .select('id, key, kind').eq('org_id', row.org_id)
    const lc = (s: string) => (s || '').toLowerCase()
    const mine = new Map<string, any>((clubTypes ?? []).map((t: any) => [lc(t.key), t]))

    let seeded = 0, linked = 0
    for (const bt of bodyTypes) {
      let target = mine.get(lc(bt.key))
      if (!target) {
        // No equivalent — bring the body's type down as the club's OWN row, which
        // it may rename to anything. The link is what keeps the fields flowing.
        const { data: created, error: cErr } = await (db.from as any)('person_target_types').insert({
          org_id: row.org_id, key: bt.key, label: bt.label, kind: bt.kind ?? 'person',
          is_access: false, min_count: 0, max_count: null,
          sort_order: (clubTypes?.length ?? 0) + seeded, member_slots: [],
        }).select('id, key, kind').single()
        if (cErr || !created) continue      // a clash is not worth failing the approval over
        target = created
        mine.set(lc(bt.key), created)
        seeded++
      }
      if (target.kind !== (bt.kind ?? 'person')) continue   // a Team must not answer to a Player
      const { error: lErr } = await (db.from as any)('person_type_links')
        .upsert({ org_id: row.org_id, type_id: target.id, source_type_id: bt.id }, { onConflict: 'type_id,source_type_id' })
      if (!lErr) linked++
    }
    return { seeded, linked }
  }

  /** Ask a body to affiliate. Nothing inherits until they say yes. */
  async function request(rowId: string) {
    const { error } = await (db.from as any)('org_sports')
      .update({ affiliation_status: 'pending', requested_at: new Date().toISOString(), decided_at: null, decided_by: null })
      .eq('id', rowId)
    return { error }
  }

  /** Pending requests aimed at the current org — drives the nav badge. */
  async function pendingCountForBody(bodyOrgId?: string): Promise<number> {
    const id = bodyOrgId ?? orgId.value
    if (!id) return 0
    const scope = await descendantScope(id)
    const { count } = await (db.from as any)('org_sports')
      .select('*', { count: 'exact', head: true })
      .in('nso_org_id', scope).eq('affiliation_status', 'pending')
    return count ?? 0
  }

  return { loadForBody, loadForClub, decide, approveAndSeed, request, pendingCountForBody }
}
