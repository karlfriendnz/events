<template>
  <div class="overflow-y-auto flex-1 px-4 py-4 space-y-5">

    <!-- Visibility Conditions -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-semibold text-gray-800">Visibility Conditions</p>
          <p class="text-[11px] text-gray-400">Only show this field when other answers match.</p>
        </div>
        <ToggleSwitch :modelValue="!!field.has_visibility_conditions" @update:modelValue="onToggleVisibility" />
      </div>
      <template v-if="field.has_visibility_conditions">
        <div v-for="(cond, idx) in (field.visibility_conditions ?? [])" :key="cond.id" class="space-y-2">
          <p class="text-xs font-semibold text-gray-500">{{ idx === 0 ? 'When' : 'and when' }}</p>
          <div class="flex items-center gap-2">
            <select v-model="cond.field"
              class="flex-1 h-9 px-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] bg-white text-gray-700">
              <option value="" disabled>Select field…</option>
              <option v-for="f in otherFieldOptions" :key="f._optKey" :value="f.label">{{ f.label }}</option>
            </select>
            <button type="button"
              class="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-500 transition-colors shrink-0"
              @click="removeVisibilityCondition(cond.id)">
              <i class="pi pi-times text-xs" />
            </button>
          </div>
          <div class="flex items-center gap-2">
            <select v-model="cond.operator"
              class="w-28 h-9 px-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] bg-white text-gray-700 shrink-0">
              <option v-for="op in operators" :key="op" :value="op">{{ op }}</option>
            </select>
            <input v-if="!['Is Empty','Is Not Empty'].includes(cond.operator)" v-model="cond.value"
              type="text" placeholder="Value"
              class="flex-1 h-9 px-3 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3]" />
          </div>
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
          <p class="text-[11px] text-gray-400">Add a fee or discount when conditions match.</p>
        </div>
        <ToggleSwitch :modelValue="!!field.has_financial_increase" @update:modelValue="onToggleFinancial" />
      </div>
      <template v-if="field.has_financial_increase">
        <div v-for="rule in (field.financial_rules ?? [])" :key="rule.id"
          class="border border-gray-200 rounded-xl p-3 space-y-2.5 bg-gray-50/60">
          <div v-for="(cond, idx) in rule.conditions" :key="cond.id" class="space-y-2">
            <p class="text-xs font-semibold text-gray-500">{{ idx === 0 ? 'When' : 'and when' }}</p>
            <div class="flex items-center gap-2">
              <select v-model="cond.field"
                class="flex-1 h-9 px-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] bg-white text-gray-700">
                <option value="" disabled>Select field…</option>
                <option v-for="f in financialFieldOptions" :key="f._optKey" :value="f.label">{{ f._display }}</option>
              </select>
              <button type="button"
                class="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-500 transition-colors shrink-0"
                @click="removeFinancialCondition(rule, cond.id)">
                <i class="pi pi-times text-xs" />
              </button>
            </div>
            <div class="flex items-center gap-2">
              <select v-model="cond.operator"
                class="w-28 h-9 px-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] bg-white text-gray-700 shrink-0">
                <option v-for="op in operators" :key="op" :value="op">{{ op }}</option>
              </select>
              <input v-if="!['Is Empty','Is Not Empty'].includes(cond.operator)" v-model="cond.value"
                type="text" placeholder="Value"
                class="flex-1 h-9 px-3 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3]" />
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
              <option v-for="ac in accountCodes" :key="ac" :value="ac">{{ ac }}</option>
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
import { computed } from 'vue'

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
}>(), {
  hideFinancial: false,
  accountCodes: () => ['ACC-001', 'ACC-002', 'ACC-003', 'ACC-004', 'ACC-005'] as const,
  operators:    () => ['Equals', 'Is Not', 'Contains', 'Is Empty', 'Is Not Empty'] as const,
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
