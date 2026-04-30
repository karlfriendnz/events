<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold text-gray-900">Booking Discounts</h1>
        <p class="text-sm text-gray-500 mt-0.5">Rules that automatically apply savings when people book activities.</p>
      </div>
      <Button icon="pi pi-plus" label="Add Discount" size="small" @click="openNew" style="background:#1E2157; border-color:#1E2157" />
    </div>

    <!-- Empty state -->
    <div v-if="!loading && discounts.length === 0"
      class="text-center py-16 px-6 bg-white rounded-xl border-2 border-dashed border-[#1E2157]/20">
      <div class="w-16 h-16 mx-auto rounded-full bg-[#EFF6FF] flex items-center justify-center mb-4">
        <i class="pi pi-tag text-2xl text-[#1E2157]" />
      </div>
      <h3 class="text-base font-semibold text-gray-900 mb-1">Create your first discount</h3>
      <p class="text-sm text-gray-500 mb-5 max-w-sm mx-auto">
        Discounts automatically reduce prices for off-peak times, member rates, or promotions.
      </p>
      <Button label="Add Discount" icon="pi pi-plus"
        style="background:#1E2157;border-color:#1E2157" @click="openNew" />
    </div>

    <!-- Table -->
    <div v-else class="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-200 bg-gray-50 text-left">
            <th class="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
            <th class="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Discount</th>
            <th class="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Applies to</th>
            <th class="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Period</th>
            <th class="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Usage</th>
            <th class="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Active</th>
            <th class="px-4 py-2.5 w-20" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="(d, idx) in discounts" :key="d.id"
            class="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors group">
            <td class="px-4 py-3">
              <p class="font-medium text-gray-800">{{ d.name || '—' }}</p>
              <p v-if="d.form_text" class="text-xs text-gray-400 mt-0.5">{{ d.form_text }}</p>
            </td>
            <td class="px-4 py-3 whitespace-nowrap font-semibold text-[#1E2157]">
              {{ d.modifier_type === 'PERCENT' ? `${d.modifier_value}% off` : `$${d.modifier_value} off` }}
            </td>
            <td class="px-4 py-3">
              <div v-if="!d.activity_ids?.length" class="text-xs text-gray-500 italic">All activities</div>
              <div v-else class="flex flex-wrap gap-1">
                <span v-for="aid in d.activity_ids" :key="aid"
                  class="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium bg-[#1E2157]/8 text-[#1E2157]">
                  {{ activitiesById[aid]?.name ?? '—' }}
                </span>
              </div>
              <div v-if="d.mode_ids?.length" class="flex flex-wrap gap-1 mt-1">
                <span v-for="mid in d.mode_ids" :key="mid"
                  class="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">
                  {{ modesById[mid]?.name ?? '—' }}
                </span>
              </div>
              <div v-if="d.conditions?.length" class="flex flex-wrap gap-1 mt-1">
                <span v-for="(c, ci) in d.conditions" :key="ci"
                  class="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700">
                  {{ conditionLabel(c) }}
                </span>
              </div>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
              {{ periodLabel(d) }}
            </td>
            <td class="px-4 py-3 text-center text-gray-600 tabular-nums">
              <span v-if="d.max_uses">{{ d.uses_count }} / {{ d.max_uses }}</span>
              <span v-else>{{ d.uses_count }}</span>
            </td>
            <td class="px-4 py-3 text-center">
              <ToggleSwitch v-model="d.is_active" @change="toggleActive(d)" />
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                <Button icon="pi pi-pencil" text size="small" severity="secondary" @click="editDiscount(idx)" />
                <Button icon="pi pi-trash" text size="small" severity="danger" @click="deleteDiscount(idx)" />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Edit Dialog -->
    <Dialog v-model:visible="showDialog" modal style="width:760px;padding:0"
      :pt="{ header: { class: 'hidden' }, content: { class: 'p-0' }, footer: { class: 'hidden' } }"
      @hide="resetDraft">
      <div class="flex flex-col" style="max-height:88vh">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-3.5 border-b border-gray-100 shrink-0">
          <div class="flex items-center gap-2.5">
            <div class="w-7 h-7 rounded-lg bg-[#1E2157] flex items-center justify-center shrink-0">
              <i class="pi pi-tag text-white" style="font-size:11px" />
            </div>
            <h2 class="text-sm font-semibold text-gray-800">{{ editingIdx !== null ? 'Edit Discount' : 'New Discount' }}</h2>
          </div>
          <button class="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
            @click="showDialog = false; resetDraft()">
            <i class="pi pi-times text-xs" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto">
          <!-- Names -->
          <div class="px-5 py-4 grid grid-cols-2 gap-4 border-b border-gray-100">
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Name <span class="text-red-400 normal-case font-normal tracking-normal">*</span></label>
              <InputText v-model="draft.name" placeholder="e.g. April Early Bird" class="w-full text-sm h-9" autofocus />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Form label</label>
              <InputText v-model="draft.form_text" placeholder="Shown on the booking form" class="w-full text-sm h-9" />
            </div>
          </div>

          <!-- Amount -->
          <div class="px-5 py-4 border-b border-gray-100 bg-gray-50">
            <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Discount amount</p>
            <div class="rounded-lg border border-gray-200 overflow-hidden bg-white">
              <div class="grid" style="grid-template-columns: auto 140px 1fr">
                <div class="flex border-r border-gray-200">
                  <button v-for="t in typeOptions" :key="t.value" type="button"
                    class="px-5 py-2.5 text-sm font-semibold transition-all border-r border-gray-200 last:border-r-0"
                    :class="draft.modifier_type === t.value ? 'bg-[#1E2157] text-white' : 'text-gray-500 hover:bg-gray-50'"
                    @click="draft.modifier_type = t.value">{{ t.label }}</button>
                </div>
                <div class="relative flex items-center border-r border-gray-200">
                  <span v-if="draft.modifier_type === 'FLAT'" class="absolute left-3 text-gray-400 text-sm pointer-events-none">$</span>
                  <InputNumber v-model="draft.modifier_value" placeholder="0" :min="0"
                    :max="draft.modifier_type === 'PERCENT' ? 100 : undefined"
                    :suffix="draft.modifier_type === 'PERCENT' ? '%' : ''"
                    inputClass="h-10 text-sm font-semibold text-center w-full border-0 shadow-none rounded-none"
                    :class="draft.modifier_type === 'FLAT' ? 'pl-5' : ''"
                    :pt="{ root: { class: 'w-full' }, input: { style: 'border:none; box-shadow:none; border-radius:0' } }" />
                </div>
                <div class="flex items-center px-3 gap-2">
                  <span class="text-xs text-gray-400 shrink-0 font-medium">applied to</span>
                  <Select v-model="draft.apply_to" :options="applyToOptions" option-label="label" option-value="value"
                    class="flex-1 text-sm"
                    :pt="{ root: { style: 'border:none; box-shadow:none; background:transparent' } }" />
                </div>
              </div>
            </div>
          </div>

          <!-- Activities & modes tree -->
          <div class="px-5 py-4 border-b border-gray-100">
            <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Applies to</p>
            <TreeSelect
              v-model="treeSelection"
              :options="activityTree"
              selection-mode="checkbox"
              placeholder="All activities (leave empty)"
              display="chip"
              class="w-full text-sm"
              :metaKeySelection="false" />
            <p class="text-xs text-gray-400 mt-2">Check an activity to apply to every mode in it, or expand to pick specific modes. Leave empty to apply to everything.</p>
          </div>

          <!-- Conditions -->
          <div class="px-5 py-4 border-b border-gray-100">
            <div class="flex items-center justify-between mb-3">
              <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide">Criteria</p>
              <span v-if="draft.conditions.length > 1"
                class="text-xs font-semibold text-[#1E2157] bg-[#1E2157]/10 px-2.5 py-1 rounded-full">
                All must be met
              </span>
            </div>

            <div v-if="draft.conditions.length" class="rounded-lg border border-gray-200 overflow-hidden mb-3">
              <div class="grid bg-gray-50 border-b border-gray-200 px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide"
                style="grid-template-columns: 230px 170px 1fr 32px">
                <span class="pl-1">Criterion</span>
                <span>Operator</span>
                <span>Value</span>
                <span />
              </div>
              <div v-for="(cond, i) in draft.conditions" :key="i"
                class="grid items-center px-3 border-b border-gray-100 last:border-0 group hover:bg-gray-50/60 transition-colors"
                style="grid-template-columns: 230px 170px 1fr 32px">
                <div class="py-2 pr-2">
                  <Select :modelValue="cond.key" :options="conditionTypeGroups"
                    optionLabel="label" optionValue="key" optionGroupLabel="label" optionGroupChildren="items"
                    placeholder="Choose…" class="w-full text-sm"
                    :pt="{ root: { style: 'border:none; box-shadow:none; background:transparent; padding:0' } }"
                    @update:modelValue="v => onConditionKeyChange(cond, v)" />
                </div>
                <div class="py-2 pr-2 border-l border-gray-100">
                  <template v-if="cond.key && condValueType(cond.key) === 'boolean'">
                    <div class="flex rounded-md border border-gray-200 overflow-hidden text-xs font-semibold bg-white">
                      <button type="button" class="flex-1 py-1.5 border-r border-gray-200 transition-all"
                        :class="cond.operator === 'is_true' ? 'bg-[#1E2157] text-white' : 'text-gray-500 hover:bg-gray-50'"
                        @click="cond.operator = 'is_true'">Yes</button>
                      <button type="button" class="flex-1 py-1.5 transition-all"
                        :class="cond.operator === 'is_false' ? 'bg-[#1E2157] text-white' : 'text-gray-500 hover:bg-gray-50'"
                        @click="cond.operator = 'is_false'">No</button>
                    </div>
                  </template>
                  <Select v-else-if="cond.key" v-model="cond.operator" :options="condOperatorOptions(cond.key)"
                    optionLabel="label" optionValue="value" class="w-full text-sm"
                    :pt="{ root: { style: 'border:none; box-shadow:none; background:transparent; padding:0' } }" />
                  <div v-else class="h-9" />
                </div>
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
                    <MultiSelect v-else-if="condValueType(cond.key) === 'groups'"
                      v-model="cond.value" :options="memberGroups" optionLabel="name" optionValue="id"
                      placeholder="Pick groups…" class="w-full text-sm" display="chip" />
                    <MultiSelect v-else-if="condValueType(cond.key) === 'enum'"
                      v-model="cond.value" :options="conditionGenderOptions(cond.key)" optionLabel="label" optionValue="value"
                      placeholder="Pick…" class="w-full text-sm" display="chip" />
                    <InputText v-else-if="condValueType(cond.key) === 'string'"
                      v-model="cond.value" placeholder="e.g. 2000" class="w-full text-sm h-9 px-3" />
                  </template>
                  <div v-else class="h-9" />
                </div>
                <div class="flex justify-center border-l border-gray-100">
                  <button class="w-7 h-7 flex items-center justify-center rounded-md text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                    @click="draft.conditions.splice(i, 1)">
                    <i class="pi pi-times text-xs" />
                  </button>
                </div>
              </div>
            </div>

            <button type="button"
              class="w-full flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-[#1E2157] border border-dashed border-gray-200 hover:border-[#1E2157]/30 hover:bg-[#1E2157]/[0.02] rounded-lg py-2.5 transition-all"
              @click="addCondition">
              <i class="pi pi-plus text-xs" /> Add criterion
            </button>
          </div>

          <!-- Period & usage -->
          <div class="px-5 py-4 border-b border-gray-100 bg-gray-50">
            <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Validity &amp; usage</p>
            <div class="grid grid-cols-3 gap-4">
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Valid from</label>
                <DatePicker v-model="draft.valid_from" show-icon date-format="dd/mm/yy" placeholder="Always" show-button-bar class="w-full" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Valid until</label>
                <DatePicker v-model="draft.valid_until" show-icon date-format="dd/mm/yy" placeholder="No end date" show-button-bar class="w-full" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Max uses</label>
                <InputNumber v-model="draft.max_uses" :min="1" placeholder="Unlimited" class="w-full" />
              </div>
            </div>
            <p class="text-xs text-gray-400 mt-3">
              <i class="pi pi-info-circle mr-1" />
              First-come, first-served. Once the cap is reached the discount stops applying.
            </p>
          </div>

          <!-- Active -->
          <div class="px-5 py-3.5 flex items-center justify-between">
            <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              <ToggleSwitch v-model="draft.is_active" />
              Enabled
            </label>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-gray-100 shrink-0">
          <Button label="Cancel" severity="secondary" outlined size="small" @click="showDialog = false; resetDraft()" />
          <Button :label="editingIdx !== null ? 'Save Changes' : 'Create Discount'" size="small"
            :disabled="!draft.name.trim()" :loading="saving"
            @click="saveDraft" style="background:#1E2157; border-color:#1E2157" />
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'

const db = useDb()
const toast = useToast()
const { orgId } = useOrg()

type Condition = {
  key: string
  operator: string
  value: any
}

type Discount = {
  id: string
  name: string
  form_text: string | null
  modifier_type: 'PERCENT' | 'FLAT'
  modifier_value: number
  apply_to: 'BOOKING' | 'ADDONS' | 'BOOKING_AND_ADDONS'
  activity_ids: string[]
  mode_ids: string[]
  conditions: Condition[]
  valid_from: string | null
  valid_until: string | null
  max_uses: number | null
  uses_count: number
  is_active: boolean
}

const discounts = ref<Discount[]>([])
const activities = ref<{ id: string; name: string }[]>([])
const modes = ref<{ id: string; name: string; activity_id: string; activity_name: string }[]>([])
const memberGroups = ref<{ id: string; name: string }[]>([])
const activitiesById = computed(() => Object.fromEntries(activities.value.map(a => [a.id, a])))
const modesById = computed(() => Object.fromEntries(modes.value.map(m => [m.id, m])))

const activityTree = computed(() =>
  activities.value.map(act => {
    const children = modes.value
      .filter(m => m.activity_id === act.id)
      .map(m => ({ key: m.id, label: m.name, data: { type: 'mode', activityId: act.id } }))
    return {
      key: `act-${act.id}`,
      label: act.name,
      data: { type: 'activity', activityId: act.id },
      ...(children.length ? { children } : {}),
    }
  })
)

const treeSelection = computed({
  get: () => {
    const sel: Record<string, any> = {}
    const selectedActs = new Set(draft.activity_ids)
    const selectedModes = new Set(draft.mode_ids)
    for (const node of activityTree.value) {
      const isActSelected = selectedActs.has((node.data as any).activityId)
      if (!node.children?.length) {
        if (isActSelected) sel[node.key] = { checked: true, partialChecked: false }
        continue
      }
      const childChecked = node.children.filter(c => isActSelected || selectedModes.has(c.key as string))
      if (isActSelected) {
        for (const c of node.children) sel[c.key as string] = { checked: true, partialChecked: false }
        sel[node.key] = { checked: true, partialChecked: false }
      } else if (childChecked.length) {
        for (const c of childChecked) sel[c.key as string] = { checked: true, partialChecked: false }
        sel[node.key] = { checked: false, partialChecked: true }
      }
    }
    return sel
  },
  set: (val: Record<string, any>) => {
    const actIds: string[] = []
    const modeIds: string[] = []
    for (const node of activityTree.value) {
      const actKey = node.key as string
      const actChecked = val[actKey]?.checked
      const actPartial = val[actKey]?.partialChecked
      if (!node.children?.length) {
        if (actChecked) actIds.push((node.data as any).activityId)
        continue
      }
      if (actChecked && !actPartial) {
        actIds.push((node.data as any).activityId)
      } else if (actPartial) {
        for (const c of node.children) {
          if (val[c.key as string]?.checked) modeIds.push(c.key as string)
        }
      }
    }
    draft.activity_ids = actIds
    draft.mode_ids = modeIds
  },
})
const loading = ref(true)
const saving = ref(false)

const showDialog = ref(false)
const editingIdx = ref<number | null>(null)

const typeOptions = [
  { label: 'Percent', value: 'PERCENT' },
  { label: 'Flat', value: 'FLAT' },
]

const applyToOptions = [
  { label: 'Booking', value: 'BOOKING' },
  { label: 'Add-ons', value: 'ADDONS' },
  { label: 'Booking + Add-ons', value: 'BOOKING_AND_ADDONS' },
]

function blankDraft() {
  return {
    name: '',
    form_text: '',
    modifier_type: 'PERCENT' as 'PERCENT' | 'FLAT',
    modifier_value: 10,
    apply_to: 'BOOKING' as 'BOOKING' | 'ADDONS' | 'BOOKING_AND_ADDONS',
    activity_ids: [] as string[],
    mode_ids: [] as string[],
    conditions: [] as Condition[],
    valid_from: null as Date | null,
    valid_until: null as Date | null,
    max_uses: null as number | null,
    is_active: true,
  }
}

const conditionTypes = [
  // Booking-shaped
  { key: 'booking_day_of_week', label: 'Booking day of week',   valueType: 'days',     operators: ['is_in'],  group: 'Booking' },
  { key: 'advance_days',        label: 'Booked in advance by',  valueType: 'number',   operators: ['gte', 'lte'], group: 'Booking' },
  { key: 'booking_hour',        label: 'Booking start hour',    valueType: 'number',   operators: ['gte', 'lte', 'between'], group: 'Booking' },
  { key: 'duration_mins',       label: 'Duration (minutes)',    valueType: 'number',   operators: ['gte', 'lte'], group: 'Booking' },
  { key: 'attendee_count',      label: 'Attendee count',        valueType: 'number',   operators: ['gte', 'lte', 'eq'], group: 'Booking' },
  { key: 'min_total',           label: 'Minimum booking total', valueType: 'currency', operators: ['gte'], group: 'Booking' },
  // Person-shaped
  { key: 'age',                 label: 'Age',                    valueType: 'number',   operators: ['gte', 'lte', 'between'], group: 'Person' },
  { key: 'gender',              label: 'Gender',                 valueType: 'enum',     operators: ['is_in'], group: 'Person',
    options: [
      { label: 'Male',               value: 'MALE' },
      { label: 'Female',             value: 'FEMALE' },
      { label: 'Non-binary',         value: 'NON_BINARY' },
      { label: 'Prefer not to say',  value: 'UNSPECIFIED' },
    ] },
  { key: 'is_member',           label: 'Member?',                valueType: 'boolean',  operators: ['is_true', 'is_false'], group: 'Person' },
  { key: 'member_years',        label: 'Years as a member',      valueType: 'number',   operators: ['gte', 'lte'], group: 'Person' },
  { key: 'member_group',        label: 'Member group',           valueType: 'groups',   operators: ['is_in'], group: 'Person' },
  { key: 'postcode',            label: 'Postcode',               valueType: 'string',   operators: ['eq', 'is_in'], group: 'Person' },
]

const conditionTypeGroups = computed(() => {
  const groups: Record<string, typeof conditionTypes> = {}
  for (const c of conditionTypes) (groups[c.group] ??= [] as any).push(c)
  return Object.entries(groups).map(([label, items]) => ({ label, items }))
})

const operatorLabels: Record<string, string> = {
  gte: '≥',
  lte: '≤',
  eq: '=',
  between: 'between',
  is_in: 'is one of',
  is_true: 'yes',
  is_false: 'no',
}

function conditionGenderOptions(key: string) {
  return (conditionTypes.find(c => c.key === key) as any)?.options ?? []
}

const daysOfWeek = [
  { label: 'Mon', value: 1 }, { label: 'Tue', value: 2 }, { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 }, { label: 'Fri', value: 5 }, { label: 'Sat', value: 6 },
  { label: 'Sun', value: 0 },
]

function condValueType(key: string) {
  return conditionTypes.find(c => c.key === key)?.valueType ?? 'string'
}

function condOperatorOptions(key: string) {
  const ops = conditionTypes.find(c => c.key === key)?.operators ?? []
  return ops.map(o => ({ label: operatorLabels[o] ?? o, value: o }))
}

function onConditionKeyChange(cond: Condition, key: string) {
  cond.key = key
  const type = condValueType(key)
  const ops = conditionTypes.find(c => c.key === key)?.operators ?? []
  cond.operator = ops[0] ?? ''
  if (type === 'days' || type === 'groups' || type === 'enum') cond.value = []
  else if (type === 'string') cond.value = ''
  else cond.value = null
}

function addCondition() {
  draft.conditions.push({ key: '', operator: '', value: null })
}

function conditionLabel(c: Condition): string {
  const type = conditionTypes.find(ct => ct.key === c.key) as any
  if (!type) return '—'
  const op = operatorLabels[c.operator] ?? c.operator
  if (type.valueType === 'boolean') return `${type.label}: ${c.operator === 'is_true' ? 'Yes' : 'No'}`
  if (type.valueType === 'days') {
    const names = (c.value ?? []).map((v: number) => daysOfWeek.find(d => d.value === v)?.label).filter(Boolean).join(', ')
    return `${type.label} ${op} ${names || '—'}`
  }
  if (type.valueType === 'groups') {
    const names = (c.value ?? []).map((v: string) => memberGroups.value.find(g => g.id === v)?.name).filter(Boolean).join(', ')
    return `${type.label} ${op} ${names || '—'}`
  }
  if (type.valueType === 'enum') {
    const names = (c.value ?? []).map((v: string) => type.options?.find((o: any) => o.value === v)?.label).filter(Boolean).join(', ')
    return `${type.label} ${op} ${names || '—'}`
  }
  return `${type.label} ${op} ${c.value ?? '—'}`
}


const draft = reactive(blankDraft())

function resetDraft() {
  Object.assign(draft, blankDraft())
  editingIdx.value = null
}

function openNew() {
  resetDraft()
  showDialog.value = true
}

function editDiscount(idx: number) {
  const d = discounts.value[idx]
  editingIdx.value = idx
  draft.name = d.name
  draft.form_text = d.form_text ?? ''
  draft.modifier_type = d.modifier_type
  draft.modifier_value = d.modifier_value
  draft.apply_to = d.apply_to
  draft.activity_ids = [...(d.activity_ids ?? [])]
  draft.mode_ids = [...(d.mode_ids ?? [])]
  draft.conditions = (d.conditions ?? []).map(c => ({ ...c, value: Array.isArray(c.value) ? [...c.value] : c.value }))
  draft.valid_from = d.valid_from ? new Date(d.valid_from) : null
  draft.valid_until = d.valid_until ? new Date(d.valid_until) : null
  draft.max_uses = d.max_uses
  draft.is_active = d.is_active
  showDialog.value = true
}

function periodLabel(d: Discount) {
  const fmt = (iso: string | null) => {
    if (!iso) return null
    const dt = new Date(iso)
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  }
  const from = fmt(d.valid_from)
  const until = fmt(d.valid_until)
  if (!from && !until) return 'Always'
  if (from && until) return `${from} – ${until}`
  if (from) return `From ${from}`
  return `Until ${until}`
}

async function saveDraft() {
  if (!draft.name.trim()) return
  saving.value = true
  try {
    const cleanConditions = draft.conditions.filter(c => c.key && c.operator)
    const payload = {
      org_id: orgId.value,
      name: draft.name.trim(),
      form_text: draft.form_text.trim() || null,
      modifier_type: draft.modifier_type,
      modifier_value: draft.modifier_value ?? 0,
      apply_to: draft.apply_to,
      conditions: cleanConditions,
      valid_from: draft.valid_from ? draft.valid_from.toISOString() : null,
      valid_until: draft.valid_until ? draft.valid_until.toISOString() : null,
      max_uses: draft.max_uses,
      is_active: draft.is_active,
    }

    let discountId: string
    if (editingIdx.value !== null) {
      const existing = discounts.value[editingIdx.value]
      discountId = existing.id
      const { error } = await (db.from as any)('booking_discounts').update(payload).eq('id', discountId)
      if (error) throw error
      await (db.from as any)('booking_discount_activities').delete().eq('discount_id', discountId)
      await (db.from as any)('booking_discount_activity_modes').delete().eq('discount_id', discountId)
    } else {
      const { data, error } = await (db.from as any)('booking_discounts').insert(payload).select('id').single()
      if (error) throw error
      discountId = data.id
    }

    if (draft.activity_ids.length) {
      const rows = draft.activity_ids.map(activity_id => ({ discount_id: discountId, activity_id }))
      const { error } = await (db.from as any)('booking_discount_activities').insert(rows)
      if (error) throw error
    }

    if (draft.mode_ids.length) {
      const rows = draft.mode_ids.map(activity_mode_id => ({ discount_id: discountId, activity_mode_id }))
      const { error } = await (db.from as any)('booking_discount_activity_modes').insert(rows)
      if (error) throw error
    }

    toast.add({ severity: 'success', summary: editingIdx.value !== null ? 'Discount updated' : 'Discount created', life: 2500 })
    showDialog.value = false
    resetDraft()
    await load()
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Could not save', detail: e?.message, life: 4000 })
  } finally {
    saving.value = false
  }
}

async function toggleActive(d: Discount) {
  const { error } = await (db.from as any)('booking_discounts').update({ is_active: d.is_active }).eq('id', d.id)
  if (error) {
    d.is_active = !d.is_active
    toast.add({ severity: 'error', summary: 'Could not update', detail: error.message, life: 3000 })
  }
}

async function deleteDiscount(idx: number) {
  const d = discounts.value[idx]
  if (!confirm(`Delete discount "${d.name}"?`)) return
  const { error } = await (db.from as any)('booking_discounts').delete().eq('id', d.id)
  if (error) {
    toast.add({ severity: 'error', summary: 'Could not delete', detail: error.message, life: 3000 })
    return
  }
  discounts.value.splice(idx, 1)
}

async function load() {
  loading.value = true
  const [discRes, actRes, modeRes, grpRes, actLinkRes, modeLinkRes] = await Promise.all([
    (db.from as any)('booking_discounts').select('*').eq('org_id', orgId.value).order('created_at', { ascending: false }),
    (db.from as any)('activities').select('id, name').eq('org_id', orgId.value).order('name'),
    (db.from as any)('activity_modes').select('id, name, activity_id, activities!inner(name, org_id)').eq('activities.org_id', orgId.value).order('name'),
    (db.from as any)('member_groups').select('id, name').eq('org_id', orgId.value).order('name'),
    (db.from as any)('booking_discount_activities').select('discount_id, activity_id'),
    (db.from as any)('booking_discount_activity_modes').select('discount_id, activity_mode_id'),
  ])
  activities.value = actRes.data ?? []
  modes.value = (modeRes.data ?? []).map((m: any) => ({
    id: m.id, name: m.name, activity_id: m.activity_id, activity_name: m.activities?.name ?? '',
  }))
  memberGroups.value = grpRes.data ?? []
  const actsByDiscount: Record<string, string[]> = {}
  for (const link of (actLinkRes.data ?? [])) {
    (actsByDiscount[link.discount_id] ??= []).push(link.activity_id)
  }
  const modesByDiscount: Record<string, string[]> = {}
  for (const link of (modeLinkRes.data ?? [])) {
    (modesByDiscount[link.discount_id] ??= []).push(link.activity_mode_id)
  }
  discounts.value = (discRes.data ?? []).map((d: any) => ({
    ...d,
    activity_ids: actsByDiscount[d.id] ?? [],
    mode_ids: modesByDiscount[d.id] ?? [],
    conditions: d.conditions ?? [],
  }))
  loading.value = false
}

watch(orgId, (id) => { if (id) load() }, { immediate: true })
</script>
