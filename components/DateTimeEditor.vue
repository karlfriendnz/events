<template>
  <div :class="divider ? 'divide-y divide-gray-100' : ''">
    <!-- When + All day.
         One line on wide screens: [start date][start time] → [end date][end time] [all day].
         Below lg the four pickers can't breathe side by side, so each half
         (start / end) stacks and the arrow is dropped. -->
    <div class="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4" :class="rowPadding">
      <span class="field-label shrink-0" :class="[labelWidth, labelClass]">
        {{ label }}<span v-if="required && label" class="text-red-400 ml-0.5">*</span>
      </span>
      <div class="flex flex-col gap-2 flex-1 w-full min-w-0" :class="stack ? '' : 'lg:flex-row lg:items-center lg:gap-3'">
        <!-- Start -->
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <DatePicker :model-value="startDate" :manual-input="false" show-icon date-format="dd/mm/yy" :placeholder="`${startLabel} date`" fluid class="flex-1 min-w-0"
            :min-date="minStartDate"
            :max-date="maxDate ?? undefined"
            @update:model-value="onStartDate">
            <!-- v-tooltip, not the native `title`: it matches every other tooltip in
                 the app and shows straight away, where the browser's own takes a
                 second or so — long enough that you'd never discover what the green
                 circle means by hovering it. -->
            <template v-if="hasMarks" #date="{ date }">
              <span class="dt-day" :class="isMarkedDay(date) ? 'dt-day--marked' : ''"
                v-tooltip.top="markTooltip(date)">{{ date.day }}</span>
            </template>
          </DatePicker>
          <!-- All day HIDES the times rather than disabling them: a greyed-out box you
               cannot use is still a box you have to read past, and "all day" already
               says there is no time to set. The date picker takes the freed width. -->
          <TimeWheel v-if="showTime && !isAllDay" ref="startTimeRef" :model-value="startTime" :placeholder="`${startLabel} time`" class="flex-1 min-w-0"
            :min-time="startMinTime"
            @update:model-value="onStartTime" />
        </div>
        <span v-if="!stack" class="text-sm text-gray-300 shrink-0 hidden lg:inline">→</span>
        <!-- End -->
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <DatePicker ref="endDateRef" :model-value="endDate" :manual-input="false" show-icon date-format="dd/mm/yy" :placeholder="`${endLabel} date`" fluid class="flex-1 min-w-0"
            :min-date="minEndDate ?? startDate ?? undefined"
            :max-date="maxDate ?? undefined"
            @update:model-value="onEndDate">
            <!-- v-tooltip, not the native `title`: it matches every other tooltip in
                 the app and shows straight away, where the browser's own takes a
                 second or so — long enough that you'd never discover what the green
                 circle means by hovering it. -->
            <template v-if="hasMarks" #date="{ date }">
              <span class="dt-day" :class="isMarkedDay(date) ? 'dt-day--marked' : ''"
                v-tooltip.top="markTooltip(date)">{{ date.day }}</span>
            </template>
          </DatePicker>
          <!-- An impossible end time is SHOWN as wrong rather than silently
               corrected — the ring marks the control the person just used, so
               the feedback is where they are looking. -->
          <TimeWheel v-if="showTime && !isAllDay" ref="endTimeRef" :model-value="endTime" :placeholder="`${endLabel} time`"
            class="flex-1 min-w-0 rounded-md"
            :class="endTimeInvalid ? 'ring-2 ring-red-400' : ''"
            :min-time="endMinTime"
            @update:model-value="onEndTime" />
        </div>
        <!-- All day lives ON the date line, where the thing it applies to is.
             It used to drop down to the Repeat row whenever there was one,
             because as a flex child it stole width and left this row's pickers
             narrower than the identical Sign-up row beneath — they stopped
             lining up. That alignment is now kept by `reserveAllDaySpace`,
             which lets a sibling editor with no toggle hold the same gap open,
             so the control can sit where it belongs. -->
        <div v-if="showAllDay" class="flex items-center gap-2 shrink-0">
          <span class="text-xs text-gray-500" :class="stack ? '' : 'lg:hidden'">All day</span>
          <ToggleSwitch :model-value="isAllDay" v-tooltip.top="'All day'"
            @update:model-value="emit('update:isAllDay', $event)" />
        </div>
        <!-- Holds open exactly the gap an All-day toggle would occupy, so a row
             WITHOUT one (the sign-up window) keeps its pickers aligned with the
             row above that has one. Opt-in: most consumers have no sibling row
             to line up with and would just get dead space. -->
        <div v-else-if="reserveAllDaySpace" aria-hidden="true"
          class="flex items-center gap-2 shrink-0 invisible">
          <span class="text-xs" :class="stack ? '' : 'lg:hidden'">All day</span>
          <ToggleSwitch :model-value="false" />
        </div>
      </div>
    </div>
    <!-- No message here on purpose. The red ring marks the offending control,
         and the host page already says why in one place; adding a third copy of
         the same sentence was noise, not help. -->
    <!-- Outside event dates (session-only affordance) -->
    <div v-if="showOutsideEventDates" class="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4" :class="rowPadding">
      <span class="field-label shrink-0" :class="labelWidth">Outside</span>
      <div class="flex items-center gap-2 w-full">
        <ToggleSwitch :model-value="outsideEventDates" @update:model-value="emit('update:outsideEventDates', $event)" />
        <span class="text-xs text-gray-400">Allow a date outside the event's range</span>
      </div>
    </div>
    <!-- Repeat (dropdown + exclusions calendar).
         The label's top offset centres it against the 40px control on its first line
         (10px = (40 − 20)/2); it used to be pt-2, which only looked right while the
         row carried its own padding. -->
    <div v-if="showRepeat" class="flex flex-col sm:flex-row sm:items-start gap-1.5 sm:gap-4" :class="rowPadding">
      <span class="field-label shrink-0 sm:pt-2.5" :class="labelWidth">Repeat</span>
      <div class="flex-1 min-w-0 flex items-start gap-3">
        <RepeatField
          class="flex-1 min-w-0"
          :model-value="repeat"
          :exdates="exdates"
          :base-date="startDate"
          :range-end="maxDate ?? null"
          :show-custom="showCustomRepeat"
          @update:model-value="emit('update:repeat', $event)"
          @update:exdates="emit('update:exdates', $event)"
          @customRepeat="emit('customRepeat')" />
        <!-- All day used to ALSO live here, on the Repeat row, whenever there
             was one. It now sits on the Date row in every case (see there), and
             this copy is gone: with both rendering the toggle appeared twice,
             two controls bound to the same value. -->
      </div>
    </div>
    <!-- Outside dates warning -->
    <div v-if="showOutsideEventDates && outsideEventDates" class="flex items-center gap-2 mx-5 my-3 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2">
      <i class="pi pi-info-circle text-orange-400 text-xs shrink-0" />
      <span class="text-xs text-orange-700">This session's date is outside the event's date range</span>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  startDate: Date | null
  endDate: Date | null
  startTime: Date | null
  endTime: Date | null
  isAllDay?: boolean
  repeat?: string
  exdates?: string[]
  // Turn the editor into a plain start→end range picker (used by the sign-up
  // window, which has no all-day or recurrence concept).
  showAllDay?: boolean
  /**
   * Hold open the space an All-day toggle would take, without showing one.
   * For a row that sits directly under one that HAS the toggle (the sign-up
   * window under the event date) so their pickers stay in the same columns.
   */
  reserveAllDaySpace?: boolean
  showRepeat?: boolean
  // Hide the time pickers for a date-only range (keeps the date → date arrow).
  showTime?: boolean
  // When the picked date is TODAY, block choosing a time in the past. Opt-in (event
  // start/end use it; sign-up windows don't — a past "opens" time is valid there).
  noPastToday?: boolean
  // Row dividers between When / Repeat / etc. Off for a compact host (the quick modal)
  // where these already sit among plain rows and the extra line reads as clutter.
  divider?: boolean
  label?: string
  required?: boolean
  startLabel?: string
  endLabel?: string
  showCustomRepeat?: boolean
  showOutsideEventDates?: boolean
  outsideEventDates?: boolean
  minStartDate?: Date
  minEndDate?: Date
  maxDate?: Date | null
  rowPadding?: string
  labelWidth?: string
  labelClass?: string
  // Force the vertical (start-pair over end-pair) layout regardless of viewport.
  // For narrow containers on a WIDE viewport (e.g. the compact Quick-event modal),
  // where the single-row desktop layout would cram the pickers and clip the date.
  stack?: boolean
  /**
   * Days to MARK on the calendar as context — a dot under the number, not a selection.
   *
   * A sign-up window is chosen relative to something else: "opens two weeks before the
   * programme starts". Without the programme's own dates on the calendar you're picking
   * against a date you have to hold in your head, then scrolling back up to check it.
   * Nulls are allowed so a host can pass a not-yet-set date without guarding.
   */
  markDates?: (Date | string | null | undefined | { date: Date | string | null | undefined; label?: string })[]
  /** Fallback tooltip for entries passed as a bare date rather than { date, label }. */
  markLabel?: string
}>(), {
  isAllDay: false,
  repeat: 'NONE',
  showAllDay: true,
  showRepeat: true,
  showTime: true,
  divider: true,
  label: 'Date',
  required: false,
  startLabel: 'Start',
  endLabel: 'End',
  showOutsideEventDates: false,
  outsideEventDates: false,
  rowPadding: 'px-5 py-3',
  labelWidth: 'w-12',
  labelClass: '',   // .field-label owns the colour now
})

// Marked days, as a Set of 'y-m-d' keys. PrimeVue's #date slot hands us
// { day, month, year } (month 0-based) rather than a Date, so the key is built from
// those parts — comparing Date objects would drag timezone into a purely visual mark.
// key → its own tooltip, so each marked day can say which end it is ("Event starts"
// vs "Event ends") instead of sharing one vague label.
const markKeySet = computed(() => {
  const out = new Map<string, string | undefined>()
  for (const entry of props.markDates ?? []) {
    if (!entry) continue
    const raw = entry instanceof Date || typeof entry === 'string' ? entry : entry.date
    const label = entry instanceof Date || typeof entry === 'string' ? props.markLabel : (entry.label ?? props.markLabel)
    if (!raw) continue
    const dt = raw instanceof Date ? raw : new Date(raw)
    if (Number.isNaN(dt.getTime())) continue
    const key = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`
    // First writer wins: a one-day event whose start and end are the same day should
    // read "Event starts", not be overwritten by "Event ends".
    if (!out.has(key)) out.set(key, label)
  }
  return out
})
const hasMarks = computed(() => markKeySet.value.size > 0)
function isMarkedDay(d: { day: number; month: number; year: number }) {
  return markKeySet.value.has(`${d.year}-${d.month}-${d.day}`)
}
function markTooltip(d: { day: number; month: number; year: number }) {
  return markKeySet.value.get(`${d.year}-${d.month}-${d.day}`)
}

const emit = defineEmits<{
  (e: 'update:startDate', v: Date | null): void
  (e: 'update:endDate', v: Date | null): void
  (e: 'update:startTime', v: Date | null): void
  (e: 'update:endTime', v: Date | null): void
  (e: 'update:isAllDay', v: boolean): void
  (e: 'update:repeat', v: string): void
  (e: 'update:exdates', v: string[]): void
  (e: 'update:outsideEventDates', v: boolean): void
  (e: 'change'): void
  (e: 'customRepeat'): void
}>()

// The range can't end before it starts. Rather than let the user pick an
// invalid window and then scold them, keep the end pinned ahead of the start:
// an end that would land before the start is pushed to start + 1h.
const HOUR = 60 * 60 * 1000

// Times only need comparing when both ends land on the same calendar day —
// an 8pm→6am overnight event across two dates is perfectly valid.
function sameDay(a: Date | null, b: Date | null) {
  if (!a || !b) return true          // no end date given → treated as same day
  return a.toDateString() === b.toDateString()
}
function plusHour(d: Date) { return new Date(d.getTime() + HOUR) }
// For noPastToday: pass `now` as the time floor when the picked date is today.
function isToday(d: Date | null) {
  if (!d) return false
  const n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
}
const startMinTime = computed(() => (props.noPastToday && isToday(props.startDate)) ? new Date() : null)
const endMinTime = computed(() => (props.noPastToday && isToday(props.endDate ?? props.startDate)) ? new Date() : null)
// Compare TIME-OF-DAY only, never the full timestamp: the two time pickers each carry
// their own calendar day, so `endTime <= startTime` on raw Dates gives wrong answers
// across days. On a same-day event we only care about the clock time.
function minsOfDay(d: Date) { return d.getHours() * 60 + d.getMinutes() }

const endDateRef = ref()
const startTimeRef = ref()
const endTimeRef = ref()
// Focus the end-date picker's input, which pops its calendar panel.
function openEndDate() {
  nextTick(() => (endDateRef.value?.$el?.querySelector('input') as HTMLInputElement | undefined)?.focus())
}
function onStartDate(v: Date | null) {
  emit('update:startDate', v)
  // End date before the new start → drop it rather than keep an invalid range.
  if (v && props.endDate && v > props.endDate) emit('update:endDate', null)
  // A blank end date defaults to the start date (single-day by default). Only fills
  // a blank — never overwrites an end the user already picked.
  if (v && !props.endDate) emit('update:endDate', v)
  emit('change')
  if (!v) return
  // Auto-advance the sequence: date → time (or → end date when there are no time wheels).
  nextTick(() => {
    if (props.showTime && !props.isAllDay) startTimeRef.value?.open?.()
    else openEndDate()
  })
}
function onEndDate(v: Date | null) {
  emit('update:endDate', v)
  emit('change')
  // Collapsing a multi-day event back onto one day can strand the end time —
  // that now surfaces as the red invalid state rather than being auto-corrected.
  // Auto-advance: end date → end time.
  if (v && props.showTime && !props.isAllDay) nextTick(() => endTimeRef.value?.open?.())
}
function onStartTime(v: Date | null) {
  emit('update:startTime', v)
  // A blank end time defaults to start + 1 hour (only fills a blank).
  if (v && !props.endTime) emit('update:endTime', plusHour(v))
  emit('change')
  // Moving the start past an existing end no longer rewrites that end — the
  // range simply reads as invalid until one of them is fixed.
  // Auto-advance: start time → end date.
  if (v) openEndDate()
}
function onEndTime(v: Date | null) {
  // Keep what the user picked, even when it's before the start.
  //
  // This used to silently snap an invalid end forward to start + 1h. The
  // intention was kind — don't let them build a broken range — but the effect
  // was that choosing 8am put 10am in the box: the control answered a question
  // nobody asked, and the person is left wondering what they did wrong. An
  // invalid choice should be SHOWN as invalid, not quietly replaced.
  emit('update:endTime', v)
  emit('change')
}

/**
 * Is the current range impossible — an end at or before the start on one day?
 *
 * Only meaningful when both ends sit on the same calendar day: an 8pm → 6am
 * overnight event is perfectly valid.
 */
const endTimeInvalid = computed(() => {
  if (!props.showTime || props.isAllDay) return false
  if (!props.startTime || !props.endTime) return false
  if (!sameDay(props.startDate, props.endDate)) return false
  return minsOfDay(props.endTime) <= minsOfDay(props.startTime)
})

</script>

<!-- NOTE: this used to shrink .p-datepicker-input to 13px so a dd/mm/yyyy value
     stopped clipping. That made date inputs SMALLER than the text inputs beside
     them — a third size in a row that already had two. The real fix was to make
     every form control one size (14px) app-wide; see the form-control type rule
     in assets/css/main.css. -->

<!-- NB `.dt-day` / `.dt-day--marked` are GLOBAL (assets/css/main.css), not scoped here:
     a marked day is a visual convention shared by every date picker that shows context
     — this editor and the event card's Sign Up row so far — and two copies of the
     colours would drift the moment one is tweaked. -->

