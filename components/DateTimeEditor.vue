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
            @update:model-value="onStartDate" />
          <TimeWheel v-if="showTime" :model-value="startTime" :placeholder="`${startLabel} time`" class="flex-1 min-w-0"
            :disabled="isAllDay"
            @update:model-value="onStartTime" />
        </div>
        <span v-if="!stack" class="text-sm text-gray-300 shrink-0 hidden lg:inline">→</span>
        <!-- End -->
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <DatePicker ref="endDateRef" :model-value="endDate" :manual-input="false" show-icon date-format="dd/mm/yy" :placeholder="`${endLabel} date`" fluid class="flex-1 min-w-0"
            :min-date="minEndDate ?? startDate ?? undefined"
            :max-date="maxDate ?? undefined"
            @update:model-value="onEndDate" />
          <TimeWheel v-if="showTime" :model-value="endTime" :placeholder="`${endLabel} time`" class="flex-1 min-w-0"
            :disabled="isAllDay"
            @update:model-value="onEndTime" />
        </div>
        <!-- All day -->
        <div v-if="showAllDay" class="flex items-center gap-2 shrink-0">
          <span class="text-xs text-gray-500" :class="stack ? '' : 'lg:hidden'">All day</span>
          <ToggleSwitch :model-value="isAllDay" v-tooltip.top="'All day'"
            @update:model-value="emit('update:isAllDay', $event)" />
        </div>
      </div>
    </div>
    <!-- Outside event dates (session-only affordance) -->
    <div v-if="showOutsideEventDates" class="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4" :class="rowPadding">
      <span class="field-label shrink-0" :class="labelWidth">Outside</span>
      <div class="flex items-center gap-2 w-full">
        <ToggleSwitch :model-value="outsideEventDates" @update:model-value="emit('update:outsideEventDates', $event)" />
        <span class="text-xs text-gray-400">Allow a date outside the event's range</span>
      </div>
    </div>
    <!-- Repeat (dropdown + exclusions calendar) -->
    <div v-if="showRepeat" class="flex flex-col sm:flex-row sm:items-start gap-1.5 sm:gap-4" :class="rowPadding">
      <span class="field-label shrink-0 sm:pt-2" :class="labelWidth">Repeat</span>
      <RepeatField
        :model-value="repeat"
        :exdates="exdates"
        :base-date="startDate"
        :range-end="maxDate ?? null"
        :show-custom="showCustomRepeat"
        @update:model-value="emit('update:repeat', $event)"
        @update:exdates="emit('update:exdates', $event)"
        @customRepeat="emit('customRepeat')" />
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
  showRepeat?: boolean
  // Hide the time pickers for a date-only range (keeps the date → date arrow).
  showTime?: boolean
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
// Compare TIME-OF-DAY only, never the full timestamp: the two time pickers each carry
// their own calendar day, so `endTime <= startTime` on raw Dates gives wrong answers
// across days. On a same-day event we only care about the clock time.
function minsOfDay(d: Date) { return d.getHours() * 60 + d.getMinutes() }

const endDateRef = ref()
function onStartDate(v: Date | null) {
  emit('update:startDate', v)
  // End date before the new start → drop it rather than keep an invalid range.
  if (v && props.endDate && v > props.endDate) emit('update:endDate', null)
  emit('change')
  syncEndTime(props.startTime, props.endTime)
  // Guide the user to the next box: once a start is picked and no end is set,
  // open the end-date picker (focusing its input pops the panel).
  if (v && !props.endDate) {
    nextTick(() => (endDateRef.value?.$el?.querySelector('input') as HTMLInputElement | undefined)?.focus())
  }
}
function onEndDate(v: Date | null) {
  emit('update:endDate', v)
  emit('change')
  // Collapsing a multi-day event back onto one day can strand the end time.
  syncEndTime(props.startTime, props.endTime, v)
}
function onStartTime(v: Date | null) {
  emit('update:startTime', v)
  emit('change')
  syncEndTime(v, props.endTime)
}
function onEndTime(v: Date | null) {
  // Reject an end that's at or before the start on the same day — snap it forward.
  if (v && props.startTime && sameDay(props.startDate, props.endDate) && minsOfDay(v) <= minsOfDay(props.startTime)) {
    emit('update:endTime', plusHour(props.startTime))
    emit('change')
    return
  }
  emit('update:endTime', v)
  emit('change')
}

// Keeps the end time valid after the start (or the dates) move under it.
function syncEndTime(start: Date | null, end: Date | null, endDate: Date | null = props.endDate) {
  if (!start || !end) return
  if (!sameDay(props.startDate, endDate)) return
  if (minsOfDay(end) > minsOfDay(start)) return
  emit('update:endTime', plusHour(start))
  emit('change')
}

</script>

<!-- NOTE: this used to shrink .p-datepicker-input to 13px so a dd/mm/yyyy value
     stopped clipping. That made date inputs SMALLER than the text inputs beside
     them — a third size in a row that already had two. The real fix was to make
     every form control one size (14px) app-wide; see the form-control type rule
     in assets/css/main.css. -->
