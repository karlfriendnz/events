/**
 * The ONE event-discount rule model — the config-driven condition system that
 * used to live inline in pages/events/[id].vue. Extracted so the advanced event
 * editor AND the basic-event wizard drive the exact same <EventDiscountDialog>
 * off one vocabulary (no second, simpler wizard-only model).
 *
 * A discount's conditions are stored on `discounts.conditions` as
 * `{ key, operator, value }[]` where `key` ∈ CONDITION_DEFS. Everything here is
 * pure (no useDb/useOrg) so a host page maps the emitted draft to a DB row
 * whenever it likes — immediately (advanced editor) or deferred to save (wizard).
 */

export interface DiscountCondition {
  key: string | null
  operator: string | null
  value: any
}

export interface DiscountDraft {
  name: string
  form_text: string
  is_active: boolean
  modifier_value: number | null
  modifier_type: 'PERCENT' | 'FLAT' | 'REPLACE'
  apply_to: string
  conditions: DiscountCondition[]
  condition_to_add: string | null
  valid_from_type: 'now' | 'custom'
  valid_from: Date | null
  expires_type: 'event' | 'custom'
  expires_at: Date | null
  save_as_template: boolean
}

export const DISCOUNT_TYPES = [
  { label: '% Off', value: 'PERCENT' },
  { label: '$ Off', value: 'FLAT' },
  { label: 'Set price', value: 'REPLACE' },   // override the price to a fixed amount
]

export const APPLY_TO_OPTIONS = [
  { label: 'Per Person', value: 'per_person' },
  { label: 'Per Session', value: 'per_session' },
  { label: 'Cheapest Item', value: 'cheapest_item' },
  { label: 'Most Expensive', value: 'most_expensive_item' },
  { label: 'Order Total', value: 'registration_total' },
]

// Config-driven condition system — each entry maps to {key, operator, value} in JSONB.
// `label` names the condition in the picker; `sentence` (optional) is the same
// condition read back inside a summary chip, where the operator supplies the word
// the label already carries ("Register before" + "before" stuttered).
export const CONDITION_DEFS: Record<string, { label: string; group: string; operators: string[]; valueType: string; options?: string[]; sentence?: string }> = {
  // Age min/max are NOT offered in the picker (see ACTIVE_CONDITION_KEYS) —
  // `participant_age_between` with an open min OR max subsumes both, so they were
  // redundant. Kept here (and their eval cases in useDiscountEval) so any legacy
  // stored rows still render + evaluate.
  participant_age_min:                      { label: 'Participant min age',              group: 'Participant',   operators: ['>=', '>'],            valueType: 'number' },
  participant_age_max:                      { label: 'Participant max age',              group: 'Participant',   operators: ['<=', '<'],            valueType: 'number' },
  participant_age_between:                  { label: 'Participant age range',            group: 'Participant',   operators: ['between'],            valueType: 'range'  },
  participant_member_status:                { label: 'Membership status',                group: 'Participant',   operators: ['is', 'is_not'],       valueType: 'enum',   options: ['active_member', 'member', 'non_member', 'inactive_member'] },
  participant_membership_type:              { label: 'Membership type',                  group: 'Participant',   operators: ['in', 'not_in'],       valueType: 'array',  options: ['junior', 'senior', 'family', 'social', 'associate'] },
  participant_category:                     { label: 'Participant category',             group: 'Participant',   operators: ['in', 'not_in'],       valueType: 'array',  options: ['junior', 'masters', 'open', 'recreational'] },
  registration_group_size_min:              { label: 'Group size (people)',              group: 'Registration',  operators: ['>=', '>', '='],       valueType: 'number' },
  registration_total_value_min:             { label: 'Cart total ($)',                   group: 'Registration',  operators: ['>=', '>'],            valueType: 'currency'},
  booked_day_count_min:                     { label: 'Full days booked',                 group: 'Registration',  operators: ['>=', '>'],            valueType: 'number' },
  booked_session_count_min:                 { label: 'Sessions booked',                  group: 'Registration',  operators: ['>=', '>'],            valueType: 'number' },
  // Compound "N sessions/days within a period" — e.g. 3 sessions within 3 days,
  // or 3 sessions between two dates. value = { count, unit, window, windowDays, from, to }.
  booked_units_within_period:               { label: 'Booked within a period',           group: 'Registration',  operators: ['within'],             valueType: 'period' },
  // Completeness conditions for multi-session programmes — every session that
  // exists on a given day (resp. in a given week) has been booked.
  booked_full_day:                          { label: 'Whole day booked',                 group: 'Registration',  operators: ['is_true'],            valueType: 'boolean' },
  booked_full_week:                         { label: 'Whole week booked',                group: 'Registration',  operators: ['is_true'],            valueType: 'boolean' },
  ticket_quantity_min:                      { label: 'Ticket quantity',                  group: 'Registration',  operators: ['>=', '>', '='],       valueType: 'number' },
  registration_date_before:                 { label: 'Register before',                  group: 'Registration',  operators: ['<=', '<'],            valueType: 'datetime', sentence: 'Register' },
  registration_within_first_n_registrations:{ label: 'Within the first # of registrations', group: 'Registration', operators: ['<='],              valueType: 'number' },
  promo_code:                               { label: 'Promo code',                       group: 'Registration',  operators: ['equals'],             valueType: 'string' },
  event_category:                           { label: 'Event category',                   group: 'Event/Session', operators: ['in', 'not_in'],       valueType: 'array',  options: ['holiday_programme', 'tournament', 'workshop', 'class', 'camp'] },
  session_category:                         { label: 'Session category',                 group: 'Event/Session', operators: ['in', 'not_in'],       valueType: 'array',  options: ['morning', 'afternoon', 'full_day', 'skills', 'fitness'] },
  ticket_type:                              { label: 'Ticket type',                      group: 'Event/Session', operators: ['in', 'not_in'],       valueType: 'array',  options: ['adult', 'child', 'family_pass', 'concession'] },
  day_index:                                { label: 'Event day number',                 group: 'Event/Session', operators: ['in', 'not_in'],       valueType: 'array'  },
  usage_limit_per_discount:                 { label: 'Total uses cap',                   group: 'Limits',        operators: ['<=', '<'],            valueType: 'number' },
  usage_limit_per_participant:              { label: 'Per-person uses cap',              group: 'Limits',        operators: ['<=', '<'],            valueType: 'number' },
  // Cross-event eligibility — "if this person is already registered for one of
  // these events, give them the discount". Stored as an array of event ids in
  // cond.value; evaluated at registration time against the registrations table.
  registered_for_event:                     { label: 'Already registered for',           group: 'Cross-event',   operators: ['in', 'in_all'],       valueType: 'event_array' },
  // A registrant's answer to one of the form's CUSTOM FIELDS. value = { fieldId, val }
  // (fieldId names the field; cond.operator is the comparison; val is the threshold/needle).
  custom_field:                             { label: 'Custom field answer',              group: 'Participant',   operators: ['equals', 'is_not', '>=', '>', '<=', '<', 'between', 'contains'], valueType: 'custom_field' },
}

export const OPERATOR_LABELS: Record<string, string> = {
  '>=': '≥ at least', '>': '> more than', '<=': '≤ at most', '<': '< less than',
  '=': '= exactly', 'is': 'is', 'is_not': 'is not',
  'in': 'is one of', 'not_in': 'is not one of',
  'is_true': 'yes', 'is_false': 'no',
  'between': 'between', 'equals': 'equals', 'in_all': 'is registered for all of',
  'within': 'within', 'contains': 'contains',
}

// A DATE reads as a date, not a quantity — "Register before ≤ at most 12 Jul" is
// nonsense, so date-valued conditions get their own wording for the SAME operators
// (the numeric labels must stay put: "age ≤ at most 12" is right).
// Deliberately no "after": useDiscountEval tests a date one way only
// (`now <= value`) regardless of operator, so offering it would silently evaluate
// backwards — that needs the evaluator changing first.
export const DATE_OPERATOR_LABELS: Record<string, string> = {
  '<=': 'on or before', '<': 'before',
}

export function operatorLabel(conditionKey: string | null | undefined, operator: string | null | undefined): string {
  if (!operator) return ''
  const def = conditionKey ? CONDITION_DEFS[conditionKey] : undefined
  if (def?.valueType === 'datetime' && DATE_OPERATOR_LABELS[operator]) return DATE_OPERATOR_LABELS[operator]
  return OPERATOR_LABELS[operator] ?? operator
}

// Option VALUES are stored codes ('active_member') because the evaluator compares
// them — but a rule row is a sentence a club reads, so nothing prints the code.
// Overrides are for the ones plain de-snake-casing gets wrong; everything else
// (family_pass → "Family pass") falls through to the generic path.
const OPTION_LABEL_OVERRIDES: Record<string, string> = {
  active_member: 'Active member',
  inactive_member: 'Inactive member',
  non_member: 'Not a member',
  member: 'Member',
}

export function conditionOptionLabel(value: string): string {
  if (OPTION_LABEL_OVERRIDES[value]) return OPTION_LABEL_OVERRIDES[value]
  const words = String(value ?? '').replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export const DISCOUNT_TEMPLATES = [
  { label: 'Member Discount', description: 'Only applies to active members', icon: 'pi-id-card',
    preset: { name: 'Member Discount', form_text: 'Member discount', modifier_value: 10, modifier_type: 'PERCENT', apply_to: 'per_person',
      conditions: [{ key: 'participant_member_status', operator: 'is', value: 'active_member' }] } },
  { label: 'Early Bird', description: 'Register before a cut-off date, % off total', icon: 'pi-stopwatch',
    preset: { name: 'Early Bird', form_text: 'Early bird discount', modifier_value: 10, modifier_type: 'PERCENT', apply_to: 'registration_total',
      conditions: [{ key: 'registration_date_before', operator: '<=', value: null }] } },
  { label: 'Age range', description: 'Auto-applies for a specific age range', icon: 'pi-user',
    preset: { name: 'Age Discount', form_text: 'Age-based discount', modifier_value: 10, modifier_type: 'PERCENT', apply_to: 'per_person',
      conditions: [{ key: 'participant_age_between', operator: 'between', value: { min: null, max: null } }] } },
  { label: 'First in, first served', description: 'Discount for the first N people to register', icon: 'pi-bolt',
    preset: { name: 'First in, first served', form_text: 'Early registration bonus', modifier_value: 15, modifier_type: 'PERCENT', apply_to: 'registration_total',
      conditions: [{ key: 'registration_within_first_n_registrations', operator: '<=', value: 50 }] } },
  // The programme-shaped presets. They mirror quickProgrammeDiscounts() (the
  // multi-session wizard's inline toggles) so a club that isn't in that wizard can
  // still start from them here rather than hand-building the same rule.
  { label: 'Sibling or family', description: 'Off each person when 2+ register together', icon: 'pi-users',
    preset: { name: 'Sibling discount', form_text: 'Sibling discount', modifier_value: 25, modifier_type: 'PERCENT', apply_to: 'per_person',
      conditions: [{ key: 'registration_group_size_min', operator: '>=', value: 2 }] } },
  { label: 'Whole day', description: 'Set price when every session that day is booked', icon: 'pi-sun',
    preset: { name: 'Full day discount', form_text: 'Book the whole day', modifier_value: 50, modifier_type: 'REPLACE', apply_to: 'registration_total',
      conditions: [{ key: 'booked_full_day', operator: 'is_true', value: true }] } },
  { label: 'Whole week', description: 'Set price when the whole week is booked', icon: 'pi-calendar',
    preset: { name: 'Full week discount', form_text: 'Book the whole week', modifier_value: 200, modifier_type: 'REPLACE', apply_to: 'registration_total',
      conditions: [{ key: 'booked_full_week', operator: 'is_true', value: true }] } },
]

// The three QUICK discounts offered at the top of the Holiday Programme
// (multi-session) wizard's Discounts step. They're shown OFF by default — the
// club flips one on and just changes the amount/type; anything more bespoke goes
// through "Create custom discount" below (the full <EventDiscountDialog>).
// Each preset is a partial DiscountDraft plus a stable `key`/`label`/`description`.
// NB: the "whole day/week booked" + group-size conditions are CAPTURED here;
// enforcing them at registration time is a later phase (like every other
// event-discount condition).
export interface QuickDiscountPreset {
  key: string
  label: string
  description: string
  preset: Partial<DiscountDraft> & { name: string }
}

export function quickProgrammeDiscounts(): QuickDiscountPreset[] {
  return [
    { key: 'full_day', label: 'Full day discount', description: 'Set price when the whole day is booked.',
      preset: { name: 'Full day discount', form_text: 'Book the whole day', modifier_value: 50, modifier_type: 'REPLACE', apply_to: 'registration_total',
        conditions: [{ key: 'booked_full_day', operator: 'is_true', value: true }] } },
    { key: 'full_week', label: 'Full week discount', description: 'Set price when the whole week is booked.',
      preset: { name: 'Full week discount', form_text: 'Book the whole week', modifier_value: 200, modifier_type: 'REPLACE', apply_to: 'registration_total',
        conditions: [{ key: 'booked_full_week', operator: 'is_true', value: true }] } },
    { key: 'sibling', label: 'Sibling discount', description: '% off when more than one child registers together.',
      preset: { name: 'Sibling discount', form_text: 'Sibling discount', modifier_value: 25, modifier_type: 'PERCENT', apply_to: 'per_person',
        conditions: [{ key: 'registration_group_size_min', operator: '>=', value: 2 }] } },
  ]
}

export function makeDiscountDraft(): DiscountDraft {
  return {
    name: '', form_text: '', is_active: true,
    modifier_value: null, modifier_type: 'PERCENT', apply_to: 'per_person',
    conditions: [], condition_to_add: null,
    valid_from_type: 'now', valid_from: null,
    expires_type: 'event', expires_at: null, save_as_template: false,
  }
}

// Only these conditions are offered in the picker for now — every DISCOUNT_TEMPLATES
// condition MUST be in here, or the template lands in the editor with a condition
// row whose Select shows an empty placeholder. The rest stay in CONDITION_DEFS so
// existing rules still render and the set is a one-line change to expand.
export const ACTIVE_CONDITION_KEYS = [
  'participant_member_status',              // Membership status
  'participant_age_between',                // Participant age range
  'registration_date_before',              // Register before
  'registration_within_first_n_registrations', // Within the first # of registrations
  'registration_group_size_min',            // Group size (sibling/family)
  'booked_full_day',                        // Whole day booked (programmes)
  'booked_full_week',                       // Whole week booked (programmes)
  'booked_day_count_min',                   // Full days booked (count)
  'booked_session_count_min',               // Sessions booked (count)
  'booked_units_within_period',             // N sessions/days within a period
  'custom_field',                           // a registrant's answer to a custom field
]

export function useEventDiscounts() {
  const conditionTypeOptions = ACTIVE_CONDITION_KEYS
    .filter(key => CONDITION_DEFS[key])
    .map(key => ({ key, label: CONDITION_DEFS[key].label }))

  const getOperatorOptions = (key: string) =>
    (CONDITION_DEFS[key]?.operators ?? []).map(op => ({ value: op, label: operatorLabel(key, op) }))
  const getValueType = (key: string) => CONDITION_DEFS[key]?.valueType ?? 'number'
  // {label, value} — the label is English, the value stays the stored code the
  // evaluator compares against.
  const getConditionOptions = (key: string) =>
    (CONDITION_DEFS[key]?.options ?? []).map(v => ({ label: conditionOptionLabel(v), value: v }))

  function onConditionKeyChange(cond: DiscountCondition, newKey: string) {
    cond.key = newKey
    const def = CONDITION_DEFS[newKey]
    if (!def) return
    cond.operator = def.operators[0]
    if (def.valueType === 'number' || def.valueType === 'currency') cond.value = null
    else if (def.valueType === 'range')    cond.value = { min: null, max: null }
    else if (def.valueType === 'boolean')  cond.value = true
    else if (def.valueType === 'enum')     cond.value = null
    else if (def.valueType === 'array')    cond.value = []
    else if (def.valueType === 'string')   cond.value = ''
    else if (def.valueType === 'datetime') cond.value = null
    else if (def.valueType === 'period')   cond.value = { count: null, unit: 'sessions', window: 'rolling', windowDays: null, from: null, to: null }
    else if (def.valueType === 'custom_field') cond.value = { fieldId: null, val: null }
  }

  function conditionLabel(c: DiscountCondition): string {
    if (!c?.key) return '?'
    const def = CONDITION_DEFS[c.key]
    if (!def) return c.key
    const opLabel = operatorLabel(c.key, c.operator)
    // "3 sessions within 3 days" / "3 days within 12 Jul–16 Jul" — a self-contained sentence.
    if (def.valueType === 'period') {
      const v = c.value || {}
      const n = v.count ?? '?'
      const unit = v.unit || 'sessions'
      const fmt = (d: any) => d ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '?'
      const win = v.window === 'range' ? `${fmt(v.from)}–${fmt(v.to)}` : `${v.windowDays ?? '?'} days`
      return `${n} ${unit} within ${win}`
    }
    // "Custom field ≥ 5" (the field name is resolved by the dialog, not here).
    if (def.valueType === 'custom_field') {
      const v = c.value || {}
      const valStr = c.operator === 'between' ? `${v.val?.min ?? '?'}–${v.val?.max ?? '?'}` : String(v.val ?? '?')
      return `${def.label} ${opLabel} ${valStr}`
    }
    let valLabel = ''
    if (def.valueType === 'boolean') valLabel = ''
    else if (def.valueType === 'range') valLabel = `${c.value?.min ?? '?'}–${c.value?.max ?? '?'}`
    else if (def.valueType === 'enum') valLabel = c.value ? conditionOptionLabel(String(c.value)) : '?'
    else if (def.valueType === 'array') valLabel = Array.isArray(c.value) ? c.value.map(v => conditionOptionLabel(String(v))).join(', ') : ''
    else if (def.valueType === 'datetime') valLabel = c.value ? new Date(c.value).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '?'
    else valLabel = String(c.value ?? '?')
    return [def.sentence ?? def.label, opLabel, valLabel].filter(Boolean).join(' ')
  }

  return {
    DISCOUNT_TYPES, APPLY_TO_OPTIONS, DISCOUNT_TEMPLATES, CONDITION_DEFS, OPERATOR_LABELS,
    conditionTypeOptions, getOperatorOptions, getValueType, getConditionOptions,
    onConditionKeyChange, conditionLabel, conditionOptionLabel, operatorLabel, makeDiscountDraft,
  }
}
