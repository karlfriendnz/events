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
  // The LOCATIONS this sequence runs at (migration 239) — a set can cover
  // several sites. Null / empty = the whole club.
  location_ids: string[] | null
  sort_order: number
}

/** Does a term set apply at this location? Main sequence (no set) and sets with
 *  no location scope cover everywhere. */
export function termSetCoversLocation(set: TermSet | null | undefined, locationId: string | null): boolean {
  if (!set || !set.location_ids?.length) return true
  if (!locationId) return true // no-location context sees everything
  return set.location_ids.includes(locationId)
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
  const { orgId } = useOrg()
  const api = useMembershipsApi()

  // ── seam mappers (camelCase contract → this composable's snake_case shapes) ──
  function termToSnake(t: any): OrgTerm {
    return {
      id: t.id,
      org_id: t.orgId,
      name: t.name,
      start_date: t.startDate ?? null,
      end_date: t.endDate ?? null,
      signup_open: t.signupOpen ?? null,
      signup_close: t.signupClose ?? null,
      set_id: t.setId ?? null,
      status: t.status,
      sort_order: t.sortOrder ?? 0,
    }
  }
  function setToSnake(s: any): TermSet {
    return {
      id: s.id,
      org_id: s.orgId,
      name: s.name,
      sport_id: s.sportId ?? null,
      location_ids: s.locationIds ?? null,
      sort_order: s.sortOrder ?? 0,
    }
  }
  function optToSnake(o: any): MembershipPlanOption {
    return {
      id: o.id,
      plan_id: o.planId,
      name: o.name ?? null,
      period_unit: o.periodUnit,
      period_count: o.periodCount,
      price: o.price != null ? Number(o.price) : null,
      auto_renew: !!o.autoRenew,
      sort_order: o.sortOrder ?? 0,
    }
  }
  function planToSnake(p: any): MembershipPlan {
    return {
      id: p.id,
      org_id: p.orgId,
      name: p.name,
      description: p.description ?? null,
      color: p.color ?? null,
      status: p.status,
      sort_order: p.sortOrder ?? 0,
      options: (p.options ?? []).map(optToSnake),
    }
  }

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
    const terms = await api.terms(org)
    return terms.map(termToSnake)
  }

  // The ONE canonical "which term is current?" rule — used to default EVERY term
  // selector in the app (see `currentTermId` export). Priority:
  //   1. the RUNNING term (start ≤ today ≤ end)
  //   2. else the NEXT upcoming term (earliest start after today)
  //   3. else the LATEST finished term (most-recent end before today)
  // so a completed term hands off to the next one, a live term stays selected,
  // and out-of-season we fall back to the term that just ended.
  function currentTermId<T extends { id: string; start_date?: string | null; end_date?: string | null }>(
    terms: T[] | null | undefined,
    today: Date = new Date(),
  ): string | null {
    if (!terms?.length) return null
    const t = new Date(today); t.setHours(0, 0, 0, 0)
    const now = t.getTime()
    const ms = (d?: string | null) => (d ? new Date(d).getTime() : null)
    const running = terms.filter((x) => (ms(x.start_date) ?? -Infinity) <= now && (ms(x.end_date) ?? Infinity) >= now)
    if (running.length) return running.sort((a, b) => (ms(a.start_date) ?? 0) - (ms(b.start_date) ?? 0))[0].id
    const upcoming = terms.filter((x) => (ms(x.start_date) ?? Infinity) > now)
    if (upcoming.length) return upcoming.sort((a, b) => (ms(a.start_date) ?? 0) - (ms(b.start_date) ?? 0))[0].id
    const finished = terms.filter((x) => (ms(x.end_date) ?? -Infinity) < now)
    if (finished.length) return finished.sort((a, b) => (ms(b.end_date) ?? 0) - (ms(a.end_date) ?? 0))[0].id
    return terms[0].id
  }

  // ---- term sets (migration 232) ----
  async function loadTermSets(org = orgId.value): Promise<TermSet[]> {
    const sets = await api.termSets(org)
    return sets.map(setToSnake)
  }
  async function createTermSet(name: string, org = orgId.value): Promise<TermSet | null> {
    try {
      return setToSnake(await api.createTermSet({ orgId: org, name }))
    } catch {
      return null
    }
  }
  async function renameTermSet(id: string, name: string): Promise<void> {
    await api.updateTermSet(id, { name })
  }
  async function setTermSetSport(id: string, sportId: string | null): Promise<void> {
    await api.updateTermSet(id, { sportId })
  }
  async function setTermSetLocations(id: string, locationIds: string[] | null): Promise<void> {
    await api.updateTermSet(id, { locationIds: locationIds?.length ? locationIds : null })
  }
  async function deleteTermSet(id: string): Promise<void> {
    await api.removeTermSet(id)
  }

  async function loadPlans(org = orgId.value): Promise<MembershipPlan[]> {
    const plans = await api.plans(org)
    return plans.map(planToSnake)
  }

  // What a single group offers (term links + plan links).
  async function loadGroupBilling(groupId: string): Promise<GroupBilling> {
    const b = await api.groupBilling(groupId)
    return {
      terms: b.terms.map((r) => ({ term_id: r.termId, fee: r.fee != null ? Number(r.fee) : null })),
      plans: b.plans.map((r) => ({ plan_id: r.planId })),
    }
  }

  return {
    periodLabel,
    optionLabel,
    fmtMoney,
    addPeriod,
    toIso,
    loadTerms,
    currentTermId,
    loadTermSets,
    createTermSet,
    renameTermSet,
    setTermSetSport,
    setTermSetLocations,
    deleteTermSet,
    loadPlans,
    loadGroupBilling,
  }
}
