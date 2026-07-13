<template>
  <div class="divide-y divide-gray-100">
    <!-- When + All day.
         One line on wide screens: [start date][start time] → [end date][end time] [all day].
         Below lg the four pickers can't breathe side by side, so each half
         (start / end) stacks and the arrow is dropped. -->
    <div class="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4" :class="rowPadding">
      <span class="text-sm shrink-0" :class="[labelWidth, labelClass]">
        {{ label }}<span v-if="required && label" class="text-red-400 ml-0.5">*</span>
      </span>
      <div class="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-3 flex-1 w-full min-w-0">
        <!-- Start -->
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <DatePicker :model-value="startDate" :manual-input="false" show-icon date-format="dd/mm/yy" :placeholder="`${startLabel} date`" fluid class="flex-1 min-w-0"
            :min-date="minStartDate"
            :max-date="maxDate ?? undefined"
            @update:model-value="onStartDate" />
          <DatePicker :model-value="startTime" time-only show-icon hour-format="12" :placeholder="`${startLabel} time`" fluid class="flex-1 min-w-0"
            :disabled="isAllDay"
            @update:model-value="onStartTime" />
        </div>
        <span class="text-sm text-gray-300 shrink-0 hidden lg:inline">→</span>
        <!-- End -->
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <DatePicker :model-value="endDate" :manual-input="false" show-icon date-format="dd/mm/yy" :placeholder="`${endLabel} date`" fluid class="flex-1 min-w-0"
            :min-date="minEndDate ?? startDate ?? undefined"
            :max-date="maxDate ?? undefined"
            @update:model-value="onEndDate" />
          <DatePicker :model-value="endTime" time-only show-icon hour-format="12" :placeholder="`${endLabel} time`" fluid class="flex-1 min-w-0"
            :disabled="isAllDay"
            @update:model-value="onEndTime" />
        </div>
        <!-- All day -->
        <div v-if="showAllDay" class="flex items-center gap-2 shrink-0">
          <span class="text-xs text-gray-500 lg:hidden">All day</span>
          <ToggleSwitch :model-value="isAllDay" v-tooltip.top="'All day'"
            @update:model-value="emit('update:isAllDay', $event)" />
        </div>
      </div>
    </div>
    <!-- Outside event dates (session-only affordance) -->
    <div v-if="showOutsideEventDates" class="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4" :class="rowPadding">
      <span class="text-sm text-gray-500 shrink-0" :class="labelWidth">Outside</span>
      <div class="flex items-center gap-2 w-full">
        <ToggleSwitch :model-value="outsideEventDates" @update:model-value="emit('update:outsideEventDates', $event)" />
        <span class="text-xs text-gray-400">Allow a date outside the event's range</span>
      </div>
    </div>
    <!-- Repeat (dropdown + exclusions calendar) -->
    <div v-if="showRepeat" class="flex flex-col sm:flex-row sm:items-start gap-1.5 sm:gap-4" :class="rowPadding">
      <span class="text-sm text-gray-500 shrink-0 sm:pt-2" :class="labelWidth">Repeat</span>
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
}>(), {
  isAllDay: false,
  repeat: 'NONE',
  showAllDay: true,
  showRepeat: true,
  label: 'Date',
  required: false,
  startLabel: 'Start',
  endLabel: 'End',
  showOutsideEventDates: false,
  outsideEventDates: false,
  rowPadding: 'px-5 py-3',
  labelWidth: 'w-12',
  labelClass: 'text-gray-500',
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

function onStartDate(v: Date | null) {
  emit('update:startDate', v)
  if (v && props.endDate && v > props.endDate) emit('update:endDate', null)
  emit('change')
}
function onEndDate(v: Date | null) { emit('update:endDate', v); emit('change') }
function onStartTime(v: Date | null) { emit('update:startTime', v); emit('change') }
function onEndTime(v: Date | null) { emit('update:endTime', v); emit('change') }

</script>
