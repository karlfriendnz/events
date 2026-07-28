<template>
  <div class="space-y-5">
    <!-- Details card -->
    <div class="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">

      <!-- Date row (accordion) -->
      <div>
        <div class="flex flex-col sm:flex-row sm:items-center px-4 sm:px-6 py-4 gap-1 sm:gap-6 group hover:bg-gray-50/50 transition-colors cursor-pointer"
          @click="open !== 'date' && (open = 'date')">
          <span class="text-sm font-semibold text-gray-700 w-full sm:w-28 shrink-0">Date</span>
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <span class="text-sm" :class="dateDisplay ? 'text-gray-700' : 'text-gray-400'">{{ dateDisplay || '—' }}</span>
            <span v-if="repeatBadge"
              class="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#EFF6FF] text-primary border border-primary/15 shrink-0">
              <i class="pi pi-sync text-[9px]" />
              {{ repeatBadge }}
            </span>
            <span v-if="(exdates?.length ?? 0) > 0"
              v-tooltip.top="{ value: skippedTooltip, escape: false }"
              class="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 shrink-0 cursor-help">
              <i class="pi pi-calendar-times text-[9px]" />
              {{ exdates!.length }} skipped
            </span>
          </div>
          <i v-if="open !== 'date'" class="pi pi-pencil text-xs text-gray-300 group-hover:text-gray-500 transition-colors shrink-0 !hidden sm:!block" />
        </div>
        <div v-if="open === 'date'" class="border-t border-gray-100" @click.stop>
          <DateTimeEditor
            :startDate="startDate" :endDate="endDate"
            :startTime="startTime" :endTime="endTime"
            :isAllDay="isAllDay" :repeat="repeat"
            :exdates="exdates"
            :minStartDate="today"
            :minEndDate="startDate ?? today"
            rowPadding="px-4 sm:px-6 py-4"
            labelWidth="w-full sm:w-28"
            @update:startDate="$emit('update:startDate', $event)"
            @update:endDate="$emit('update:endDate', $event)"
            @update:startTime="$emit('update:startTime', $event)"
            @update:endTime="$emit('update:endTime', $event)"
            @update:isAllDay="$emit('update:isAllDay', $event)"
            @update:repeat="$emit('update:repeat', $event)"
            @update:exdates="$emit('update:exdates', $event)"
          />
          <div class="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
            <Button label="Cancel" size="small" severity="secondary" text @click.stop="open = null" />
            <Button label="Save" icon="pi pi-check" size="small" :loading="savingField === 'date'"
              @click.stop="save('date')" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
          </div>
        </div>
      </div>

      <!-- Sign Up row. Edits IN the row rather than dropping a panel underneath it:
           the value area sat empty while the fields that replace it appeared below,
           so the row you clicked stayed blank and the thing you were editing moved.
           Two dates and their buttons fit on one line; the placeholders ("No open
           date") name the fields, so they need no separate labels. -->
      <div>
        <div class="flex flex-col sm:flex-row sm:items-center px-4 sm:px-6 py-4 gap-1 sm:gap-6 group transition-colors"
          :class="open === 'signup' ? '' : 'hover:bg-gray-50/50 cursor-pointer'"
          @click="open !== 'signup' && (open = 'signup')">
          <span class="text-sm font-semibold text-gray-700 w-full sm:w-28 shrink-0">Sign Up</span>

          <template v-if="open !== 'signup'">
            <span class="text-sm flex-1" :class="signupDisplay ? 'text-gray-700' : 'text-gray-400'">{{ signupDisplay || '—' }}</span>
            <i class="pi pi-pencil text-xs text-gray-300 group-hover:text-gray-500 transition-colors shrink-0 !hidden sm:!block" />
          </template>

          <!-- Date and time as SEPARATE fields, same as the wizard's sign-up row. A
               combined `DatePicker showTime` puts PrimeVue's spinner under the calendar
               — the control this app replaced with <TimeWheel> everywhere else — so the
               one place you set sign-up dates looked nothing like the place you first
               set them. -->
          <div v-else class="flex-1 min-w-0 flex flex-wrap items-center gap-2" @click.stop>
            <!-- The event's own dates are circled on both calendars: a sign-up window is
                 chosen RELATIVE to when the event runs ("opens two weeks before"), and
                 without them you're picking against a date held in your head. -->
            <DatePicker :modelValue="regOpenAt" :manual-input="false" showIcon dateFormat="dd/mm/yy" placeholder="Opens date"
              class="w-[150px] shrink-0" @update:modelValue="v => $emit('update:regOpenAt', withDatePart(regOpenAt, v as Date | null))">
              <template v-if="hasEventMarks" #date="{ date }">
                <span class="dt-day" :class="isEventDay(date) ? 'dt-day--marked' : ''"
                  v-tooltip.top="eventDayLabel(date)">{{ date.day }}</span>
              </template>
            </DatePicker>
            <TimeWheel :modelValue="regOpenAt" placeholder="Opens time" class="w-[118px] shrink-0"
              @update:modelValue="v => $emit('update:regOpenAt', withTimePart(regOpenAt, v))" />
            <span class="text-sm text-gray-300 shrink-0">→</span>
            <DatePicker :modelValue="regCloseAt" :manual-input="false" showIcon dateFormat="dd/mm/yy" placeholder="Closes date"
              class="w-[150px] shrink-0" @update:modelValue="v => $emit('update:regCloseAt', withDatePart(regCloseAt, v as Date | null))">
              <template v-if="hasEventMarks" #date="{ date }">
                <span class="dt-day" :class="isEventDay(date) ? 'dt-day--marked' : ''"
                  v-tooltip.top="eventDayLabel(date)">{{ date.day }}</span>
              </template>
            </DatePicker>
            <TimeWheel :modelValue="regCloseAt" placeholder="Closes time" class="w-[118px] shrink-0"
              @update:modelValue="v => $emit('update:regCloseAt', withTimePart(regCloseAt, v))" />
            <Button label="Cancel" size="small" severity="secondary" text class="shrink-0" @click.stop="open = null" />
            <Button label="Save" icon="pi pi-check" size="small" class="shrink-0" :loading="savingField === 'signup'"
              @click.stop="save('signup')" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
          </div>
        </div>
      </div>

      <!-- Location row (accordion) -->
      <div v-if="showLocation">
        <div class="flex flex-col sm:flex-row sm:items-center px-4 sm:px-6 py-4 gap-1 sm:gap-6 group hover:bg-gray-50/50 transition-colors cursor-pointer"
          @click="open !== 'location' && (open = 'location')">
          <span class="text-sm font-semibold text-gray-700 w-full sm:w-28 shrink-0">Location</span>
          <span class="text-sm flex-1" :class="locationSummary ? 'text-gray-700' : 'text-gray-400'">{{ locationSummary || '—' }}</span>
          <i v-if="open !== 'location'" class="pi pi-pencil text-xs text-gray-300 group-hover:text-gray-500 transition-colors shrink-0 !hidden sm:!block" />
        </div>
        <div v-if="open === 'location'" class="border-t border-gray-100 px-4 sm:pl-40 sm:pr-6 pb-5 pt-4 space-y-3" @click.stop>
          <LocationEditor
            :modelValue="locations"
            :startAt="locationStartAt"
            :endAt="locationEndAt"
            :excludeEventId="eventId"
            @update:modelValue="$emit('update:locations', $event)"
            @update:summary="locationSummary = $event" />
          <div class="flex justify-end gap-2">
            <Button label="Cancel" size="small" severity="secondary" text @click.stop="open = null" />
            <Button label="Save" icon="pi pi-check" size="small" :loading="savingField === 'location'"
              @click.stop="save('location')" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
          </div>
        </div>
      </div>

      <!-- Category row (inline edit) -->
      <div class="flex flex-col sm:flex-row sm:items-center px-4 sm:px-6 py-4 gap-1 sm:gap-6 group hover:bg-gray-50/50 transition-colors"
        :class="open !== 'category' && 'cursor-pointer'"
        @click="open !== 'category' && (open = 'category')">
        <span class="text-sm font-semibold text-gray-700 w-full sm:w-28 shrink-0">Category</span>
        <template v-if="open === 'category'">
          <div class="flex-1 w-full flex flex-col sm:flex-row sm:items-center gap-2 min-w-0" @click.stop>
            <ChipMultiSelect :modelValue="categoryIds" :options="categories" option-label="name" option-value="id"
              placeholder="Choose categories"   class="flex-1 w-full min-w-0"
              @update:modelValue="$emit('update:categoryIds', $event)" :show-toggle-all="false">
              <template #option="{ option }">
                <span class="inline-flex items-center gap-1.5">
                  <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: option.color || '#94a3b8' }" />
                  {{ option.name }}
                </span>
              </template>
            </ChipMultiSelect>
            <div class="flex gap-2 justify-end shrink-0">
              <Button icon="pi pi-plus" size="small" severity="secondary" outlined v-tooltip.top="'New category'" @click.stop="$emit('new-category')" />
              <Button label="Save" icon="pi pi-check" size="small" :loading="savingField === 'category'"
                @click.stop="save('category')" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
            </div>
          </div>
        </template>
        <template v-else>
          <div class="flex-1 flex flex-wrap gap-1.5 min-w-0">
            <span v-if="categoryIds?.length" v-for="id in categoryIds" :key="id"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
              :style="{ background: categories.find(c => c.id === id)?.color ?? '#1E2157' }">
              {{ categories.find(c => c.id === id)?.name }}
            </span>
            <span v-else class="text-sm text-gray-400">—</span>
          </div>
          <i class="pi pi-pencil text-xs text-gray-300 group-hover:text-gray-500 transition-colors shrink-0 !hidden sm:!block" />
        </template>
      </div>

      <!-- Description row (inline edit) -->
      <div class="flex flex-col sm:flex-row sm:items-start px-4 sm:px-6 py-4 gap-1 sm:gap-6 group hover:bg-gray-50/50 transition-colors"
        :class="open !== 'description' && 'cursor-pointer'"
        @click="open !== 'description' && (open = 'description')">
        <span class="text-sm font-semibold text-gray-700 w-full sm:w-28 shrink-0 sm:pt-1">Description</span>
        <template v-if="open === 'description'">
          <div class="flex-1 flex flex-col gap-3 min-w-0" @click.stop>
            <!-- Same editor the creation wizard uses for this same field. It was
                 a plain Textarea, so a description written with any formatting
                 came back here as raw HTML in a box — and editing it risked
                 mangling the markup by hand. -->
            <RichTextEditor :modelValue="description" placeholder="Add a description…"
              @update:modelValue="$emit('update:description', $event)" />
            <div class="flex justify-end">
              <Button label="Save" icon="pi pi-check" size="small" :loading="savingField === 'description'"
                @click.stop="save('description')" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
            </div>
          </div>
        </template>
        <template v-else>
          <!-- Rendered, not printed: now the editor is rich text, interpolating
               the value would show the reader "<p>Bring boots</p>". -->
          <span v-if="hasDescription" class="text-sm flex-1 line-clamp-2 text-gray-700" v-html="description" />
          <span v-else class="text-sm flex-1 text-gray-400">—</span>
          <i class="pi pi-pencil text-xs text-gray-300 group-hover:text-gray-500 transition-colors shrink-0 mt-1 !hidden sm:!block" />
        </template>
      </div>

      <!-- Fees row. Inside the card with everything else — it was a separate block
           floating below, which read as a different section of the page rather than
           another fact about the event. OFF by default: most events don't charge one,
           and an empty fee table sitting open invites you to fill in a thing you
           didn't want. -->
      <div>
        <div class="flex flex-col sm:flex-row px-4 sm:px-6 py-4 gap-1 sm:gap-6">
          <span class="text-sm font-semibold text-gray-700 w-full sm:w-28 shrink-0 sm:pt-1.5">Fees</span>
          <div class="flex-1 min-w-0">
            <!-- One line: the label and its explanation read as a single sentence, and
                 stacked they took three lines of a row that has one control. -->
            <div class="flex items-center gap-3">
              <ToggleSwitch :modelValue="feesOn" class="shrink-0" @update:modelValue="toggleFees" />
              <p class="text-sm text-gray-700 min-w-0">
                Charge a base fee
                <span class="text-gray-500">— applied to everyone, on top of any session fees.</span>
              </p>
            </div>
            <div v-if="feesOn" class="mt-3">
              <div v-if="feesLoading" class="py-4 flex justify-center"><i class="pi pi-spin pi-spinner text-gray-400" /></div>
              <FeeLineItemsTable v-else :modelValue="feeLineItems"
                @update:modelValue="v => { $emit('update:feeLineItems', v); $emit('fees-change', v) }" />
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import type { FeeLineItem } from '~/composables/useFeeGroups'
import { rruleToSummary } from '~/composables/useRepeatOptions'

interface Category { id: string; name: string; color?: string }
interface Location { [key: string]: any }

const props = withDefaults(defineProps<{
  startDate?: Date | null
  endDate?: Date | null
  startTime?: Date | null
  endTime?: Date | null
  isAllDay?: boolean
  repeat?: string
  exdates?: string[]
  locations?: Location[]
  categoryIds?: string[]
  categories?: Category[]
  description?: string
  feeLineItems?: FeeLineItem[]
  savingField?: string | null
  feesLoading?: boolean
  showLocation?: boolean
  regOpenAt?: Date | null
  regCloseAt?: Date | null
  eventId?: string | null
}>(), {
  startDate: null, endDate: null, startTime: null, endTime: null,
  isAllDay: false, repeat: '', locations: () => [], categoryIds: () => [],
  categories: () => [], description: '', feeLineItems: () => [],
  savingField: null, feesLoading: false, showLocation: true,
  regOpenAt: null, regCloseAt: null, eventId: null,
})

/**
 * Is there really a description?
 *
 * TipTap serialises an empty document as "<p></p>", which is truthy — so a
 * plain `description ?` check would show an empty paragraph as content and hide
 * the "—" placeholder, leaving the row looking blank but not empty.
 */
const hasDescription = computed(() => {
  const v = (props.description ?? '').trim()
  if (!v) return false
  return v.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim().length > 0
})

const emit = defineEmits<{
  'update:startDate': [Date | null]
  'update:endDate': [Date | null]
  'update:startTime': [Date | null]
  'update:endTime': [Date | null]
  'update:isAllDay': [boolean]
  'update:repeat': [string]
  'update:exdates': [string[]]
  'update:locations': [Location[]]
  'update:categoryIds': [string[]]
  'update:description': [string]
  'update:feeLineItems': [FeeLineItem[]]
  'update:regOpenAt': [Date | null]
  'update:regCloseAt': [Date | null]
  'save': [field: string]
  'fees-change': [FeeLineItem[]]
  'new-category': []
}>()

const open = ref<string | null>(null)

/**
 * The sign-up window is stored as ONE datetime per end, but edited as a date field and
 * a time field — so each control has to change its own half and leave the other alone.
 * Clearing the date clears the value entirely (no time without a day); clearing the
 * time falls back to midnight rather than dropping the date the user just chose.
 */
function withDatePart(cur: Date | null | undefined, d: Date | null): Date | null {
  if (!d) return null
  const out = cur ? new Date(cur) : new Date(d)
  if (!cur) out.setHours(0, 0, 0, 0)
  out.setFullYear(d.getFullYear(), d.getMonth(), d.getDate())
  return out
}
/**
 * The event's own start/end, circled on the sign-up calendars.
 *
 * Keyed by y-m-d parts because PrimeVue's #date slot hands us { day, month, year } and
 * not a Date — comparing Date objects would drag timezone into a purely visual mark.
 */
const eventDayMarks = computed(() => {
  const out = new Map<string, string>()
  const add = (d: Date | null | undefined, label: string) => {
    if (!d) return
    const dt = d instanceof Date ? d : new Date(d)
    if (Number.isNaN(dt.getTime())) return
    const key = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`
    // First wins, so a single-day event reads "Event starts", not "Event ends".
    if (!out.has(key)) out.set(key, label)
  }
  add(props.startDate, 'Event starts')
  add(props.endDate, 'Event ends')
  return out
})
const hasEventMarks = computed(() => eventDayMarks.value.size > 0)
function isEventDay(d: { day: number; month: number; year: number }) {
  return eventDayMarks.value.has(`${d.year}-${d.month}-${d.day}`)
}
function eventDayLabel(d: { day: number; month: number; year: number }) {
  return eventDayMarks.value.get(`${d.year}-${d.month}-${d.day}`)
}

function withTimePart(cur: Date | null | undefined, t: Date | null): Date | null {
  // A time on its own has no day to sit on — pick the date first.
  if (!cur) return cur ?? null
  const out = new Date(cur)
  if (!t) out.setHours(0, 0, 0, 0)
  else out.setHours(t.getHours(), t.getMinutes(), 0, 0)
  return out
}

/**
 * Does this event charge a base fee?
 *
 * Starts ON for an event that already HAS fee lines — hiding money an event is already
 * charging behind a switch you have to find would be worse than showing an empty table.
 * Otherwise off, and the table only appears once you say there's a fee.
 */
const feesOn = ref(false)
watch(() => props.feeLineItems, (v) => { if (v?.length) feesOn.value = true }, { immediate: true, deep: true })

/**
 * Turning it OFF clears the lines, rather than just hiding them. A fee that is invisible
 * but still charged is the worst of the three states — the switch has to mean "this
 * event has no base fee", not "don't show me the fee it has".
 */
function toggleFees(on: boolean) {
  feesOn.value = on
  if (!on && props.feeLineItems?.length) {
    emit('update:feeLineItems', [])
    emit('fees-change', [])
  }
}
const locationSummary = ref('')

function buildDateTimeISO(date: Date | null | undefined, time: Date | null | undefined): string | null {
  if (!date) return null
  const d = new Date(date)
  if (time) { d.setHours(time.getHours(), time.getMinutes(), 0, 0) }
  else { d.setHours(0, 0, 0, 0) }
  return d.toISOString()
}

const locationStartAt = computed(() => buildDateTimeISO(props.startDate, props.startTime))
const locationEndAt = computed(() => buildDateTimeISO(props.endDate ?? props.startDate, props.endTime))

// An event can't start in the past — the earliest selectable date is today.
const today = new Date()
today.setHours(0, 0, 0, 0)

const dateDisplay = computed(() => {
  if (!props.startDate) return ''
  const fmt = (d: Date) => d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  const fmtTime = (d: Date) => d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })
  let s = fmt(props.startDate)
  if (!props.isAllDay && props.startTime) s += `, ${fmtTime(props.startTime as Date)}`
  if (props.endDate || (!props.isAllDay && props.endTime)) {
    s += ' → '
    if (props.endDate && props.endDate.toDateString() !== props.startDate!.toDateString()) s += fmt(props.endDate)
    if (!props.isAllDay && props.endTime) s += `, ${fmtTime(props.endTime as Date)}`
  }
  return s
})

const repeatBadge = computed(() => {
  if (!props.repeat || props.repeat === 'NONE') return ''
  const fmtDate = (d: Date) => d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  return rruleToSummary(props.repeat, fmtDate).replace(/^Repeats /, '')
})

const skippedTooltip = computed(() => {
  const list = (props.exdates ?? []).slice().sort()
  if (!list.length) return ''
  return list.map(key => {
    const [y, m, d] = key.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
  }).join('<br>')
})

const signupDisplay = computed(() => {
  const fmt = (d: Date) => d.toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
  if (props.regOpenAt && props.regCloseAt) return `${fmt(props.regOpenAt)} → ${fmt(props.regCloseAt)}`
  if (props.regOpenAt) return `Opens ${fmt(props.regOpenAt)}`
  if (props.regCloseAt) return `Closes ${fmt(props.regCloseAt)}`
  return ''
})

function save(field: string) {
  open.value = null
  emit('save', field)
}
</script>
