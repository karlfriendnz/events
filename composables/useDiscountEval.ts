/**
 * Shared event-discount evaluation — one implementation for the builder preview
 * (<FormDesigner>) AND the live form (<FormRenderer>) AND the server submit, so the
 * price a registrant sees is the price they're charged.
 *
 * Pure: the host builds a per-person context from the form state and calls
 * discountAmount() for each active discount. Conditions that can't be resolved from
 * form state (membership, first-N, cross-event) are treated as MET here and left for
 * the server to re-check authoritatively.
 */
export interface DiscountCtx {
  personCount: number          // registrants in this registration
  personTotal: number          // this person's total before discount
  positiveAmounts: number[]    // this person's positive line amounts (sessions + fees)
  selectedSessionCount: number // sessions this person selected (incl. required)
  dayCount: number             // distinct days this person has any selection on
  fullDay: boolean             // this person booked EVERY session on at least one day
  fullWeek: boolean            // this person booked EVERY session in at least one week
  age: number | null           // this person's age (from DOB), or null
  selectedSessionDates?: string[] // ISO start_at of this person's selected sessions (for "within a period")
  // Resolved from the identified account when known (a signed-in member / staff pick).
  // ABSENT from raw form state, so the two conditions below FAIL CLOSED when unset —
  // better to withhold than to grant to everyone (the old `default: return true` bug).
  // The server re-checks these authoritatively at submit.
  membershipStatus?: string | null // e.g. 'active_member' | 'member' | 'non_member' | 'inactive_member'
  registrationIndex?: number | null // this person's 1-based position in the event's registration order
  fieldAnswers?: Record<string, any> // this person's custom-field answers, keyed by field id (for the 'custom_field' condition)
}

// "N sessions/days within a period" — a rolling window of `windowDays`, or a fixed
// date range. Counts this person's selected sessions (or the distinct days they fall
// on) and checks whether `count` of them sit inside some window.
function startOfDayMs(d: Date): number { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime() }
function withinPeriodMet(v: any, ctx: DiscountCtx): boolean {
  const count = Number(v?.count)
  if (!count || count <= 0) return true                     // nothing asked → not a blocker
  const unit = v?.unit === 'days' ? 'days' : 'sessions'
  const dayMs = 86400000
  const times = (ctx.selectedSessionDates ?? [])
    .map(s => new Date(s)).filter(d => !isNaN(d.getTime())).map(startOfDayMs).sort((a, b) => a - b)
  if (!times.length) return false
  const units = unit === 'days' ? [...new Set(times)] : times   // days = distinct; sessions = every one
  if (v?.window === 'range') {
    const from = v?.from ? startOfDayMs(new Date(v.from)) : null
    const to = v?.to ? startOfDayMs(new Date(v.to)) : null
    const inRange = units.filter(t => (from == null || t >= from) && (to == null || t <= to))
    return inRange.length >= count
  }
  // rolling: is there any window strictly under windowDays spanning `count` units?
  const windowDays = Number(v?.windowDays)
  if (!windowDays || windowDays <= 0) return false
  const span = windowDays * dayMs
  let lo = 0
  for (let hi = 0; hi < units.length; hi++) {
    while (units[hi] - units[lo] >= span) lo++
    if (hi - lo + 1 >= count) return true
  }
  return false
}

function op(actual: number, operator: string, expected: any): boolean {
  const e = Number(expected)
  switch (operator) {
    case '>=': return actual >= e
    case '>':  return actual > e
    case '<=': return actual <= e
    case '<':  return actual < e
    case '=':  return actual === e
    default:   return true
  }
}

function conditionMet(cond: any, ctx: DiscountCtx): boolean {
  switch (cond.key) {
    case 'registration_group_size_min':   return op(ctx.personCount, cond.operator, cond.value)
    case 'booked_session_count_min':      return op(ctx.selectedSessionCount, cond.operator, cond.value)
    case 'booked_day_count_min':          return op(ctx.dayCount, cond.operator, cond.value)
    case 'registration_total_value_min':  return op(ctx.personTotal, cond.operator, cond.value)
    case 'registration_date_before':      return !cond.value || new Date() <= new Date(cond.value)
    case 'booked_full_day':               return ctx.fullDay
    case 'booked_full_week':              return ctx.fullWeek
    case 'booked_units_within_period':    return withinPeriodMet(cond.value, ctx)
    case 'participant_age_between': {
      if (ctx.age == null) return false
      const min = cond.value?.min, max = cond.value?.max
      return (min == null || ctx.age >= Number(min)) && (max == null || ctx.age <= Number(max))
    }
    case 'participant_age_min':            return ctx.age != null && op(ctx.age, cond.operator, cond.value)
    case 'participant_age_max':            return ctx.age != null && op(ctx.age, cond.operator, cond.value)
    // Membership status + first-N: resolvable only from the identified account, not
    // raw form state. FAIL CLOSED when unknown (don't grant), and the server re-checks
    // authoritatively — the previous fall-through to `default: return true` handed a
    // "Member discount" / "First N" to every registrant.
    case 'participant_member_status': {
      if (ctx.membershipStatus == null) return false
      return cond.operator === 'is_not'
        ? ctx.membershipStatus !== cond.value
        : ctx.membershipStatus === cond.value
    }
    case 'registration_within_first_n_registrations':
      return ctx.registrationIndex != null && op(ctx.registrationIndex, cond.operator || '<=', cond.value)
    case 'promo_code':                     return false   // no promo-code entry yet
    case 'custom_field': {
      // The registrant's answer to a specific custom field. Fail closed when the field
      // is unanswered (don't grant); the server re-checks authoritatively.
      const fid = cond.value?.fieldId
      const ans = fid ? ctx.fieldAnswers?.[fid] : undefined
      if (ans == null || ans === '') return false
      const needle = cond.value?.val
      switch (cond.operator) {
        case 'equals':   return String(ans) === String(needle)
        case 'is_not':   return String(ans) !== String(needle)
        case 'contains': return String(ans).toLowerCase().includes(String(needle ?? '').toLowerCase())
        case 'between':  return Number(ans) >= Number(needle?.min) && Number(ans) <= Number(needle?.max)
        default:         return op(Number(ans), cond.operator, needle)
      }
    }
    // Remaining conditions (membership_type/category, event/session/ticket category,
    // cross-event) aren't offered in the event picker today, so no stored rows use
    // them; they're treated as met here and re-checked server-side if ever enabled.
    default:                               return true
  }
}

/**
 * Is this discount live right now? Enforces is_active AND the validity window
 * (valid_from ≤ now ≤ expires_at). Tolerant of BOTH the snake_case shape the public
 * <FormRenderer> is handed and the camelCase seam shape the builder preview passes,
 * so a caller that forgot to remap doesn't silently skip the window.
 */
export function discountActive(disc: any, now: Date = new Date()): boolean {
  if ((disc.is_active ?? disc.isActive) === false) return false
  const from = disc.valid_from ?? disc.validFrom
  const until = disc.expires_at ?? disc.expiresAt
  if (from && new Date(from) > now) return false
  if (until && new Date(until) < now) return false
  return true
}

/** The discount amount (savings) for one person, or 0 if it doesn't apply. */
export function discountAmount(disc: any, ctx: DiscountCtx): number {
  if (!discountActive(disc)) return 0
  for (const cond of (disc.conditions ?? [])) if (!conditionMet(cond, ctx)) return 0
  const v = Number(disc.modifier_value ?? disc.modifierValue ?? 0)
  const type = disc.modifier_type ?? disc.modifierType
  const pos = ctx.positiveAmounts
  const sum = pos.reduce((s, a) => s + a, 0)
  const pct = (base: number) => base * v / 100
  const clampReplace = (base: number) => Math.max(0, base - v)   // set price to v → savings

  switch (disc.apply_to ?? disc.applyTo ?? 'registration_total') {
    case 'per_session':
      return type === 'PERCENT' ? pos.reduce((s, a) => s + pct(a), 0)
           : type === 'REPLACE' ? pos.reduce((s, a) => s + Math.max(0, a - v), 0)
           : Math.min(pos.length * v, sum)
    case 'per_person':
      return type === 'PERCENT' ? pct(ctx.personTotal) : type === 'REPLACE' ? clampReplace(ctx.personTotal) : Math.min(v, ctx.personTotal)
    case 'cheapest_item': {
      if (!pos.length) return 0
      const c = Math.min(...pos)
      return type === 'PERCENT' ? pct(c) : type === 'REPLACE' ? Math.max(0, c - v) : Math.min(v, c)
    }
    case 'most_expensive_item': {
      if (!pos.length) return 0
      const e = Math.max(...pos)
      return type === 'PERCENT' ? pct(e) : type === 'REPLACE' ? Math.max(0, e - v) : Math.min(v, e)
    }
    case 'registration_total':
    default:
      return type === 'PERCENT' ? pct(ctx.personTotal) : type === 'REPLACE' ? clampReplace(ctx.personTotal) : Math.min(v, ctx.personTotal)
  }
}

/** Per-person applicable discounts (name/formText/amount), from active discounts. */
export function applicableDiscounts(discounts: any[], ctx: DiscountCtx): { name: string; formText: string; amount: number }[] {
  const out: { name: string; formText: string; amount: number }[] = []
  for (const disc of (discounts ?? []).filter((d: any) => discountActive(d))) {
    const amount = discountAmount(disc, ctx)
    if (amount > 0) out.push({ name: disc.name, formText: disc.form_text || disc.formText || disc.name, amount })
  }
  return out
}

/** Aggregate per-person discounts into display lines; oneOnly keeps the best per person. */
export function aggregateDiscountLines(perPerson: { name: string; formText: string; amount: number }[][], oneOnly: boolean): { formText: string; amount: number }[] {
  const map = new Map<string, { formText: string; amount: number }>()
  for (const person of perPerson) {
    const relevant = oneOnly && person.length > 1 ? [person.reduce((a, b) => a.amount >= b.amount ? a : b)] : person
    for (const d of relevant) {
      const existing = map.get(d.name)
      if (existing) existing.amount += d.amount
      else map.set(d.name, { formText: d.formText, amount: d.amount })
    }
  }
  return [...map.values()]
}
