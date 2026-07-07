// MEMBERSHIPS ON THE GROUP ENGINE (migration 240).
// A membership IS a member_groups row with kind='membership' — no timetable,
// evergreen, but the full group machinery for free (roster, fee options,
// waitlist, restrictions, staff, codes).
//
// `kind` is the single discriminator the whole codebase branches on. Always go
// through these helpers (never compare the string inline) so a future
// "memberships-only" feature — whatever it turns out to be — is a one-place
// change: gate on isMembershipGroup(g) / kindOf(g).
//
// ENTITLEMENTS: "holding this membership gives access to these things."
//   membership_entitlements: membership → (group | code | event | …open…)
// A 'code' target covers the WHOLE programme dynamically (classes added later
// are included), same as registration_form_targets.

export type GroupKind = 'class' | 'membership'
export const GROUP_KINDS: { key: GroupKind; label: string }[] = [
  { key: 'class', label: 'Class' },
  { key: 'membership', label: 'Membership' },
]

export function kindOf(g: { kind?: string | null } | null | undefined): GroupKind {
  return g?.kind === 'membership' ? 'membership' : 'class'
}
export function isMembershipGroup(g: { kind?: string | null } | null | undefined): boolean {
  return kindOf(g) === 'membership'
}

export interface MembershipEntitlement {
  id?: string
  org_id?: string
  membership_group_id: string
  target_type: string   // 'group' | 'code' | 'event' | … (open)
  target_id: string
  sort_order?: number
}

export function useMemberships() {
  const db = useDb()
  const { orgId } = useOrg()

  // ── Entitlement CRUD ──
  async function loadEntitlements(membershipGroupId: string): Promise<MembershipEntitlement[]> {
    const { data } = await (db.from as any)('membership_entitlements')
      .select('id, membership_group_id, target_type, target_id, sort_order')
      .eq('membership_group_id', membershipGroupId)
      .order('sort_order')
    return (data ?? []) as MembershipEntitlement[]
  }

  async function saveEntitlements(membershipGroupId: string, rows: Omit<MembershipEntitlement, 'membership_group_id'>[]): Promise<void> {
    await (db.from as any)('membership_entitlements').delete().eq('membership_group_id', membershipGroupId)
    if (rows.length) {
      await (db.from as any)('membership_entitlements').insert(rows.map((r, i) => ({
        org_id: orgId.value,
        membership_group_id: membershipGroupId,
        target_type: r.target_type,
        target_id: r.target_id,
        sort_order: i,
      })))
    }
  }

  async function loadAllEntitlements(org = orgId.value): Promise<MembershipEntitlement[]> {
    const { data } = await (db.from as any)('membership_entitlements')
      .select('id, membership_group_id, target_type, target_id')
      .eq('org_id', org)
    return (data ?? []) as MembershipEntitlement[]
  }

  // ── Coverage (phase 2): does someone's membership cover a class/event? ──

  /** Pure: which membership group ids cover this CLASS — a direct 'group'
   *  target, or a 'code' target anywhere up the class's code chain. */
  function membershipsCoveringGroup(
    entitlements: MembershipEntitlement[],
    group: { id: string; code_id?: string | null },
    codesById: Record<string, { id: string; parent_id: string | null }>,
  ): string[] {
    const chain = new Set<string>()
    let codeId = group.code_id ?? null
    let guard = 0
    while (codeId && guard++ < 20) {
      chain.add(codeId)
      codeId = codesById[codeId]?.parent_id ?? null
    }
    return [...new Set(entitlements
      .filter(e =>
        (e.target_type === 'group' && e.target_id === group.id) ||
        (e.target_type === 'code' && chain.has(e.target_id)))
      .map(e => e.membership_group_id))]
  }

  /** Pure: which membership group ids cover this EVENT. */
  function membershipsCoveringEvent(entitlements: MembershipEntitlement[], eventId: string): string[] {
    return [...new Set(entitlements
      .filter(e => e.target_type === 'event' && e.target_id === eventId)
      .map(e => e.membership_group_id))]
  }

  /** The membership-kind groups a person belongs to (their active passes). */
  async function personMembershipIds(personId: string): Promise<{ groupId: string; name: string }[]> {
    const { data } = await (db.from as any)('member_group_memberships')
      .select('group:member_groups!inner(id, name, kind, org_id)')
      .eq('person_id', personId)
      .eq('group.kind', 'membership')
      .eq('group.org_id', orgId.value)
    return (data ?? []).map((m: any) => ({ groupId: m.group.id, name: m.group.name }))
  }

  /**
   * Does this person hold a membership that covers the target?
   * Returns the covering membership's name (for "Included in …" UI), or null.
   */
  async function coverageFor(
    personId: string,
    target: { type: 'group'; group: { id: string; code_id?: string | null }; codesById: Record<string, any> } | { type: 'event'; eventId: string },
  ): Promise<{ membershipGroupId: string; membershipName: string } | null> {
    const [held, ents] = await Promise.all([personMembershipIds(personId), loadAllEntitlements()])
    if (!held.length) return null
    const covering = target.type === 'group'
      ? membershipsCoveringGroup(ents, target.group, target.codesById)
      : membershipsCoveringEvent(ents, target.eventId)
    const hit = held.find(h => covering.includes(h.groupId))
    return hit ? { membershipGroupId: hit.groupId, membershipName: hit.name } : null
  }

  return {
    loadEntitlements, saveEntitlements, loadAllEntitlements,
    membershipsCoveringGroup, membershipsCoveringEvent,
    personMembershipIds, coverageFor,
  }
}
