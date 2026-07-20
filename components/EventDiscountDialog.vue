<script setup lang="ts">
/**
 * The event-discount modal — template picker → rule editor — shared by the
 * advanced event editor (pages/events/[id].vue) and the basic-event wizard
 * (pages/events/new-basic.vue). Owns NO persistence: it emits the built draft
 * on save and lets the host write the DB row (immediately, or deferred to the
 * wizard's final save). Condition vocabulary lives in useEventDiscounts().
 */
import { useEventDiscounts, makeDiscountDraft, type DiscountDraft } from '~/composables/useEventDiscounts'

const props = withDefaults(defineProps<{
  visible: boolean
  /** An existing discount draft to edit; null/omitted = start from the template picker. */
  edit?: DiscountDraft | null
  currencySymbol?: string
}>(), { edit: null, currencySymbol: '$' })

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'save', draft: DiscountDraft): void
}>()

const {
  DISCOUNT_TYPES, APPLY_TO_OPTIONS, DISCOUNT_TEMPLATES,
  conditionTypeOptions, getOperatorOptions, getValueType, getConditionOptions,
  onConditionKeyChange,
} = useEventDiscounts()

const showPicker = ref(false)
const showRule = ref(false)
const isEditing = ref(false)
const draft = reactive<DiscountDraft>(makeDiscountDraft())

function setDraft(next: DiscountDraft) {
  Object.assign(draft, JSON.parse(JSON.stringify(next)))
}

// Opening the flow: an `edit` jumps straight to the rule editor; otherwise the
// template picker leads.
watch(() => props.visible, (open) => {
  if (open) {
    if (props.edit) {
      isEditing.value = true
      setDraft({ ...makeDiscountDraft(), ...props.edit })
      showRule.value = true
      showPicker.value = false
    } else {
      isEditing.value = false
      Object.assign(draft, makeDiscountDraft())
      showPicker.value = true
      showRule.value = false
    }
  } else {
    showPicker.value = false
    showRule.value = false
  }
}, { immediate: true })

function close() {
  showPicker.value = false
  showRule.value = false
  Object.assign(draft, makeDiscountDraft())
  isEditing.value = false
  emit('update:visible', false)
}

function openWithTemplate(preset: any) {
  Object.assign(draft, makeDiscountDraft())
  Object.assign(draft, {
    name: preset.name, form_text: preset.form_text,
    modifier_value: preset.modifier_value, modifier_type: preset.modifier_type,
    apply_to: preset.apply_to,
    conditions: JSON.parse(JSON.stringify(preset.conditions)),
  })
  showPicker.value = false
  showRule.value = true
}

function openBlank() {
  Object.assign(draft, makeDiscountDraft())
  showPicker.value = false
  showRule.value = true
}

function addCondition() {
  draft.conditions.push({ key: null, operator: null, value: null })
}

// Options for the compound "Booked within a period" condition.
const PERIOD_UNITS = [{ label: 'sessions', value: 'sessions' }, { label: 'full days', value: 'days' }]
const PERIOD_WINDOWS = [{ label: 'a rolling number of days', value: 'rolling' }, { label: 'a set date range', value: 'range' }]
function ensurePeriod(cond: any) {
  if (!cond.value || typeof cond.value !== 'object') cond.value = { count: null, unit: 'sessions', window: 'rolling', windowDays: null, from: null, to: null }
  return cond.value
}

function save() {
  if (!draft.name) return
  emit('save', JSON.parse(JSON.stringify(draft)))
  close()
}
</script>

<template>
  <!-- Template picker -->
  <Dialog :visible="showPicker" @update:visible="v => { if (!v) close() }" header="Add Discount" modal :style="{ width: '95vw', maxWidth: '560px' }">
    <div class="py-1 space-y-4">
      <p class="text-sm text-gray-500">Start from a template or build your own from scratch.</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button v-for="tpl in DISCOUNT_TEMPLATES" :key="tpl.label"
          class="text-left rounded-xl border border-gray-200 hover:border-primary hover:bg-primary/5 transition-all px-4 py-3.5 group"
          @click="openWithTemplate(tpl.preset)">
          <div class="flex items-center gap-2.5 mb-1.5">
            <div class="w-7 h-7 rounded-lg bg-primary/10 group-hover:bg-primary/15 flex items-center justify-center shrink-0 transition-colors">
              <i class="pi text-primary text-sm" :class="tpl.icon" />
            </div>
            <span class="text-sm font-semibold text-gray-800">{{ tpl.label }}</span>
          </div>
          <p class="text-xs text-gray-500 leading-relaxed">{{ tpl.description }}</p>
        </button>
      </div>
      <!-- Build a custom rule from a blank draft (skip the templates). -->
      <button class="w-full text-left rounded-xl border border-dashed border-gray-300 hover:border-primary hover:text-primary hover:bg-primary/[0.02] px-4 py-3 flex items-center gap-3 text-sm text-gray-500 transition-colors"
        @click="openBlank">
        <i class="pi pi-plus-circle" />
        Create custom discount
      </button>
    </div>
  </Dialog>

  <!-- Rule editor -->
  <Dialog :visible="showRule" @update:visible="v => { if (!v) close() }" modal :style="{ width: '95vw', maxWidth: '860px', padding: '0' }" :pt="{ header: { class: 'hidden' }, content: { class: 'p-0' }, footer: { class: 'hidden' } }">
    <div class="flex flex-col" style="max-height:88vh">

      <!-- Custom header -->
      <div class="flex items-center justify-between px-6 py-3.5 border-b border-gray-100 shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <i class="pi pi-tag text-white" style="font-size:11px" />
          </div>
          <h2 class="text-sm font-semibold text-gray-800">{{ isEditing ? 'Edit Discount Rule' : 'New Discount Rule' }}</h2>
        </div>
        <button class="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all" @click="close">
          <i class="pi pi-times text-xs" />
        </button>
      </div>

      <!-- Scrollable body -->
      <div class="flex-1 overflow-y-auto p-4">
       <div class="rounded-xl border border-gray-200 overflow-hidden">

        <!-- Names row -->
        <div class="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-gray-100">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Name <span class="text-red-400 normal-case font-normal tracking-normal">*</span></label>
            <InputText v-model="draft.name" placeholder="e.g. Family Deal" class="w-full text-sm h-9" autofocus />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Form label</label>
            <InputText v-model="draft.form_text" placeholder="What registrants see on the form" class="w-full text-sm h-9" />
          </div>
        </div>

        <!-- Amount section -->
        <div class="px-5 py-4 border-b border-gray-100 bg-gray-50 space-y-3">
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide">Discount</p>

          <!-- Discount type -->
          <div class="grid grid-cols-2 gap-4 items-center">
            <label class="text-sm font-medium text-gray-700">Discount type</label>
            <div class="flex w-full h-10 rounded-lg border border-gray-200 overflow-hidden bg-white">
              <button v-for="ty in DISCOUNT_TYPES" :key="ty.value" type="button"
                class="flex-1 text-sm font-semibold transition-all border-r border-gray-200 last:border-r-0"
                :class="draft.modifier_type === ty.value ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-50'"
                @click="draft.modifier_type = ty.value as any">{{ ty.label }}</button>
            </div>
          </div>

          <!-- Amount -->
          <div class="grid grid-cols-2 gap-4 items-center">
            <label class="text-sm font-medium text-gray-700">Amount</label>
            <div class="relative w-full">
              <span v-if="draft.modifier_type === 'FLAT' || draft.modifier_type === 'REPLACE'" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none z-10">{{ currencySymbol }}</span>
              <InputNumber v-model="draft.modifier_value" placeholder="0" :min="0"
                :max="draft.modifier_type === 'PERCENT' ? 100 : undefined"
                :suffix="draft.modifier_type === 'PERCENT' ? '%' : ''"
                class="w-full"
                :input-class="draft.modifier_type === 'FLAT' || draft.modifier_type === 'REPLACE' ? 'h-10 text-sm w-full !pl-6' : 'h-10 text-sm w-full'" />
            </div>
          </div>

          <!-- Applied to -->
          <div class="grid grid-cols-2 gap-4 items-center">
            <label class="text-sm font-medium text-gray-700">Applied to</label>
            <Select v-model="draft.apply_to" :options="APPLY_TO_OPTIONS" option-label="label" option-value="value" class="w-full text-sm" />
          </div>
        </div>

        <!-- Conditions section -->
        <div class="px-5 py-4 border-b border-gray-100">
          <div class="flex items-center justify-between mb-3">
            <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide">Conditions</p>
            <span v-if="draft.conditions.length > 1"
              class="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
              All must be met
            </span>
          </div>

          <div v-if="draft.conditions.length" class="rounded-lg border border-gray-200 overflow-hidden mb-3">
            <!-- Column headers -->
            <div class="grid bg-gray-50 border-b border-gray-200 px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide"
              style="grid-template-columns: 300px 190px 200px 32px">
              <span class="pl-1">Condition</span>
              <span>Operator</span>
              <span>Value</span>
              <span />
            </div>

            <div v-for="(cond, i) in draft.conditions" :key="i"
              class="grid items-center px-3 border-b border-gray-100 last:border-0 group hover:bg-gray-50/60 transition-colors"
              style="grid-template-columns: 300px 190px 200px 32px">

              <!-- Condition selector -->
              <div class="py-2 pr-2">
                <Select
                  :modelValue="cond.key"
                  :options="conditionTypeOptions"
                  optionLabel="label"
                  optionValue="key"
                  placeholder="Choose condition…"
                  class="w-full text-sm"
                  :pt="{ root: { style: 'border: none; box-shadow: none; background: transparent; padding: 0' } }"
                  @update:modelValue="v => onConditionKeyChange(cond, v)" />
              </div>

              <!-- Compound "within a period" spans the operator + value columns -->
              <div v-if="cond.key && getValueType(cond.key) === 'period'"
                class="py-2 pr-2 pl-3 border-l border-gray-100 flex flex-wrap items-center gap-1.5 text-sm text-gray-600"
                style="grid-column: 2 / 4">
                <InputNumber :modelValue="cond.value?.count" @update:modelValue="v => ensurePeriod(cond).count = v"
                  :min="1" placeholder="0" inputClass="h-8 text-sm w-14 text-center px-1" class="shrink-0" />
                <Select :modelValue="cond.value?.unit" @update:modelValue="v => ensurePeriod(cond).unit = v"
                  :options="PERIOD_UNITS" optionLabel="label" optionValue="value" class="text-sm shrink-0"
                  :pt="{ root: { style: 'border: none; box-shadow: none; background: transparent; padding: 0' } }" />
                <span class="shrink-0">within</span>
                <Select :modelValue="cond.value?.window" @update:modelValue="v => ensurePeriod(cond).window = v"
                  :options="PERIOD_WINDOWS" optionLabel="label" optionValue="value" class="text-sm shrink-0"
                  :pt="{ root: { style: 'border: none; box-shadow: none; background: transparent; padding: 0' } }" />
                <template v-if="cond.value?.window !== 'range'">
                  <InputNumber :modelValue="cond.value?.windowDays" @update:modelValue="v => ensurePeriod(cond).windowDays = v"
                    :min="1" placeholder="0" inputClass="h-8 text-sm w-14 text-center px-1" class="shrink-0" />
                  <span class="shrink-0">days</span>
                </template>
                <template v-else>
                  <DatePicker :modelValue="cond.value?.from" @update:modelValue="v => ensurePeriod(cond).from = v"
                    dateFormat="dd/mm/yy" placeholder="From" inputClass="h-8 text-sm px-2 w-24" class="shrink-0" />
                  <span class="shrink-0">–</span>
                  <DatePicker :modelValue="cond.value?.to" @update:modelValue="v => ensurePeriod(cond).to = v"
                    dateFormat="dd/mm/yy" placeholder="To" inputClass="h-8 text-sm px-2 w-24" class="shrink-0" />
                </template>
              </div>

              <!-- Operator -->
              <div v-if="!(cond.key && getValueType(cond.key) === 'period')" class="py-2 pr-2 border-l border-gray-100">
                <template v-if="cond.key && getValueType(cond.key) === 'boolean'">
                  <div class="flex rounded-md border border-gray-200 overflow-hidden text-xs font-semibold bg-white">
                    <button type="button" class="flex-1 py-1.5 border-r border-gray-200 transition-all"
                      :class="cond.operator === 'is_true' ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-50'"
                      @click="cond.operator = 'is_true'">Yes</button>
                    <button type="button" class="flex-1 py-1.5 transition-all"
                      :class="cond.operator === 'is_false' ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-50'"
                      @click="cond.operator = 'is_false'">No</button>
                  </div>
                </template>
                <Select v-else-if="cond.key" v-model="cond.operator" :options="getOperatorOptions(cond.key)"
                  optionLabel="label" optionValue="value" class="w-full text-sm"
                  :pt="{ root: { style: 'border: none; box-shadow: none; background: transparent; padding: 0' } }" />
                <div v-else class="h-9" />
              </div>

              <!-- Value -->
              <div v-if="!(cond.key && getValueType(cond.key) === 'period')" class="py-2 pr-2 pl-2 border-l border-gray-100">
                <template v-if="cond.key && getValueType(cond.key) !== 'boolean'">
                  <!-- number: full width -->
                  <InputNumber v-if="getValueType(cond.key) === 'number'"
                    v-model="cond.value" :min="0" inputClass="h-9 text-sm w-full px-3" class="w-full"
                    :pt="{ root: { class: 'w-full' } }" />

                  <!-- currency -->
                  <div v-else-if="getValueType(cond.key) === 'currency'" class="flex items-center gap-1.5">
                    <span class="text-sm text-gray-400 shrink-0">{{ currencySymbol }}</span>
                    <InputNumber v-model="cond.value" :min="0" :minFractionDigits="2" :maxFractionDigits="2"
                      inputClass="h-9 text-sm w-full px-3" class="flex-1" :pt="{ root: { class: 'flex-1' } }" />
                  </div>

                  <!-- range -->
                  <div v-else-if="getValueType(cond.key) === 'range'" class="flex items-center gap-1.5">
                    <InputNumber :modelValue="cond.value?.min"
                      @update:modelValue="v => { if (!cond.value) cond.value = {}; cond.value.min = v }"
                      :min="0" placeholder="Min" inputClass="h-9 text-sm text-center w-full px-2" class="flex-1" />
                    <span class="text-gray-300 text-sm shrink-0">–</span>
                    <InputNumber :modelValue="cond.value?.max"
                      @update:modelValue="v => { if (!cond.value) cond.value = {}; cond.value.max = v }"
                      :min="0" placeholder="Max" inputClass="h-9 text-sm text-center w-full px-2" class="flex-1" />
                  </div>

                  <!-- datetime: full width -->
                  <DatePicker v-else-if="getValueType(cond.key) === 'datetime'"
                    v-model="cond.value" showTime hourFormat="12" dateFormat="dd/mm/yy"
                    inputClass="h-9 text-sm px-3 w-full" class="w-full" />

                  <!-- string -->
                  <InputText v-else-if="getValueType(cond.key) === 'string'"
                    v-model="cond.value" placeholder="e.g. SAVE20" class="w-full font-mono text-sm h-9 px-3" />

                  <!-- enum -->
                  <Select v-else-if="getValueType(cond.key) === 'enum'"
                    v-model="cond.value" :options="getConditionOptions(cond.key)" class="w-full text-sm"
                    :pt="{ root: { style: 'border: none; box-shadow: none; background: transparent; padding: 0' } }" />

                  <!-- array -->
                  <MultiSelect v-else-if="getValueType(cond.key) === 'array'"
                    v-model="cond.value" :options="getConditionOptions(cond.key)"
                    placeholder="Select…" class="w-full text-sm" />
                </template>
                <div v-else class="h-9" />
              </div>

              <!-- Delete -->
              <div class="flex justify-center border-l border-gray-100">
                <button class="w-7 h-7 flex items-center justify-center rounded-md text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                  @click="draft.conditions.splice(i, 1)">
                  <i class="pi pi-times text-xs" />
                </button>
              </div>
            </div>
          </div>

          <button type="button"
            class="w-full flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-primary border border-dashed border-gray-200 hover:border-primary/30 hover:bg-primary/[0.02] rounded-lg py-2.5 transition-all"
            @click="addCondition">
            <i class="pi pi-plus text-xs" /> Add condition
          </button>
        </div>

        <!-- Valid window -->
        <div class="px-5 py-4 border-b border-gray-100 bg-gray-50">
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Validity window</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Active from</label>
              <Select v-model="draft.valid_from_type"
                :options="[{label:'Immediately (once saved)', value:'now'},{label:'Specific date…', value:'custom'}]"
                option-label="label" option-value="value" class="w-full text-sm" />
              <DatePicker v-if="draft.valid_from_type === 'custom'" v-model="draft.valid_from"
                show-icon date-format="dd/mm/yy" class="w-full" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Expires</label>
              <Select v-model="draft.expires_type"
                :options="[{label:'When event starts', value:'event'},{label:'Specific date…', value:'custom'}]"
                option-label="label" option-value="value" class="w-full text-sm" />
              <DatePicker v-if="draft.expires_type === 'custom'" v-model="draft.expires_at"
                show-icon date-format="dd/mm/yy" class="w-full" />
            </div>
          </div>
        </div>

        <!-- Settings toggles -->
        <div class="px-5 py-3.5 flex items-center justify-between">
          <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <ToggleSwitch v-model="draft.is_active" />
            Enabled
          </label>
          <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <ToggleSwitch v-model="draft.save_as_template" />
            Save as template
          </label>
        </div>
       </div>
      </div>

      <!-- Footer buttons -->
      <div class="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-gray-100 shrink-0">
        <Button label="Cancel" severity="secondary" outlined size="small" @click="close" />
        <Button :label="isEditing ? 'Save Changes' : 'Add Discount'" size="small" :disabled="!draft.name" @click="save" style="background:var(--brand-primary); border-color:var(--brand-primary)" />
      </div>

    </div>
  </Dialog>
</template>
