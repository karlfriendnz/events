export interface DiscountCondition {
  key: string
  operator: string
  value: any
}

export interface BookingDiscount {
  id: string
  org_id: string
  name: string
  form_text: string | null
  modifier_type: 'PERCENT' | 'FLAT'
  modifier_value: number
  apply_to: 'BOOKING' | 'ADDONS' | 'BOOKING_AND_ADDONS'
  conditions: DiscountCondition[]
  valid_from: string | null
  valid_until: string | null
  max_uses: number | null
  uses_count: number
  is_active: boolean
  activity_ids: string[]
  mode_ids: string[]
}

export interface BookingContext {
  activityId: string | null
  activityModeId: string | null
  startAt: Date | null
  endAt: Date | null
  attendeeCount: number | null
  bookingTotal: number
  addonsTotal: number
  person?: {
    dob?: string | null
    gender?: string | null
    membership_type?: string | null
    group_ids?: string[]
    postcode?: string | null
  }
}

export interface DiscountMatch {
  discount: BookingDiscount
  amount: number
}

function dateOnly(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }

function yearsBetween(from: Date, to: Date): number {
  let y = to.getFullYear() - from.getFullYear()
  const m = to.getMonth() - from.getMonth()
  if (m < 0 || (m === 0 && to.getDate() < from.getDate())) y--
  return y
}

function cmp(op: string, actual: number, expected: any): boolean {
  if (actual === null || actual === undefined) return false
  if (op === 'gte') return actual >= Number(expected)
  if (op === 'lte') return actual <= Number(expected)
  if (op === 'eq')  return actual === Number(expected)
  if (op === 'between' && expected?.min != null && expected?.max != null) {
    return actual >= Number(expected.min) && actual <= Number(expected.max)
  }
  return false
}

function evaluateCondition(c: DiscountCondition, ctx: BookingContext): boolean {
  const { key, operator, value } = c
  if (!key || !operator) return true

  switch (key) {
    case 'booking_day_of_week': {
      if (!ctx.startAt) return false
      const dow = ctx.startAt.getDay()
      return Array.isArray(value) && value.includes(dow)
    }
    case 'advance_days': {
      if (!ctx.startAt) return false
      const days = Math.floor((dateOnly(ctx.startAt).getTime() - dateOnly(new Date()).getTime()) / 86_400_000)
      return cmp(operator, days, value)
    }
    case 'booking_hour': {
      if (!ctx.startAt) return false
      return cmp(operator, ctx.startAt.getHours(), value)
    }
    case 'duration_mins': {
      if (!ctx.startAt || !ctx.endAt) return false
      const mins = Math.round((ctx.endAt.getTime() - ctx.startAt.getTime()) / 60_000)
      return cmp(operator, mins, value)
    }
    case 'attendee_count': {
      if (ctx.attendeeCount == null) return false
      return cmp(operator, ctx.attendeeCount, value)
    }
    case 'min_total': {
      return cmp(operator, ctx.bookingTotal + ctx.addonsTotal, value)
    }
    case 'age': {
      if (!ctx.person?.dob) return false
      const age = yearsBetween(new Date(ctx.person.dob), new Date())
      return cmp(operator, age, value)
    }
    case 'gender': {
      if (!ctx.person?.gender) return false
      return Array.isArray(value) && value.includes(ctx.person.gender)
    }
    case 'is_member': {
      const isMember = !!ctx.person?.membership_type
      return operator === 'is_true' ? isMember : !isMember
    }
    case 'member_group': {
      const ids = ctx.person?.group_ids ?? []
      return Array.isArray(value) && value.some((v: string) => ids.includes(v))
    }
    case 'postcode': {
      const pc = (ctx.person?.postcode ?? '').trim().toLowerCase()
      if (!pc) return false
      if (operator === 'eq') return pc === String(value ?? '').trim().toLowerCase()
      if (operator === 'is_in' && Array.isArray(value)) {
        return value.map(v => String(v).trim().toLowerCase()).includes(pc)
      }
      return false
    }
    // member_years — not yet stored on persons; skip (fails closed)
    case 'member_years': return false
    default: return false
  }
}

function amountForDiscount(d: BookingDiscount, ctx: BookingContext): number {
  const base = d.apply_to === 'BOOKING' ? ctx.bookingTotal
    : d.apply_to === 'ADDONS' ? ctx.addonsTotal
    : ctx.bookingTotal + ctx.addonsTotal
  if (base <= 0) return 0
  const raw = d.modifier_type === 'PERCENT' ? base * (d.modifier_value / 100) : d.modifier_value
  return Math.max(0, Math.min(raw, base))
}

export function useBookingDiscounts() {
  const db = useDb()
  const { orgId } = useOrg()

  async function loadActive(): Promise<BookingDiscount[]> {
    if (!orgId.value) return []
    const [discRes, actRes, modeRes] = await Promise.all([
      (db.from as any)('booking_discounts')
        .select('*')
        .eq('org_id', orgId.value)
        .eq('is_active', true),
      (db.from as any)('booking_discount_activities').select('discount_id, activity_id'),
      (db.from as any)('booking_discount_activity_modes').select('discount_id, activity_mode_id'),
    ])
    const acts: Record<string, string[]> = {}
    for (const r of (actRes.data ?? [])) (acts[r.discount_id] ??= []).push(r.activity_id)
    const modes: Record<string, string[]> = {}
    for (const r of (modeRes.data ?? [])) (modes[r.discount_id] ??= []).push(r.activity_mode_id)
    return (discRes.data ?? []).map((d: any) => ({
      ...d,
      activity_ids: acts[d.id] ?? [],
      mode_ids: modes[d.id] ?? [],
    }))
  }

  function qualifies(d: BookingDiscount, ctx: BookingContext): boolean {
    // Validity window
    const now = new Date()
    if (d.valid_from && new Date(d.valid_from) > now) return false
    if (d.valid_until && new Date(d.valid_until) < now) return false
    // Usage cap (soft check — server re-checks atomically)
    if (d.max_uses != null && d.uses_count >= d.max_uses) return false
    // Scope — empty both = all
    if (d.activity_ids.length || d.mode_ids.length) {
      const actOk = ctx.activityId ? d.activity_ids.includes(ctx.activityId) : false
      const modeOk = ctx.activityModeId ? d.mode_ids.includes(ctx.activityModeId) : false
      if (!actOk && !modeOk) return false
    }
    // Criteria — ALL must pass
    for (const c of (d.conditions ?? [])) {
      if (!evaluateCondition(c, ctx)) return false
    }
    return true
  }

  function bestMatch(discounts: BookingDiscount[], ctx: BookingContext): DiscountMatch | null {
    let best: DiscountMatch | null = null
    for (const d of discounts) {
      if (!qualifies(d, ctx)) continue
      const amount = amountForDiscount(d, ctx)
      if (amount <= 0) continue
      if (!best || amount > best.amount) best = { discount: d, amount }
    }
    return best
  }

  return { loadActive, qualifies, bestMatch, amountForDiscount }
}
