<!--
  THE discount criteria builder. Extracted from <BookingDiscountsList> so the
  booking discounts screen and the event wizard share ONE rule vocabulary and
  ONE stored shape — the same `conditions: {key, operator, value}[]` that
  `useBookingDiscounts().qualifies()` evaluates.

  Do NOT hand-roll another discount UI. If a new surface needs discounts, mount
  this. `contexts` narrows which criteria are offered (a person registering for
  an event has no "booking duration").
-->
<template>
  <div>
    <div class="flex items-center justify-between mb-3">
      <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide">Criteria</p>
      <span v-if="modelValue.length > 1"
        class="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
        All must be met
      </span>
    </div>

    <!-- Fluid columns, no min-width: a fixed 560px grid forced a horizontal
         scrollbar inside the wizard's narrower column. -->
    <div v-if="modelValue.length" class="rounded-lg border border-gray-200 mb-3">
      <div class="grid bg-gray-50 border-b border-gray-200 px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide"
        style="grid-template-columns: minmax(0,1.4fr) minmax(0,1fr) minmax(0,1.6fr) 32px">
        <span class="pl-1">Criterion</span>
        <span>Operator</span>
        <span>Value</span>
        <span />
      </div>
      <div v-for="(cond, i) in modelValue" :key="i"
        class="grid items-center px-3 border-b border-gray-100 last:border-0 group hover:bg-gray-50/60 transition-colors"
        style="grid-template-columns: minmax(0,1.4fr) minmax(0,1fr) minmax(0,1.6fr) 32px">
        <!-- Criterion -->
        <div class="py-2 pr-2">
          <Select :modelValue="cond.key" :options="conditionTypeGroups"
            optionLabel="label" optionValue="key" optionGroupLabel="label" optionGroupChildren="items"
            placeholder="Choose…" class="w-full text-sm"
            :pt="{ root: { style: 'border:none; box-shadow:none; background:transparent; padding:0' } }"
            @update:modelValue="v => onConditionKeyChange(cond, v)" />
        </div>
        <!-- Operator -->
        <div class="py-2 pr-2 border-l border-gray-100">
          <template v-if="cond.key && condValueType(cond.key) === 'boolean'">
            <div class="flex rounded-md border border-gray-200 overflow-hidden text-xs font-semibold bg-white">
              <button type="button" class="flex-1 py-1.5 border-r border-gray-200 transition-all"
                :class="cond.operator === 'is_true' ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-50'"
                @click="cond.operator = 'is_true'">Yes</button>
              <button type="button" class="flex-1 py-1.5 transition-all"
                :class="cond.operator === 'is_false' ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-50'"
                @click="cond.operator = 'is_false'">No</button>
            </div>
          </template>
          <Select v-else-if="cond.key" v-model="cond.operator" :options="condOperatorOptions(cond.key)"
            optionLabel="label" optionValue="value" class="w-full text-sm"
            :pt="{ root: { style: 'border:none; box-shadow:none; background:transparent; padding:0' } }" />
          <div v-else class="h-9" />
        </div>
        <!-- Value -->
        <div class="py-2 pr-2 pl-2 border-l border-gray-100">
          <template v-if="cond.key && condValueType(cond.key) !== 'boolean'">
            <InputNumber v-if="condValueType(cond.key) === 'number'"
              v-model="cond.value" :min="0" inputClass="h-9 text-sm w-full px-3" class="w-full"
              :pt="{ root: { class: 'w-full' } }" />
            <div v-else-if="condValueType(cond.key) === 'currency'" class="flex items-center gap-1.5">
              <span class="text-sm text-gray-400 shrink-0">$</span>
              <InputNumber v-model="cond.value" :min="0" :minFractionDigits="2" :maxFractionDigits="2"
                inputClass="h-9 text-sm w-full px-3" class="flex-1" :pt="{ root: { class: 'flex-1' } }" />
            </div>
            <DatePicker v-else-if="condValueType(cond.key) === 'datetime'"
              v-model="cond.value" showTime hourFormat="12" dateFormat="dd/mm/yy"
              inputClass="h-9 text-sm px-3 w-full" class="w-full" />
            <MultiSelect v-else-if="condValueType(cond.key) === 'days'"
              v-model="cond.value" :options="daysOfWeek" optionLabel="label" optionValue="value"
              placeholder="Pick days…" class="w-full text-sm" display="chip" />
            <!-- Member group: classes nested under their code heading — the
                 documented standard shape for group-selection dropdowns. -->

            <ChipMultiSelect v-else-if="condValueType(cond.key) === 'groups'"
              v-model="cond.value"
              :options="groupedGroupOptions"
              optionLabel="name" optionValue="id"
              optionGroupLabel="label" optionGroupChildren="items"
              filter placeholder="Pick classes…"
              class="w-full text-sm">
              <!-- Clicking the code heading selects/clears every class under it —
                   PrimeVue group headers are inert by default. -->
              <template #optiongroup="{ option }">
                <button type="button"
                  class="w-full flex items-center justify-between gap-2 text-left group/hdr"
                  @mousedown.stop.prevent="toggleCodeGroup(cond, option)">
                  <span class="font-semibold text-gray-700">{{ option.label }}</span>
                  <span class="text-[11px] font-medium text-primary opacity-0 group-hover/hdr:opacity-100 transition-opacity">
                    {{ allOfGroupSelected(cond, option) ? 'Clear all' : 'Select all' }}
                  </span>
                </button>
              </template>
            </ChipMultiSelect>
            <MultiSelect v-else-if="condValueType(cond.key) === 'enum'"
              v-model="cond.value" :options="conditionEnumOptions(cond.key)" optionLabel="label" optionValue="value"
              placeholder="Pick…" class="w-full text-sm" display="chip" />
            <InputText v-else-if="condValueType(cond.key) === 'string'"
              v-model="cond.value" placeholder="e.g. 2000" class="w-full text-sm h-9 px-3" />
          </template>
          <div v-else class="h-9" />
        </div>
        <div class="flex justify-center border-l border-gray-100">
          <!-- Always visible, soft-red tile — a hover-only ghost button was easy
               to miss (and unreachable on touch). -->
          <button class="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-500 transition-colors"
            v-tooltip.top="'Remove criterion'"
            @click="modelValue.splice(i, 1)">
            <i class="pi pi-times text-xs" />
          </button>
        </div>
      </div>
    </div>

    <button type="button"
      class="w-full flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-primary border border-dashed border-gray-200 hover:border-primary/30 hover:bg-primary/[0.02] rounded-lg py-2.5 transition-all"
      @click="addCondition">
      <i class="pi pi-plus text-xs" /> Add criterion
    </button>

  </div>
</template>

<script setup lang="ts">
import type { DiscountCondition } from '~/composables/useBookingDiscounts'

const props = withDefaults(defineProps<{
  // Mutated in place (same as the original inline editor did with draft.conditions).
  modelValue: DiscountCondition[]
  // Which criteria groups to offer. Events have no booking-shaped criteria.
  contexts?: ('Booking' | 'Person')[]
  memberGroups?: { id: string; name: string }[]
}>(), {
  contexts: () => ['Booking', 'Person'],
  memberGroups: () => [],
})

// The condition vocabulary useBookingDiscounts().qualifies() understands.
const CONDITION_TYPES = [
  // Booking-shaped
  { key: 'booking_day_of_week', label: 'Booking day of week',   valueType: 'days',     operators: ['is_in'], group: 'Booking' },
  { key: 'advance_days',        label: 'Booked in advance by',  valueType: 'number',   operators: ['gte', 'lte'], group: 'Booking' },
  { key: 'booking_hour',        label: 'Booking start hour',    valueType: 'number',   operators: ['gte', 'lte', 'between'], group: 'Booking' },
  { key: 'duration_mins',       label: 'Duration (minutes)',    valueType: 'number',   operators: ['gte', 'lte'], group: 'Booking' },
  { key: 'attendee_count',      label: 'Attendee count',        valueType: 'number',   operators: ['gte', 'lte', 'eq'], group: 'Booking' },
  { key: 'min_total',           label: 'Minimum total',         valueType: 'currency', operators: ['gte'], group: 'Booking' },
  // Person-shaped
  { key: 'age',                 label: 'Age',                   valueType: 'number',   operators: ['gte', 'lte', 'between'], group: 'Person' },
  { key: 'gender',              label: 'Gender',                valueType: 'enum',     operators: ['is_in'], group: 'Person',
    options: [
      { label: 'Male',              value: 'MALE' },
      { label: 'Female',            value: 'FEMALE' },
      { label: 'Non-binary',        value: 'NON_BINARY' },
      { label: 'Prefer not to say', value: 'UNSPECIFIED' },
    ] },
  { key: 'is_member',           label: 'Member?',               valueType: 'boolean',  operators: ['is_true', 'is_false'], group: 'Person' },
  { key: 'member_years',        label: 'Years as a member',     valueType: 'number',   operators: ['gte', 'lte'], group: 'Person' },
  { key: 'member_group',        label: 'Member group',          valueType: 'groups',   operators: ['is_in'], group: 'Person' },
  { key: 'postcode',            label: 'Postcode',              valueType: 'string',   operators: ['eq', 'is_in'], group: 'Person' },
] as const

const availableTypes = computed(() =>
  CONDITION_TYPES.filter(c => props.contexts.includes(c.group as any)),
)

const conditionTypeGroups = computed(() => {
  const groups: Record<string, any[]> = {}
  for (const c of availableTypes.value) (groups[c.group] ??= []).push(c)
  return Object.entries(groups).map(([label, items]) => ({ label, items }))
})

const OPERATOR_LABELS: Record<string, string> = {
  gte: '≥', lte: '≤', eq: '=', between: 'between',
  is_in: 'is one of', is_true: 'yes', is_false: 'no',
}

const daysOfWeek = [
  { label: 'Mon', value: 1 }, { label: 'Tue', value: 2 }, { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 }, { label: 'Fri', value: 5 }, { label: 'Sat', value: 6 },
  { label: 'Sun', value: 0 },
]

function typeFor(key: string) { return CONDITION_TYPES.find(c => c.key === key) }
function condValueType(key: string) { return typeFor(key)?.valueType ?? 'string' }
function condOperatorOptions(key: string) {
  return (typeFor(key)?.operators ?? []).map(o => ({ label: OPERATOR_LABELS[o] ?? o, value: o }))
}
function conditionEnumOptions(key: string) { return (typeFor(key) as any)?.options ?? [] }

function onConditionKeyChange(cond: DiscountCondition, key: string) {
  cond.key = key
  const ops = typeFor(key)?.operators ?? []
  cond.operator = ops[0] ?? ''
  // Value shape depends on the criterion — reset rather than carry a stale one.
  const t = condValueType(key)
  cond.value = (t === 'days' || t === 'groups' || t === 'enum') ? [] : null
}

function addCondition() {
  props.modelValue.push({ key: '', operator: '', value: null })
}

// Clicking a code heading toggles every class in that programme at once.
function selectedIds(cond: DiscountCondition): string[] {
  return Array.isArray(cond.value) ? cond.value : []
}
function allOfGroupSelected(cond: DiscountCondition, group: { items: { id: string }[] }) {
  const sel = new Set(selectedIds(cond))
  return group.items.length > 0 && group.items.every(g => sel.has(g.id))
}
function toggleCodeGroup(cond: DiscountCondition, group: { items: { id: string }[] }) {
  const sel = new Set(selectedIds(cond))
  if (allOfGroupSelected(cond, group)) {
    for (const g of group.items) sel.delete(g.id)
  } else {
    for (const g of group.items) sel.add(g.id)
  }
  cond.value = [...sel]
}

// ── Member-group options ───────────────────────────────────────────────────
// Classes grouped under their code heading. The condition value stays a plain
// list of group ids — exactly what useBookingDiscounts().qualifies() matches on.
const db = useDb()
const { orgId } = useOrg()
const gc = useGroupCodes()

const allGroups = ref<{ id: string; name: string; code_id: string | null }[]>([])
const allCodes = ref<any[]>([])

onMounted(loadGroupTreeData)
async function loadGroupTreeData() {
  if (!orgId.value || allGroups.value.length) return
  const [codes, { data }] = await Promise.all([
    gc.loadCodes(),
    (db.from as any)('member_groups').select('id, name, code_id').eq('org_id', orgId.value),
  ])
  allCodes.value = codes ?? []
  allGroups.value = data ?? []
}

// TEMP: the alternative — classes nested under their code heading (the
// documented "standard shape for group-selection dropdowns").
const groupedGroupOptions = computed(() => {
  const byCode: Record<string, any[]> = {}
  for (const g of allGroups.value) (byCode[g.code_id ?? '__none'] ??= []).push(g)
  const out: { label: string; items: any[] }[] = []
  for (const c of allCodes.value) {
    if (byCode[c.id]?.length) out.push({ label: c.name, items: byCode[c.id] })
  }
  if (byCode.__none?.length) out.push({ label: 'Ungrouped', items: byCode.__none })
  return out
})




// A code key covers every class beneath it, at any depth.


</script>
