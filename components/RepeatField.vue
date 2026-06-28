<template>
  <div class="flex-1 flex flex-col gap-2 w-full">
    <!-- Row: dropdown + skip button -->
    <div class="flex items-stretch gap-2 w-full">
      <RepeatSelect
        :model-value="modelValue"
        :date="baseDate ?? null"
        :show-custom="true"
        @update:model-value="onRuleChange"
        @customRepeat="openCustom" />

      <button v-if="hasRule && baseDate" type="button"
        class="shrink-0 inline-flex items-center gap-1.5 px-3 rounded-md text-sm font-medium border transition-colors h-[2.625rem]"
        :class="(exdates?.length ?? 0) > 0
          ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'"
        @click="exclusionsOpen = true">
        <i class="pi pi-calendar-times text-xs" />
        <span>{{ (exdates?.length ?? 0) > 0 ? `${exdates!.length} skipped` : 'Skip dates' }}</span>
      </button>
    </div>

    <!-- Skipped-date chips -->
    <div v-if="hasRule && (exdates?.length ?? 0) > 0" class="flex flex-wrap items-center gap-1">
      <span class="text-[11px] text-gray-500 mr-1">Skipped:</span>
      <button v-for="key in sortedExdates" :key="key" type="button"
        class="text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 hover:bg-red-100 flex items-center gap-1"
        @click="removeExdate(key)">
        {{ formatExdateLabel(key) }}
        <i class="pi pi-times text-[8px]" />
      </button>
      <button class="text-[11px] text-gray-500 hover:text-gray-800 ml-1"
        @click="emit('update:exdates', [])">Clear all</button>
    </div>
  </div>

  <!-- Skip dates dialog -->
  <Dialog v-model:visible="exclusionsOpen" modal header="Skip dates" :style="{ width: '480px' }"
    :pt="{ content: { class: 'p-4' } }">
    <RecurrenceExclusions
      :model-value="exdates ?? []"
      :rrule="modelValue"
      :base-date="baseDate ?? null"
      :range-end="rangeEnd ?? null"
      @update:model-value="emit('update:exdates', $event)" />
    <template #footer>
      <Button label="Done" size="small" style="background:var(--brand-primary);border-color:var(--brand-primary)"
        @click="exclusionsOpen = false" />
    </template>
  </Dialog>

  <!-- Custom recurrence dialog -->
  <Dialog v-model:visible="customOpen" modal header="Custom recurrence" :style="{ width: '460px' }"
    :pt="{ content: { class: 'p-0' } }">
    <div class="flex flex-col">
      <!-- Interval + Frequency -->
      <div class="px-5 py-4 border-b border-gray-100">
        <p class="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Repeat every</p>
        <div class="flex items-center gap-2">
          <InputNumber v-model="custom.interval" :min="1" :max="99"
            :pt="{ root: { class: 'w-20' }, pcInputText: { root: { class: 'text-center' } } }" />
          <Select v-model="custom.freq" :options="freqOptions"
            option-label="label" option-value="value" class="flex-1" />
        </div>
      </div>

      <!-- Weekly: day picker -->
      <div v-if="custom.freq === 'WEEKLY'" class="px-5 py-4 border-b border-gray-100">
        <p class="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Repeat on</p>
        <div class="flex gap-1.5">
          <button v-for="(d, i) in dayLabels" :key="i" type="button"
            class="w-9 h-9 rounded-full text-xs font-semibold transition-colors"
            :class="custom.byDay.includes(weekdayCodes[i])
              ? 'bg-primary text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
            @click="toggleByDay(weekdayCodes[i])">{{ d }}</button>
        </div>
      </div>

      <!-- Monthly: day-of-month -->
      <div v-if="custom.freq === 'MONTHLY'" class="px-5 py-4 border-b border-gray-100">
        <p class="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Repeat on</p>
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-600">Day</span>
          <InputNumber v-model="custom.byMonthDay" :min="1" :max="31"
            :pt="{ root: { class: 'w-20' }, pcInputText: { root: { class: 'text-center' } } }" />
          <span class="text-sm text-gray-600">of the month</span>
        </div>
      </div>

      <!-- Ends -->
      <div class="px-5 py-4">
        <p class="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-3">Ends</p>
        <div class="flex flex-col gap-2.5">
          <label class="flex items-center gap-3 cursor-pointer">
            <RadioButton v-model="custom.end" value="NEVER" input-id="end-never" />
            <span class="text-sm text-gray-700">Never</span>
          </label>
          <label class="flex items-center gap-3 cursor-pointer">
            <RadioButton v-model="custom.end" value="UNTIL" input-id="end-until" />
            <span class="text-sm text-gray-700 w-12">On</span>
            <DatePicker v-model="custom.until" :disabled="custom.end !== 'UNTIL'" date-format="d M yy"
              placeholder="Pick date" show-icon class="flex-1 max-w-[200px]" @click="custom.end = 'UNTIL'" />
          </label>
          <label class="flex items-center gap-3 cursor-pointer">
            <RadioButton v-model="custom.end" value="COUNT" input-id="end-count" />
            <span class="text-sm text-gray-700 w-12">After</span>
            <InputNumber v-model="custom.count" :min="1" :max="999" :disabled="custom.end !== 'COUNT'"
              :pt="{ root: { class: 'w-20' }, pcInputText: { root: { class: 'text-center' } } }"
              @click="custom.end = 'COUNT'" />
            <span class="text-sm text-gray-500">occurrences</span>
          </label>
        </div>
      </div>

      <!-- Live summary -->
      <div class="px-5 py-3 bg-[#EFF6FF] border-t border-primary/10 flex items-center gap-2">
        <i class="pi pi-info-circle text-primary text-xs" />
        <p class="text-xs text-primary font-medium">{{ customSummary }}</p>
      </div>
    </div>
    <template #footer>
      <Button label="Cancel" severity="secondary" text size="small" @click="customOpen = false" />
      <Button label="Save" size="small" style="background:var(--brand-primary);border-color:var(--brand-primary)"
        @click="commitCustom" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { rruleToSummary } from '~/composables/useRepeatOptions'

const props = withDefaults(defineProps<{
  modelValue: string             // rrule
  exdates?: string[]
  baseDate?: Date | null
  rangeEnd?: Date | null
  showCustom?: boolean
}>(), {
  showCustom: true,
})

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
  (e: 'update:exdates', v: string[]): void
  (e: 'customRepeat'): void
}>()

const hasRule = computed(() => !!props.modelValue && props.modelValue !== 'NONE')

// ── Skip-dates dialog ────────────────────────────────────
const exclusionsOpen = ref(false)

const sortedExdates = computed(() => [...(props.exdates ?? [])].sort())

function removeExdate(key: string) {
  emit('update:exdates', (props.exdates ?? []).filter(k => k !== key))
}

function formatExdateLabel(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

function onRuleChange(v: string) {
  emit('update:modelValue', v)
  if (!v || v === 'NONE') emit('update:exdates', [])
}

// ── Custom recurrence dialog ─────────────────────────────
const customOpen = ref(false)
const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const weekdayCodes = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
const freqOptions = [
  { label: 'days',   value: 'DAILY' },
  { label: 'weeks',  value: 'WEEKLY' },
  { label: 'months', value: 'MONTHLY' },
  { label: 'years',  value: 'YEARLY' },
]

const custom = reactive({
  interval: 1,
  freq: 'WEEKLY' as 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY',
  byDay: [] as string[],
  byMonthDay: 1 as number | null,
  end: 'NEVER' as 'NEVER' | 'UNTIL' | 'COUNT',
  until: null as Date | null,
  count: 10 as number | null,
})

function openCustom() {
  // Pre-fill from current rule if any
  if (props.modelValue && props.modelValue !== 'NONE') {
    const parts = Object.fromEntries(
      props.modelValue.split(';').map(p => p.split('=')) as any,
    ) as Record<string, string>
    custom.interval = parseInt(parts['INTERVAL'] ?? '1') || 1
    custom.freq = (parts['FREQ'] as any) || 'WEEKLY'
    custom.byDay = parts['BYDAY']
      ? parts['BYDAY'].split(',').map(d => d.replace(/^-?\d+/, ''))
      : []
    custom.byMonthDay = parts['BYMONTHDAY'] ? parseInt(parts['BYMONTHDAY']) : (props.baseDate?.getDate() ?? 1)
    if (parts['UNTIL']) {
      custom.end = 'UNTIL'
      const u = parts['UNTIL']
      custom.until = new Date(Number(u.slice(0, 4)), Number(u.slice(4, 6)) - 1, Number(u.slice(6, 8)))
    } else if (parts['COUNT']) {
      custom.end = 'COUNT'
      custom.count = parseInt(parts['COUNT'])
    } else {
      custom.end = 'NEVER'
    }
  } else if (props.baseDate) {
    const code = weekdayCodes[(props.baseDate.getDay() + 6) % 7]
    custom.byDay = [code]
    custom.byMonthDay = props.baseDate.getDate()
  }
  customOpen.value = true
}

function toggleByDay(code: string) {
  const i = custom.byDay.indexOf(code)
  if (i >= 0) custom.byDay.splice(i, 1)
  else custom.byDay.push(code)
}

function buildCustomRule() {
  const parts: string[] = [`FREQ=${custom.freq}`]
  if (custom.interval > 1) parts.push(`INTERVAL=${custom.interval}`)
  if (custom.freq === 'WEEKLY' && custom.byDay.length) {
    const ordered = weekdayCodes.filter(c => custom.byDay.includes(c))
    parts.push(`BYDAY=${ordered.join(',')}`)
  }
  if (custom.freq === 'MONTHLY' && custom.byMonthDay) parts.push(`BYMONTHDAY=${custom.byMonthDay}`)
  if (custom.end === 'UNTIL' && custom.until) {
    const u = custom.until
    parts.push(`UNTIL=${u.getFullYear()}${String(u.getMonth() + 1).padStart(2, '0')}${String(u.getDate()).padStart(2, '0')}T235959Z`)
  } else if (custom.end === 'COUNT' && custom.count) {
    parts.push(`COUNT=${custom.count}`)
  }
  return parts.join(';')
}

const customSummary = computed(() => rruleToSummary(buildCustomRule()))

function commitCustom() {
  emit('update:modelValue', buildCustomRule())
  customOpen.value = false
}
</script>
