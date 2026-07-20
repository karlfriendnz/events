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
  // Benefit level (mig 243): included = free; discounts reduce the target's
  // price; anything the membership doesn't list is full price.
  benefit_type?: 'included' | 'discount_percent' | 'discount_amount'
  benefit_value?: number | null
  sort_order?: number
}
export const BENEFIT_TYPES = [
  { key: 'included', label: 'Included (free)' },
  { key: 'discount_percent', label: '% off' },
  { key: 'discount_amount', label: '$ off' },
] as const
export function benefitLabel(e: { benefit_type?: string; benefit_value?: number | null }, currency = 'NZD'): string {
  if (!e.benefit_type || e.benefit_type === 'included') return 'Included'
  if (e.benefit_type === 'discount_percent') return `${e.benefit_value ?? 0}% off`
  return `${new Intl.NumberFormat('en-NZ', { style: 'currency', currency }).format(e.benefit_value ?? 0)} off`
}

// ── Membership settings (migrations 241+242, member_groups.membership_settings jsonb) ──
// Renewal, anchoring, purchase rules, payment collection, approval, benefits.
// Captured per membership; the engines that consume them (renewal cron, emails,
// payment collection, credit ledger) are later phases. Null column = defaults.
export interface RenewalWindow { count: number; unit: 'day' | 'week' | 'month' | 'year' }
export interface RenewalSettings {
  member_renewable: boolean
  expiry_reminder: boolean
  change_before: RenewalWindow
  change_after: RenewalWindow
  invoice_due: 'default' | 'specific'
  invoice_due_days: number
  auto: {
    enabled: boolean
    reminders: boolean
    default_on: boolean
    opt_in: boolean
    opt_out: boolean
    require_card: boolean
    days_before: number
    strategy: 'renew_if_paid' | 'renew_always' | 'invoice_only'
  }
  anchoring: {
    enabled: boolean
    prorate: boolean
    auto_next_term: boolean
    anchor_day: number
    anchor_month: number   // 1–12
    threshold: RenewalWindow
  }
}
export interface PurchaseSettings {
  purchasable_by: 'everyone' | 'any_member' | 'specific_membership' | 'casuals_and_specific' | 'casuals_only'
  specific_membership_ids: string[]
  min_age: number | null
  max_age: number | null
  from_members_page: boolean       // buyable from their memberships page
  selectable_on_change: boolean    // selectable when changing membership
  pay_later: boolean               // allow pay-later on purchase/renewal
  selectable_at_registration: boolean
  direct_link_only: boolean
  is_default: boolean              // the default type for new members
  payment_collection: 'advance' | 'later' | 'after_approval'
  approval: 'none' | 'on_payment_failure' | 'always'
}
export interface BenefitSettings {
  credit: { enabled: boolean; amount: number }
}
export interface MembershipSettings {
  renewal: RenewalSettings
  purchase: PurchaseSettings
  benefits: BenefitSettings
}

export function defaultRenewal(): RenewalSettings {
  return {
    member_renewable: true,
    expiry_reminder: true,
    change_before: { count: 1, unit: 'month' },
    change_after: { count: 1, unit: 'month' },
    invoice_due: 'default',
    invoice_due_days: 7,
    auto: { enabled: true, reminders: true, default_on: true, opt_in: true, opt_out: true, require_card: false, days_before: 7, strategy: 'renew_if_paid' },
    anchoring: { enabled: false, prorate: true, auto_next_term: true, anchor_day: 1, anchor_month: 1, threshold: { count: 1, unit: 'week' } },
  }
}
function mergeRenewal(d: RenewalSettings, stored: any): RenewalSettings {
  if (!stored || typeof stored !== 'object') return d
  return {
    ...d, ...stored,
    change_before: { ...d.change_before, ...(stored.change_before ?? {}) },
    change_after: { ...d.change_after, ...(stored.change_after ?? {}) },
    auto: { ...d.auto, ...(stored.auto ?? {}) },
    anchoring: { ...d.anchoring, ...(stored.anchoring ?? {}), threshold: { ...d.anchoring.threshold, ...(stored.anchoring?.threshold ?? {}) } },
  }
}

export function defaultMembershipSettings(): MembershipSettings {
  return {
    renewal: defaultRenewal(),
    purchase: {
      purchasable_by: 'everyone', specific_membership_ids: [], min_age: null, max_age: null,
      from_members_page: true, selectable_on_change: true, pay_later: true,
      selectable_at_registration: true, direct_link_only: false, is_default: false,
      payment_collection: 'advance', approval: 'none',
    },
    benefits: { credit: { enabled: false, amount: 0 } },
  }
}

/** Merge a stored membership_settings blob over the defaults. */
export function resolveMembershipSettings(stored: any): MembershipSettings {
  const d = defaultMembershipSettings()
  if (!stored || typeof stored !== 'object') return d
  return {
    renewal: mergeRenewal(d.renewal, stored.renewal),
    purchase: { ...d.purchase, ...(stored.purchase ?? {}) },
    benefits: { credit: { ...d.benefits.credit, ...(stored.benefits?.credit ?? {}) } },
  }
}

export function useMemberships() {
  const { orgId } = useOrg()
  const api = useMembershipsApi()
  const groupsApi = useGroupsApi()

  // camelCase entitlement → this composable's snake_case shape.
  function entToSnake(e: any): MembershipEntitlement {
    return {
      id: e.id,
      org_id: e.orgId,
      membership_group_id: e.membershipGroupId,
      target_type: e.targetType,
      target_id: e.targetId,
      benefit_type: (e.benefitType ?? 'included') as MembershipEntitlement['benefit_type'],
      benefit_value: e.benefitValue != null ? Number(e.benefitValue) : null,
      sort_order: e.sortOrder ?? 0,
    }
  }

  // ── Entitlement CRUD ──
  async function loadEntitlements(membershipGroupId: string): Promise<MembershipEntitlement[]> {
    const rows = await api.entitlements(membershipGroupId)
    return rows.map(entToSnake)
  }

  async function saveEntitlements(membershipGroupId: string, rows: Omit<MembershipEntitlement, 'membership_group_id'>[]): Promise<void> {
    await api.saveEntitlements(
      orgId.value,
      membershipGroupId,
      rows.map((r) => ({
        targetType: r.target_type,
        targetId: r.target_id,
        benefitType: r.benefit_type ?? 'included',
        benefitValue: r.benefit_value ?? null,
      })),
    )
  }

  async function loadAllEntitlements(org = orgId.value): Promise<MembershipEntitlement[]> {
    const rows = await api.entitlementsByOrg(org)
    return rows.map(entToSnake)
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

  /** The matching entitlement rows for a class (for benefit resolution). */
  function entitlementsForGroup(
    entitlements: MembershipEntitlement[],
    group: { id: string; code_id?: string | null },
    codesById: Record<string, { id: string; parent_id: string | null }>,
  ): MembershipEntitlement[] {
    const chain = new Set<string>()
    let codeId = group.code_id ?? null
    let guard = 0
    while (codeId && guard++ < 20) { chain.add(codeId); codeId = codesById[codeId]?.parent_id ?? null }
    return entitlements.filter(e =>
      (e.target_type === 'group' && e.target_id === group.id) ||
      (e.target_type === 'code' && chain.has(e.target_id)))
  }

  /** Pure: which membership group ids cover this EVENT. */
  function membershipsCoveringEvent(entitlements: MembershipEntitlement[], eventId: string): string[] {
    return [...new Set(entitlements
      .filter(e => e.target_type === 'event' && e.target_id === eventId)
      .map(e => e.membership_group_id))]
  }

  /** The membership-kind groups a person belongs to (their active passes). Resolves the
   *  person's group ids off the seam, then keeps only the org's membership-kind groups. */
  async function personMembershipIds(personId: string): Promise<{ groupId: string; name: string }[]> {
    if (!orgId.value) return []
    const [mems, groups] = await Promise.all([
      groupsApi.membershipsForPerson(orgId.value, personId),
      groupsApi.list(orgId.value),
    ])
    const membershipById = new Map(
      (groups ?? []).filter((g: any) => isMembershipGroup(g)).map((g: any) => [g.id, g.name]),
    )
    const seen = new Set<string>()
    const out: { groupId: string; name: string }[] = []
    for (const m of mems ?? []) {
      if (seen.has(m.groupId) || !membershipById.has(m.groupId)) continue
      seen.add(m.groupId)
      out.push({ groupId: m.groupId, name: membershipById.get(m.groupId) as string })
    }
    return out
  }

  /**
   * Does this person hold a membership that covers the target?
   * Returns the covering membership's name (for "Included in …" UI), or null.
   */
  async function coverageFor(
    personId: string,
    target: { type: 'group'; group: { id: string; code_id?: string | null }; codesById: Record<string, any> } | { type: 'event'; eventId: string },
  ): Promise<{ membershipGroupId: string; membershipName: string; benefit: MembershipEntitlement } | null> {
    const [held, ents] = await Promise.all([personMembershipIds(personId), loadAllEntitlements()])
    if (!held.length) return null
    const heldIds = new Set(held.map(h => h.groupId))
    const matches = (target.type === 'group'
      ? entitlementsForGroup(ents, target.group, target.codesById)
      : ents.filter(e => e.target_type === 'event' && e.target_id === target.eventId))
      .filter(e => heldIds.has(e.membership_group_id))
    if (!matches.length) return null
    // Most generous wins: an "included" (free) benefit beats every discount;
    // among competing discounts the LARGER value wins (percent vs amount can't be
    // ranked without the target price, so a percent is preferred on an equal value).
    const typeRank = (tp?: string) => (tp ?? 'included') === 'included' ? 2 : 1
    const best = matches.slice().sort((a, b) => {
      const ta = typeRank(a.benefit_type), tb = typeRank(b.benefit_type)
      if (ta !== tb) return tb - ta
      const va = Number(a.benefit_value ?? 0), vb = Number(b.benefit_value ?? 0)
      if (vb !== va) return vb - va
      return (b.benefit_type === 'discount_percent' ? 1 : 0) - (a.benefit_type === 'discount_percent' ? 1 : 0)
    })[0]
    const m = held.find(h => h.groupId === best.membership_group_id)!
    return { membershipGroupId: m.groupId, membershipName: m.name, benefit: best }
  }

  return {
    loadEntitlements, saveEntitlements, loadAllEntitlements,
    membershipsCoveringGroup, membershipsCoveringEvent, entitlementsForGroup,
    personMembershipIds, coverageFor,
  }
}
