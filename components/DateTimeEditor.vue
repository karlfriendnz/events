<template>
  <div class="divide-y divide-gray-100">
    <!-- Date -->
    <div class="flex items-center gap-4" :class="rowPadding">
      <span class="text-sm text-gray-500 shrink-0" :class="labelWidth">Date</span>
      <DatePicker :model-value="startDate" :manual-input="false" show-icon date-format="dd/mm/yy" placeholder="Start date" class="flex-1"
        :min-date="minStartDate"
        :max-date="maxDate ?? undefined"
        @update:model-value="onStartDate" />
      <span class="text-sm text-gray-300 shrink-0">→</span>
      <DatePicker :model-value="endDate" :manual-input="false" show-icon date-format="dd/mm/yy" placeholder="End date" class="flex-1"
        :min-date="minEndDate ?? startDate ?? undefined"
        :max-date="maxDate ?? undefined"
        @update:model-value="onEndDate" />
    </div>
    <!-- Time -->
    <div class="flex items-center gap-4" :class="rowPadding">
      <span class="text-sm text-gray-500 shrink-0" :class="labelWidth">Time</span>
      <DatePicker :model-value="startTime" time-only show-icon hour-format="12" placeholder="Start" class="flex-1"
        :disabled="isAllDay"
        @update:model-value="onStartTime" />
      <span class="text-sm text-gray-300 shrink-0">→</span>
      <DatePicker :model-value="endTime" time-only show-icon hour-format="12" placeholder="End" class="flex-1"
        :disabled="isAllDay"
        @update:model-value="onEndTime" />
    </div>
    <!-- All day + Outside event dates -->
    <div class="flex items-center gap-4" :class="rowPadding">
      <span class="text-sm text-gray-500 shrink-0" :class="labelWidth">All day</span>
      <ToggleSwitch :model-value="isAllDay" @update:model-value="emit('update:isAllDay', $event)" />
      <div v-if="showOutsideEventDates" class="flex items-center gap-2 ml-auto">
        <span class="text-xs text-gray-400">Outside event dates</span>
        <ToggleSwitch :model-value="outsideEventDates" @update:model-value="emit('update:outsideEventDates', $event)" />
      </div>
    </div>
    <!-- Repeat -->
    <div class="flex items-center gap-4" :class="rowPadding">
      <span class="text-sm text-gray-500 shrink-0" :class="labelWidth">Repeat</span>
      <RepeatSelect :model-value="repeat" :date="startDate" :showCustom="showCustomRepeat" @update:model-value="emit('update:repeat', $event)" @customRepeat="emit('customRepeat')" />
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
  isAllDay: boolean
  repeat: string
  showCustomRepeat?: boolean
  showOutsideEventDates?: boolean
  outsideEventDates?: boolean
  minStartDate?: Date
  minEndDate?: Date
  maxDate?: Date | null
  rowPadding?: string
  labelWidth?: string
}>(), {
  showOutsideEventDates: false,
  outsideEventDates: false,
  rowPadding: 'px-5 py-3',
  labelWidth: 'w-12',
})

const emit = defineEmits<{
  (e: 'update:startDate', v: Date | null): void
  (e: 'update:endDate', v: Date | null): void
  (e: 'update:startTime', v: Date | null): void
  (e: 'update:endTime', v: Date | null): void
  (e: 'update:isAllDay', v: boolean): void
  (e: 'update:repeat', v: string): void
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
