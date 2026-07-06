// Terms & Memberships — shared types, loaders and period math.
//
// Two billing models a club can run (and mix across groups):
//   • Terms        — org-wide date ranges (org_terms); groups attach via
//                    member_group_terms (with a per-term fee).
//   • Memberships  — recurring named plans (membership_plans) with duration
//                    options (membership_plan_options, 1/3/6 month …) that
//                    auto-roll over; groups connect via member_group_plans.
//
// A person records which model they joined a group under on their
// member_group_memberships row (term_id | plan_option_id + start/end).

export interface OrgTerm {
  id: string
  org_id?: string
  name: string
  start_date: string | null
  end_date: string | null
  // Sign-up window (migration 229) — the TERM owns when registration opens,
  // forms stay date-free. Null open = open immediately; null close = term end.
  signup_open: string | null
  signup_close: string | null
  // Term set (migration 232) — the independent sequence this term belongs to.
  // "Next term" only ever resolves within the same set; null = the default set.
  set_id: string | null
  status: string
  sort_order: number
}

export interface TermSet {
  id: string
  org_id?: string
  name: string
  // The sport this sequence belongs to (org_sports id; migration 235). Null = whole club.
  sport_id: string | null
  sort_order: number
}

// Two terms are rollover-adjacent only when they share a set (null = default).
export function sameTermSet(a: { set_id?: string | null }, b: { set_id?: string | null }): boolean {
  return (a.set_id ?? null) === (b.set_id ?? null)
}

// Is member registration for this term open on `today`? Defaults per the
// column comments: no open date = already open, no close date = term end.
export function termSignupOpen(t: Pick<OrgTerm, 'signup_open' | 'signup_close' | 'end_date'>, today = new Date()): boolean {
  const d = new Date(today); d.setHours(0, 0, 0, 0)
  const day = (iso: string) => new Date(`${iso}T00:00:00`).getTime()
  if (t.signup_open && day(t.signup_open) > d.getTime()) return false
  const close = t.signup_close ?? t.end_date
  if (close && day(close) < d.getTime()) return false
  return true
}

export interface MembershipPlanOption {
  id: string
  plan_id?: string
  name: string | null
  period_unit: 'week' | 'month' | 'year'
  period_count: number
  price: number | null
  auto_renew: boolean
  sort_order: number
}

export interface MembershipPlan {
  id: string
  org_id?: string
  name: string
  description: string | null
  color: string | null
  status: string
  sort_order: number
  options: MembershipPlanOption[]
}

export interface GroupBilling {
  terms: { term_id: string; fee: number | null; term?: OrgTerm }[]
  plans: { plan_id: string; plan?: MembershipPlan }[]
}

export function useTermsMemberships() {
  const db = useDb()
  const { orgId } = useOrg()

  // ---- period math ----
  // A readable label for an option's duration, e.g. "3 months", "1 year".
  function periodLabel(unit: string, count: number): string {
    const n = Number(count) || 1
    const u = (unit || 'month').replace(/s$/, '')
    return `${n} ${u}${n === 1 ? '' : 's'}`
  }

  // A human label for a whole option: "Senior — 3 months · $120".
  function optionLabel(opt: MembershipPlanOption, currency = 'NZD'): string {
    const dur = opt.name?.trim() || periodLabel(opt.period_unit, opt.period_count)
    const price = opt.price != null ? ` · ${fmtMoney(opt.price, currency)}` : ''
    return `${dur}${price}`
  }

  function fmtMoney(v: number, currency = 'NZD'): string {
    try {
      return new Intl.NumberFormat('en-NZ', { style: 'currency', currency }).format(Number(v))
    } catch {
      return `$${Number(v).toFixed(2)}`
    }
  }

  // Add N units to an ISO date string, returning an ISO date string.
  function addPeriod(startIso: string, unit: string, count: number): string {
    const d = new Date(startIso + 'T00:00:00')
    const n = Number(count) || 1
    if (unit === 'week') d.setDate(d.getDate() + n * 7)
    else if (unit === 'year') d.setFullYear(d.getFullYear() + n)
    else d.setMonth(d.getMonth() + n) // month default
    return toIso(d)
  }

  function toIso(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  // ---- loaders ----
  async function loadTerms(org = orgId.value): Promise<OrgTerm[]> {
    const { data } = await (db.from as any)('org_terms')
      .select('id, org_id, name, start_date, end_date, signup_open, signup_close, set_id, status, sort_order')
      .eq('org_id', org)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('start_date')
    return (data || []) as OrgTerm[]
  }

  // ---- term sets (migration 232) ----
  async function loadTermSets(org = orgId.value): Promise<TermSet[]> {
    const { data } = await (db.from as any)('term_sets')
      .select('id, org_id, name, sport_id, sort_order')
      .eq('org_id', org)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name')
    return (data || []) as TermSet[]
  }
  async function createTermSet(name: string, org = orgId.value): Promise<TermSet | null> {
    const { data } = await (db.from as any)('term_sets')
      .insert({ org_id: org, name }).select('id, org_id, name, sport_id, sort_order').single()
    return (data ?? null) as TermSet | null
  }
  async function renameTermSet(id: string, name: string): Promise<void> {
    await (db.from as any)('term_sets').update({ name }).eq('id', id)
  }
  async function setTermSetSport(id: string, sportId: string | null): Promise<void> {
    await (db.from as any)('term_sets').update({ sport_id: sportId }).eq('id', id)
  }
  async function deleteTermSet(id: string): Promise<void> {
    // Terms fall back to the default set (set_id → null via FK on delete set null)
    await (db.from as any)('term_sets').delete().eq('id', id)
  }

  async function loadPlans(org = orgId.value): Promise<MembershipPlan[]> {
    const { data: plans } = await (db.from as any)('membership_plans')
      .select('id, org_id, name, description, color, status, sort_order')
      .eq('org_id', org)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name')
    const list = (plans || []) as MembershipPlan[]
    if (!list.length) return []
    const { data: opts } = await (db.from as any)('membership_plan_options')
      .select('id, plan_id, name, period_unit, period_count, price, auto_renew, sort_order')
      .in('plan_id', list.map(p => p.id))
      .order('sort_order', { ascending: true, nullsFirst: false })
    const byPlan: Record<string, MembershipPlanOption[]> = {}
    for (const o of (opts || []) as MembershipPlanOption[]) (byPlan[o.plan_id!] ||= []).push(o)
    return list.map(p => ({ ...p, options: byPlan[p.id] || [] }))
  }

  // What a single group offers (term links + plan links), hydrated.
  async function loadGroupBilling(groupId: string): Promise<GroupBilling> {
    const [{ data: gt }, { data: gp }] = await Promise.all([
      (db.from as any)('member_group_terms').select('term_id, fee').eq('group_id', groupId),
      (db.from as any)('member_group_plans').select('plan_id').eq('group_id', groupId),
    ])
    return {
      terms: (gt || []).map((r: any) => ({ term_id: r.term_id, fee: r.fee })),
      plans: (gp || []).map((r: any) => ({ plan_id: r.plan_id })),
    }
  }

  return {
    periodLabel,
    optionLabel,
    fmtMoney,
    addPeriod,
    toIso,
    loadTerms,
    loadTermSets,
    createTermSet,
    renameTermSet,
    setTermSetSport,
    deleteTermSet,
    loadPlans,
    loadGroupBilling,
  }
}
