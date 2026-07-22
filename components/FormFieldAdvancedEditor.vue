<template>
  <div class="overflow-y-auto flex-1 px-4 py-4 space-y-5">

    <!-- Visibility Conditions -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-semibold text-gray-800">Visibility Conditions</p>
          <p class="text-sm text-gray-500">Only show this field when other answers match.</p>
        </div>
        <ToggleSwitch :modelValue="!!field.has_visibility_conditions" @update:modelValue="onToggleVisibility" />
      </div>
      <template v-if="field.has_visibility_conditions">
        <div v-for="(cond, idx) in (field.visibility_conditions ?? [])" :key="cond.id" class="space-y-2">
          <p class="text-xs font-semibold text-gray-500">{{ idx === 0 ? 'When' : 'and when' }}</p>
          <div class="flex items-center gap-2">
            <!-- What the condition is ABOUT: another answer on this form, or the
                 person registering. -->
            <select :value="cond.field"
              class="flex-1 h-9 px-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] bg-white text-gray-700"
              @change="cond.field = ($event.target as HTMLSelectElement).value; onConditionFieldChange(cond)">
              <option value="" disabled>Select field…</option>
              <optgroup label="Answers on this form">
                <option v-for="f in otherFieldOptions" :key="f._optKey" :value="f.label">{{ f.label }}</option>
              </optgroup>
              <optgroup label="About the person">
                <option v-for="pc in PERSON_CONDITIONS" :key="pc.key" :value="pc.key">{{ pc.label }}</option>
              </optgroup>
            </select>
            <button type="button"
              class="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-500 transition-colors shrink-0"
              @click="removeVisibilityCondition(cond.id)">
              <i class="pi pi-times text-xs" />
            </button>
          </div>
          <!-- Operator + value FOLLOW the field: a date offers Before/After and a date
               box, a dropdown offers its own values, "is a member" offers the statuses. -->
          <div class="flex items-center gap-2">
            <select v-model="cond.operator" @change="onConditionOperatorChange(cond)"
              class="w-32 h-9 px-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] bg-white text-gray-700 shrink-0">
              <option v-for="op in operatorOptionsFor(cond)" :key="op" :value="op">{{ op }}</option>
            </select>
            <template v-if="!NO_VALUE_OPS.includes(cond.operator)">
              <select v-if="valueKindFor(cond.field, cond.operator) === 'choice'" v-model="cond.value"
                class="flex-1 h-9 px-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] bg-white text-gray-700">
                <option value="" disabled>Choose…</option>
                <option v-for="o in valueOptionsFor(cond.field)" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
              <template v-else-if="valueKindFor(cond.field, cond.operator) === 'range'">
                <input :value="rangeVal(cond, 'from')" :type="fieldDef(cond.field)?.field_type === 'date' ? 'date' : 'number'"
                  placeholder="From" class="flex-1 h-9 px-3 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3]"
                  @input="setRangeVal(cond, 'from', ($event.target as HTMLInputElement).value)" />
                <span class="text-xs text-gray-400 shrink-0">and</span>
                <input :value="rangeVal(cond, 'to')" :type="fieldDef(cond.field)?.field_type === 'date' ? 'date' : 'number'"
                  placeholder="To" class="flex-1 h-9 px-3 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3]"
                  @input="setRangeVal(cond, 'to', ($event.target as HTMLInputElement).value)" />
              </template>
              <input v-else-if="valueKindFor(cond.field, cond.operator) !== 'multi'" v-model="cond.value"
                :type="valueKindFor(cond.field, cond.operator) === 'date' ? 'date' : valueKindFor(cond.field, cond.operator) === 'number' ? 'number' : 'text'"
                :placeholder="cond.field === 'person:age' ? 'Years' : 'Value'"
                class="flex-1 h-9 px-3 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3]" />
            </template>
          </div>
          <!-- "Is any of" = pick several. This is how you say male OR female: one row
               with two values, because separate rows are ANDed together. -->
          <div v-if="valueKindFor(cond.field, cond.operator) === 'multi'" class="flex flex-wrap gap-1.5 pl-1">
            <button v-for="o in valueOptionsFor(cond.field)" :key="o.value" type="button"
              class="px-2 py-1 rounded-full text-[11px] font-medium border transition-colors"
              :class="isPicked(cond, o.value)
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'"
              @click="togglePicked(cond, o.value)">
              <i v-if="isPicked(cond, o.value)" class="pi pi-check text-[8px] mr-1" />{{ o.label }}
            </button>
            <span v-if="!valueOptionsFor(cond.field).length" class="text-[11px] text-gray-400 italic">This field has no set answers to pick from.</span>
          </div>
          <p v-if="isPersonCond(cond.field)" class="text-[11px] text-gray-400 flex items-start gap-1.5">
            <i class="pi pi-info-circle text-[10px] mt-0.5 shrink-0" />
            <span>Checked against the person registering. Someone who isn't signed in can't be checked, so the field stays hidden for them.</span>
          </p>
        </div>
        <button type="button"
          class="w-full py-2.5 rounded-xl bg-primary hover:bg-[#161a45] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          @click="addVisibilityCondition">
          <i class="pi pi-plus text-xs" />Add Condition
        </button>
      </template>
    </div>

    <!-- Financial Rules -->
    <div v-if="!hideFinancial" class="space-y-3 pb-2">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-semibold text-gray-800">Financial Rules</p>
          <p class="text-sm text-gray-500">Add a fee or discount when conditions match.</p>
        </div>
        <ToggleSwitch :modelValue="!!field.has_financial_increase" @update:modelValue="onToggleFinancial" />
      </div>
      <template v-if="field.has_financial_increase">
        <div v-for="rule in (field.financial_rules ?? [])" :key="rule.id"
          class="border border-gray-200 rounded-xl p-3 space-y-2.5 bg-gray-50/60">
          <div v-for="(cond, idx) in rule.conditions" :key="cond.id" class="space-y-2">
            <p class="text-xs font-semibold text-gray-500">{{ idx === 0 ? 'When' : 'and when' }}</p>
            <div class="flex items-center gap-2">
              <select :value="cond.field"
                class="flex-1 h-9 px-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] bg-white text-gray-700"
                @change="cond.field = ($event.target as HTMLSelectElement).value; onConditionFieldChange(cond)">
                <option value="" disabled>Select field…</option>
                <optgroup label="Answers on this form">
                  <option v-for="f in financialFieldOptions" :key="f._optKey" :value="f.label">{{ f._display }}</option>
                </optgroup>
                <optgroup label="About the person">
                  <option v-for="pc in PERSON_CONDITIONS" :key="pc.key" :value="pc.key">{{ pc.label }}</option>
                </optgroup>
              </select>
              <button type="button"
                class="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-500 transition-colors shrink-0"
                @click="removeFinancialCondition(rule, cond.id)">
                <i class="pi pi-times text-xs" />
              </button>
            </div>
            <!-- Identical controls to the visibility conditions above: a financial
                 rule is no less deserving of knowing what a date or a dropdown is. -->
            <div class="flex items-center gap-2">
              <select v-model="cond.operator" @change="onConditionOperatorChange(cond)"
                class="w-32 h-9 px-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] bg-white text-gray-700 shrink-0">
                <option v-for="op in operatorOptionsFor(cond)" :key="op" :value="op">{{ op }}</option>
              </select>
              <template v-if="!NO_VALUE_OPS.includes(cond.operator)">
                <select v-if="valueKindFor(cond.field, cond.operator) === 'choice'" v-model="cond.value"
                  class="flex-1 h-9 px-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] bg-white text-gray-700">
                  <option value="" disabled>Choose…</option>
                  <option v-for="o in valueOptionsFor(cond.field)" :key="o.value" :value="o.value">{{ o.label }}</option>
                </select>
                <template v-else-if="valueKindFor(cond.field, cond.operator) === 'range'">
                  <input :value="rangeVal(cond, 'from')" :type="fieldDef(cond.field)?.field_type === 'date' ? 'date' : 'number'"
                    placeholder="From" class="flex-1 h-9 px-3 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3]"
                    @input="setRangeVal(cond, 'from', ($event.target as HTMLInputElement).value)" />
                  <span class="text-xs text-gray-400 shrink-0">and</span>
                  <input :value="rangeVal(cond, 'to')" :type="fieldDef(cond.field)?.field_type === 'date' ? 'date' : 'number'"
                    placeholder="To" class="flex-1 h-9 px-3 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3]"
                    @input="setRangeVal(cond, 'to', ($event.target as HTMLInputElement).value)" />
                </template>
                <input v-else-if="valueKindFor(cond.field, cond.operator) !== 'multi'" v-model="cond.value"
                  :type="valueKindFor(cond.field, cond.operator) === 'date' ? 'date' : valueKindFor(cond.field, cond.operator) === 'number' ? 'number' : 'text'"
                  :placeholder="cond.field === 'person:age' ? 'Years' : 'Value'"
                  class="flex-1 h-9 px-3 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3]" />
              </template>
            </div>
            <div v-if="valueKindFor(cond.field, cond.operator) === 'multi'" class="flex flex-wrap gap-1.5 pl-1">
              <button v-for="o in valueOptionsFor(cond.field)" :key="o.value" type="button"
                class="px-2 py-1 rounded-full text-[11px] font-medium border transition-colors"
                :class="isPicked(cond, o.value) ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'"
                @click="togglePicked(cond, o.value)">
                <i v-if="isPicked(cond, o.value)" class="pi pi-check text-[8px] mr-1" />{{ o.label }}
              </button>
            </div>
          </div>
          <button type="button"
            class="text-xs text-[#0e43a3] font-semibold flex items-center gap-1 hover:underline"
            @click="addFinancialCondition(rule)">
            <i class="pi pi-plus text-[10px]" />and when
          </button>
          <div class="border-t border-gray-200 pt-2.5 space-y-2">
            <select v-model="rule.account_code"
              class="w-full h-9 px-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] bg-white text-gray-700">
              <option value="" disabled>Account code…</option>
              <option v-for="ac in accountOptions" :key="ac.value" :value="ac.value">{{ ac.label }}</option>
            </select>
            <input v-model="rule.fee_name" type="text" placeholder="Fee name"
              class="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3]" />
            <div class="flex items-center gap-2">
              <select v-model="rule.fee_type"
                class="w-32 h-9 px-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] bg-white text-gray-700 shrink-0">
                <option value="increase">Increase fee</option>
                <option value="discount">Discount</option>
              </select>
              <div class="flex-1 relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                <input v-model.number="rule.amount" type="number" min="0" step="0.01" placeholder="0.00"
                  class="w-full h-9 pl-6 pr-3 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3]" />
              </div>
            </div>
          </div>
          <button type="button"
            class="text-xs text-red-400 hover:text-red-600 font-medium flex items-center gap-1"
            @click="removeFinancialRule(rule.id)">
            <i class="pi pi-trash text-[10px]" />Remove rule
          </button>
        </div>
        <button type="button"
          class="w-full py-2.5 rounded-xl bg-primary hover:bg-[#161a45] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          @click="addFinancialRule">
          <i class="pi pi-dollar text-xs" />Add Financial Rule
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'

interface FieldOption { id?: string; _key?: string; label: string }
interface Condition { id: string; field: string; operator: string; value: string }
interface FinancialRule {
  id: string
  conditions: Condition[]
  account_code: string
  fee_name: string
  fee_type: 'increase' | 'discount'
  amount: number | null
}

const props = withDefaults(defineProps<{
  field: any
  conditionFieldOptions: FieldOption[]
  accountCodes?: readonly string[]
  operators?: readonly string[]
  hideFinancial?: boolean   // fields page wants visibility conditions only
  /** Classes/groups the form can ask about (id + name). */
  groupOptions?: { id: string; name: string }[]
  /** The org's person types (key + label). */
  personTypeOptions?: { key: string; label: string }[]
}>(), {
  groupOptions: () => [],
  personTypeOptions: () => [],
  hideFinancial: false,
  accountCodes: () => ['ACC-001', 'ACC-002', 'ACC-003', 'ACC-004', 'ACC-005'] as const,
  operators:    () => ['Equals', 'Is Not', 'Contains', 'Is Empty', 'Is Not Empty'] as const,
})

// ── What a condition can be ABOUT ────────────────────────────────────────────
// Until now only another field's answer. These add the person themselves — the
// registrant's membership, their class, their type. Keys are prefixed so they can't
// collide with a field label (the stored `field` is a label string).
const PERSON_CONDITIONS = [
  { key: 'person:age',           label: 'Age' },
  { key: 'person:member_status', label: 'Membership status' },
  { key: 'person:group',         label: 'Class / group' },
  { key: 'person:person_type',   label: 'Person type' },
]
const MEMBER_STATUS_OPTIONS = [
  { value: 'active_member', label: 'Active member' },
  { value: 'member', label: 'Member' },
  { value: 'inactive_member', label: 'Lapsed member' },
  { value: 'non_member', label: 'Not a member' },
]
const isPersonCond = (f: string) => typeof f === 'string' && f.startsWith('person:')

/** The field a condition points at, when it's a form field. */
function fieldDef(name: string): any {
  return (props.conditionFieldOptions ?? []).find((f: any) => f.label === name)
}

// ── The operator + value control follow the FIELD ────────────────────────────
// A date shouldn't offer "Contains", a dropdown shouldn't ask you to type its
// options from memory, and "is a member" isn't a free-text comparison.
// Each TYPE gets the operators that actually mean something for it, worded the way
// you'd say them. A date isn't "greater than", a tickbox isn't "equals true", and a
// file is either there or it isn't.
const TEXT_OPS = ['Is', 'Is not', 'Contains', 'Starts with', 'Is empty', 'Is not empty']
const NUM_OPS = ['Is', 'Is not', 'Is more than', 'Is less than', 'Is between', 'Is empty', 'Is not empty']
const DATE_OPS = ['Is on', 'Is before', 'Is after', 'Is between', 'Is empty', 'Is not empty']
const CHOICE_OPS = ['Is', 'Is not', 'Is any of', 'Is none of', 'Is empty', 'Is not empty']
const TICK_OPS = ['Is ticked', 'Is not ticked']
const FILE_OPS = ['Is uploaded', 'Is not uploaded']
const IN_OPS = ['Is', 'Is not', 'Is any of', 'Is none of']
const AGE_OPS = ['Is', 'Is more than', 'Is less than', 'Is between']
const MULTI_OPS = ['Is any of', 'Is none of']
const RANGE_OPS = ['Is between']
// Legacy rows stored the older wording — keep them selectable so nothing breaks.
const LEGACY_OPS = ['Equals', 'Is Not', 'Is Empty', 'Is Not Empty', 'Greater Than', 'Less Than', 'Before', 'After']

function operatorsFor(name: string): string[] {
  if (name === 'person:age') return AGE_OPS
  if (isPersonCond(name)) return IN_OPS
  const d = fieldDef(name)
  const t = d?.field_type
  if (t === 'date') return DATE_OPS
  if (t === 'number') return NUM_OPS
  if (t === 'checkbox') return TICK_OPS
  if (t === 'file') return FILE_OPS
  if (t === 'select' || (d?.options ?? []).length) return CHOICE_OPS
  return TEXT_OPS
}
/** Options for the operator select — includes a legacy value so it isn't blank. */
function operatorOptionsFor(cond: any): string[] {
  const ops = operatorsFor(cond.field)
  return cond.operator && !ops.includes(cond.operator) ? [cond.operator, ...ops] : ops
}
/** What the VALUE box should be: none / text / number / date / a list / a range. */
function valueKindFor(name: string, operator?: string): 'none' | 'text' | 'number' | 'date' | 'choice' | 'multi' | 'range' {
  if (operator && NO_VALUE_OPS.includes(operator)) return 'none'
  if (operator && RANGE_OPS.includes(operator)) return 'range'
  if (operator && MULTI_OPS.includes(operator)) return 'multi'
  if (name === 'person:age') return 'number'
  if (isPersonCond(name)) return 'choice'
  const d = fieldDef(name)
  const t = d?.field_type
  if (t === 'date') return 'date'
  if (t === 'number') return 'number'
  if (t === 'select' && (d?.options ?? []).length) return 'choice'
  return 'text'
}
/** The two ends of a range live on the value as { from, to }. */
function rangeVal(cond: any, end: 'from' | 'to') {
  return (cond.value && typeof cond.value === 'object' && !Array.isArray(cond.value)) ? (cond.value[end] ?? '') : ''
}
function setRangeVal(cond: any, end: 'from' | 'to', v: string) {
  const cur = (cond.value && typeof cond.value === 'object' && !Array.isArray(cond.value)) ? cond.value : {}
  cond.value = { ...cur, [end]: v }
}
function valueOptionsFor(name: string): { value: string; label: string }[] {
  if (name === 'person:age') return []
  if (name === 'person:member_status') return MEMBER_STATUS_OPTIONS
  if (name === 'person:group') return (props.groupOptions ?? []).map(g => ({ value: g.id, label: g.name }))
  if (name === 'person:person_type') return (props.personTypeOptions ?? []).map(t => ({ value: t.key, label: t.label }))
  const d = fieldDef(name)
  if (d?.field_type === 'checkbox') return [{ value: 'true', label: 'Ticked' }, { value: 'false', label: 'Not ticked' }]
  return (d?.options ?? []).map((o: string) => ({ value: o, label: o }))
}
/** Operators that need no value at all. */
const NO_VALUE_OPS = ['Is empty', 'Is not empty', 'Is ticked', 'Is not ticked', 'Is uploaded', 'Is not uploaded',
  'Is Empty', 'Is Not Empty']
const asList = (v: any): string[] => (Array.isArray(v) ? v : v ? String(v).split(',').filter(Boolean) : [])
function isPicked(cond: any, value: string) { return asList(cond.value).includes(value) }
function togglePicked(cond: any, value: string) {
  const list = asList(cond.value)
  cond.value = list.includes(value) ? list.filter(v => v !== value) : [...list, value]
}
// Changing the field can strand an operator its new type doesn't have.
function onConditionFieldChange(cond: any) {
  const ops = operatorsFor(cond.field)
  if (!ops.includes(cond.operator)) cond.operator = ops[0]
  cond.value = MULTI_OPS.includes(cond.operator) ? [] : ''
}
// …and so does switching the operator itself: an array left in a text box (or a string
// left in a checkbox list) reads as a corrupted condition.
function onConditionOperatorChange(cond: any) {
  const kind = valueKindFor(cond.field, cond.operator)
  if (kind === 'multi') cond.value = Array.isArray(cond.value) ? cond.value : asList(cond.value)
  else if (kind === 'range') cond.value = (cond.value && typeof cond.value === 'object' && !Array.isArray(cond.value)) ? cond.value : { from: '', to: '' }
  else if (kind === 'none') cond.value = ''
  else if (Array.isArray(cond.value)) cond.value = cond.value[0] ?? ''
  else if (cond.value && typeof cond.value === 'object') cond.value = ''
}

// Account-code options: when the club has Xero connected, offer the REAL
// accounts (the "Accounts you use" shortlist from Settings → Xero, else the
// live income chart) instead of the demo accountCodes prop.
const xa = useXeroAccounts()
onMounted(() => { xa.loadXeroAccounts().then(() => { if (xa.connected.value && !xa.shortlist.value.length) xa.loadAllAccounts() }) })
const accountOptions = computed<{ value: string; label: string }[]>(() => {
  if (xa.connected.value) {
    if (xa.shortlist.value.length) return xa.shortlist.value.map(a => ({
      value: encodeXeroAccount(a.code, a.tracking),
      label: `${a.label} (${a.code}${a.tracking && Object.keys(a.tracking).length ? ' · ' + Object.values(a.tracking).join('/') : ''})`,
    }))
    if (xa.allAccounts.value?.length) return xa.allAccounts.value.map(a => ({ value: a.code, label: `${a.name} (${a.code})` }))
  }
  return props.accountCodes.map(c => ({ value: c, label: c }))
})

// Visibility conditions exclude the field being edited (a field can't gate itself).
const otherFieldOptions = computed(() => {
  const me = props.field
  return props.conditionFieldOptions
    .filter(f => (f.id ?? f._key) !== (me?.id ?? me?._key) && f.label !== me?.label)
    .map(f => ({ ...f, _optKey: f.id ?? f._key ?? f.label, _display: f.label }))
})
// Financial rules CAN key off the current field ("if this field = X"), so its
// options include the field being edited (listed first, labelled "this field").
const financialFieldOptions = computed(() => {
  const me = props.field
  const self = me?.label
    ? [{ _optKey: me?.id ?? me?._key ?? me?.label, label: me.label, _display: `${me.label} (this field)` }]
    : []
  return [...self, ...otherFieldOptions.value]
})

function makeCondition(): Condition {
  return { id: crypto.randomUUID(), field: '', operator: 'Equals', value: '' }
}
function makeFinancialRule(): FinancialRule {
  // Default the first condition to THIS field — the common case is
  // "if this field = X then apply a fee/discount".
  const first = makeCondition()
  first.field = props.field?.label ?? ''
  return {
    id: crypto.randomUUID(),
    conditions: [first],
    account_code: '',
    fee_name: '',
    fee_type: 'increase',
    amount: null,
  }
}

function onToggleVisibility(on: boolean) {
  props.field.has_visibility_conditions = on
  if (on && !(props.field.visibility_conditions ?? []).length) {
    props.field.visibility_conditions = [makeCondition()]
  }
}
function addVisibilityCondition() {
  if (!props.field.visibility_conditions) props.field.visibility_conditions = []
  props.field.visibility_conditions.push(makeCondition())
}
function removeVisibilityCondition(id: string) {
  if (!props.field.visibility_conditions) return
  props.field.visibility_conditions = props.field.visibility_conditions.filter((c: Condition) => c.id !== id)
}

function onToggleFinancial(on: boolean) {
  props.field.has_financial_increase = on
  if (on && !(props.field.financial_rules ?? []).length) {
    props.field.financial_rules = [makeFinancialRule()]
  }
}
function addFinancialRule() {
  if (!props.field.financial_rules) props.field.financial_rules = []
  props.field.financial_rules.push(makeFinancialRule())
}
function removeFinancialRule(id: string) {
  if (!props.field.financial_rules) return
  props.field.financial_rules = props.field.financial_rules.filter((r: FinancialRule) => r.id !== id)
}
function addFinancialCondition(rule: FinancialRule) {
  rule.conditions.push(makeCondition())
}
function removeFinancialCondition(rule: FinancialRule, id: string) {
  const idx = rule.conditions.findIndex(c => c.id === id)
  if (idx >= 0) rule.conditions.splice(idx, 1)
}
</script>
