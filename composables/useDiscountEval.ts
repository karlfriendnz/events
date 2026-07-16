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
    case 'participant_age_between': {
      if (ctx.age == null) return false
      const min = cond.value?.min, max = cond.value?.max
      return (min == null || ctx.age >= Number(min)) && (max == null || ctx.age <= Number(max))
    }
    case 'participant_age_min':            return ctx.age != null && op(ctx.age, cond.operator, cond.value)
    case 'participant_age_max':            return ctx.age != null && op(ctx.age, cond.operator, cond.value)
    case 'promo_code':                     return false   // no promo-code entry yet
    // membership / first-N / cross-event → can't tell from form state; server re-checks
    default:                               return true
  }
}

/** The discount amount (savings) for one person, or 0 if it doesn't apply. */
export function discountAmount(disc: any, ctx: DiscountCtx): number {
  for (const cond of (disc.conditions ?? [])) if (!conditionMet(cond, ctx)) return 0
  const v = Number(disc.modifier_value ?? 0)
  const type = disc.modifier_type
  const pos = ctx.positiveAmounts
  const sum = pos.reduce((s, a) => s + a, 0)
  const pct = (base: number) => base * v / 100
  const clampReplace = (base: number) => Math.max(0, base - v)   // set price to v → savings

  switch (disc.apply_to ?? 'registration_total') {
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
  for (const disc of (discounts ?? []).filter((d: any) => d.is_active !== false)) {
    const amount = discountAmount(disc, ctx)
    if (amount > 0) out.push({ name: disc.name, formText: disc.form_text || disc.name, amount })
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
