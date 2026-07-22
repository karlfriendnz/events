// The ONE condition evaluator for registration forms.
//
// A condition row is { field, operator, value }. `field` is either another field's
// LABEL on the same form, or a `person:` key (age / member status / class / type).
// Rows are ANDed; "Is any of" is how you say OR within a row.
//
// This file is PURE — no useDb/useOrg/Nuxt runtime — so `server/api/public-form-submit`
// imports the exact same logic the form uses on screen. That matters for money: the
// client applies field-level financial rules to what it SHOWS, and the server recomputes
// the total it STORES. Two evaluators would eventually disagree, and the registrant
// would be charged something other than the price they were quoted.

export type FormCondition = { field?: string; operator?: string; value?: any }

/** Everything a condition can ask about, supplied by whoever is evaluating. */
export type ConditionCtx = {
  /** An answer on this form, by field label. */
  answer: (label: string) => any
  /** Age in whole years, or null when it can't be told. */
  age?: number | null
  /** 'active_member' | 'member' | 'inactive_member' | 'non_member' | '' */
  memberStatus?: string
  /** Class/group ids this registration is for (chosen on the form, else membership). */
  groupIds?: string[]
  /** persons.person_types for the registrant. */
  personTypes?: string[]
  /**
   * What to do when a person-based condition can't be answered (nobody signed in, or
   * the evaluator has no access to that fact). Default false = the condition fails,
   * so a members-only field stays hidden and an unverifiable fee is not charged.
   */
  unknownPersonPasses?: boolean
}

// The editor's wording changed over time (Equals → Is, Greater Than → Is more than).
// Both spellings map to one canonical operator so conditions saved earlier keep working.
const OP_ALIASES: Record<string, string> = {
  Equals: 'is', Is: 'is', 'Is on': 'is',
  'Is Not': 'is not', 'Is not': 'is not',
  Contains: 'contains', 'Starts with': 'starts with',
  'Is Empty': 'empty', 'Is empty': 'empty', 'Is not ticked': 'empty', 'Is not uploaded': 'empty',
  'Is Not Empty': 'not empty', 'Is not empty': 'not empty', 'Is ticked': 'not empty', 'Is uploaded': 'not empty',
  'Greater Than': 'more than', 'Is more than': 'more than',
  'Less Than': 'less than', 'Is less than': 'less than',
  Before: 'before', 'Is before': 'before',
  After: 'after', 'Is after': 'after',
  'Is between': 'between',
  'Is any of': 'any of', 'Is none of': 'none of',
}
export const opOf = (o: any) => OP_ALIASES[o] ?? String(o ?? '').toLowerCase()

const asList = (v: any): string[] =>
  Array.isArray(v) ? v.map(String) : v ? String(v).split(',').filter(Boolean) : []
const asRange = (v: any) => (v && typeof v === 'object' && !Array.isArray(v)) ? v : { from: '', to: '' }
const looksLikeDate = (v: any) => typeof v === 'string' && v.includes('-') && Number.isNaN(Number(v))

function personPasses(c: FormCondition, ctx: ConditionCtx): boolean {
  const op = opOf(c.operator)
  const want = String(c.value ?? '')
  const wanted = asList(c.value)
  const many = op === 'any of' || op === 'none of'
  const negate = op === 'is not' || op === 'none of'
  const yes = (v: boolean) => (negate ? !v : v)
  const hits = (has: (v: string) => boolean) => yes(many ? wanted.some(has) : has(want))
  const unknown = () => (negate ? true : !!ctx.unknownPersonPasses)

  if (c.field === 'person:age') {
    const age = ctx.age ?? null
    if (age == null) return false                     // can't be told → never assume
    if (op === 'between') {
      const { from, to } = asRange(c.value)
      return (from === '' || age >= Number(from)) && (to === '' || age <= Number(to))
    }
    const n = Number(c.value)
    if (op === 'more than') return age > n
    if (op === 'less than') return age < n
    return age === n
  }

  if (c.field === 'person:group') {
    const ids = ctx.groupIds
    if (!ids) return unknown()
    return hits(v => ids.includes(v))
  }

  if (c.field === 'person:person_type') {
    const types = ctx.personTypes
    if (!types) return unknown()
    return hits(v => types.map(String).includes(v))
  }

  if (c.field === 'person:member_status') {
    const status = String(ctx.memberStatus ?? '').toLowerCase()
    if (!status) return unknown()
    const matches = (v: string) => {
      if (v === 'non_member') return status === 'non_member' || status === ''
      if (v === 'active_member') return status === 'active_member' || status === 'active'
      if (v === 'inactive_member') return ['inactive_member', 'inactive', 'lapsed', 'expired'].includes(status)
      return status !== 'non_member'                  // 'member' — any membership at all
    }
    return hits(matches)
  }
  return true
}

/** One condition row. */
export function conditionPasses(c: FormCondition, ctx: ConditionCtx): boolean {
  if (typeof c?.field === 'string' && c.field.startsWith('person:')) return personPasses(c, ctx)
  const val = ctx.answer(String(c?.field ?? '')) ?? ''
  const op = opOf(c?.operator)
  if (op === 'empty') return !val || val === false
  if (op === 'not empty') return !!val && val !== false
  if (op === 'is') return String(val) === String(c.value)
  if (op === 'is not') return String(val) !== String(c.value)
  if (op === 'any of') return asList(c.value).includes(String(val))
  if (op === 'none of') return !asList(c.value).includes(String(val))
  if (op === 'contains') return String(val).toLowerCase().includes(String(c.value).toLowerCase())
  if (op === 'starts with') return String(val).toLowerCase().startsWith(String(c.value).toLowerCase())
  if (op === 'before') return !!val && new Date(String(val)) < new Date(String(c.value))
  if (op === 'after') return !!val && new Date(String(val)) > new Date(String(c.value))
  if (op === 'more than') return Number(val) > Number(c.value)
  if (op === 'less than') return Number(val) < Number(c.value)
  if (op === 'between') {
    const { from, to } = asRange(c.value)
    if (looksLikeDate(val)) {
      const d = new Date(String(val))
      return (!from || d >= new Date(String(from))) && (!to || d <= new Date(String(to)))
    }
    const n = Number(val)
    return (from === '' || n >= Number(from)) && (to === '' || n <= Number(to))
  }
  return true                                          // an operator we don't know isn't a blocker
}

/** Every row must pass (rows are ANDed; use "Is any of" for OR inside a row). */
export function conditionsPass(conds: FormCondition[] | null | undefined, ctx: ConditionCtx): boolean {
  return (conds ?? []).every(c => conditionPasses(c, ctx))
}
