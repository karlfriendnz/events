<template>
  <div class="bg-white rounded-xl border border-gray-200 p-4">
    <div class="flex items-center justify-between mb-3">
      <div>
        <p class="text-sm font-semibold text-gray-800">Skip dates</p>
        <p class="text-[11px] text-gray-500">Click any occurrence to skip it. Skipped dates won't be created.</p>
      </div>
      <div class="flex items-center gap-1">
        <button class="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500" @click="prevMonth">
          <i class="pi pi-chevron-left text-xs" />
        </button>
        <span class="text-sm font-medium text-gray-700 min-w-[120px] text-center">{{ monthLabel }}</span>
        <button class="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500" @click="nextMonth">
          <i class="pi pi-chevron-right text-xs" />
        </button>
      </div>
    </div>

    <!-- Day-of-week header -->
    <div class="grid grid-cols-7 mb-1">
      <div v-for="d in ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']" :key="d"
        class="text-[10px] font-semibold text-gray-400 uppercase text-center py-1">{{ d }}</div>
    </div>

    <!-- Calendar grid -->
    <div class="grid grid-cols-7 gap-0.5">
      <button v-for="cell in cells" :key="cell.key" type="button"
        :disabled="!cell.isOccurrence"
        class="aspect-square text-xs rounded-md flex items-center justify-center transition-colors relative"
        :class="cellClass(cell)"
        @click="toggle(cell)">
        <span :class="cell.isExcluded ? 'line-through' : ''">{{ cell.day }}</span>
        <span v-if="cell.isExcluded"
          class="absolute top-0.5 right-0.5 text-[8px] text-red-500 leading-none">✕</span>
      </button>
    </div>

    <div v-if="excludedSorted.length" class="mt-3 pt-3 border-t border-gray-100">
      <p class="text-[11px] text-gray-500 mb-1.5">{{ excludedSorted.length }} skipped:</p>
      <div class="flex flex-wrap gap-1">
        <button v-for="key in excludedSorted" :key="key" type="button"
          class="text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 hover:bg-red-100 flex items-center gap-1"
          @click="removeKey(key)">
          {{ formatExcludedLabel(key) }}
          <i class="pi pi-times text-[8px]" />
        </button>
        <button class="text-[11px] text-gray-500 hover:text-gray-800 ml-1" @click="clearAll">Clear all</button>
      </div>
    </div>
    <p v-else class="text-[11px] text-gray-400 mt-3">No dates skipped.</p>
  </div>
</template>

<script setup lang="ts">
import { dateKey, expandRrule, stripTime } from '~/composables/useRecurrence'

const props = defineProps<{
  modelValue: string[]            // exdates as YYYY-MM-DD
  rrule: string                   // recurrence rule
  baseDate: Date | null           // session start date
  rangeEnd?: Date | null          // event end date / occurrence cap
}>()

const emit = defineEmits<{ (e: 'update:modelValue', v: string[]): void }>()

// Calendar state
const cursor = ref<Date>(props.baseDate ? new Date(props.baseDate.getFullYear(), props.baseDate.getMonth(), 1) : new Date())

// Reset cursor when base date changes
watch(() => props.baseDate, (d) => {
  if (d) cursor.value = new Date(d.getFullYear(), d.getMonth(), 1)
})

const monthLabel = computed(() =>
  cursor.value.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' }),
)

function prevMonth() {
  cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() - 1, 1)
}
function nextMonth() {
  cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + 1, 1)
}

// Compute occurrences far enough out to cover the visible calendar window
const occurrenceKeys = computed(() => {
  if (!props.baseDate || !props.rrule || props.rrule === 'NONE') return new Set<string>()
  // Expand to at least 24 months past the base date or until rangeEnd
  const fallbackEnd = new Date(props.baseDate)
  fallbackEnd.setMonth(fallbackEnd.getMonth() + 24)
  const end = props.rangeEnd ?? fallbackEnd
  const dates = expandRrule(props.rrule, props.baseDate, end, 730)
  return new Set(dates.map(d => dateKey(d)))
})

const excludedSet = computed(() => new Set(props.modelValue ?? []))
const excludedSorted = computed(() => [...excludedSet.value].sort())

const cells = computed(() => {
  const year = cursor.value.getFullYear()
  const month = cursor.value.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  // Monday-anchored grid: Mon=0, Sun=6
  const offset = (firstOfMonth.getDay() + 6) % 7
  const gridStart = new Date(year, month, 1 - offset)
  const today = stripTime(new Date())
  const cells: any[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    const key = dateKey(d)
    cells.push({
      key,
      day: d.getDate(),
      date: d,
      inMonth: d.getMonth() === month,
      isOccurrence: occurrenceKeys.value.has(key),
      isExcluded: excludedSet.value.has(key),
      isToday: d.getTime() === today.getTime(),
      isPast: d < today,
    })
  }
  return cells
})

function cellClass(c: any) {
  if (!c.inMonth) return 'text-gray-300 cursor-default'
  if (!c.isOccurrence) return 'text-gray-300 cursor-default'
  if (c.isExcluded) return 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
  return c.isToday
    ? 'bg-primary text-white font-semibold hover:bg-primary/90'
    : c.isPast
    ? 'bg-gray-50 text-gray-400 hover:bg-gray-100'
    : 'bg-[#EFF6FF] text-primary font-medium hover:bg-primary/15'
}

function toggle(c: any) {
  if (!c.isOccurrence) return
  const next = new Set(excludedSet.value)
  if (next.has(c.key)) next.delete(c.key)
  else next.add(c.key)
  emit('update:modelValue', [...next])
}

function removeKey(key: string) {
  emit('update:modelValue', (props.modelValue ?? []).filter(k => k !== key))
}

function clearAll() {
  emit('update:modelValue', [])
}

function formatExcludedLabel(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}
</script>
