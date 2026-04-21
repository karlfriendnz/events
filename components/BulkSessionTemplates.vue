<template>
  <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
    <div class="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
      <div>
        <h3 class="text-sm font-semibold text-gray-700">Daily Session Templates</h3>
        <p class="text-xs text-gray-400 mt-0.5">Each template creates one session per day across the whole programme.</p>
      </div>
      <span v-if="totalSessions > 0" class="text-xs font-semibold px-3 py-1 rounded-full bg-[#1E2157]/10 text-[#1E2157]">
        {{ totalSessions }} sessions total
      </span>
    </div>

    <!-- Column headers -->
    <div class="grid gap-2 py-2.5 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wide"
      :style="colStyle">
      <span />
      <span class="pl-1">Session Name</span>
      <span>Cost</span>
      <span>Start</span>
      <span>End</span>
      <span>Limit</span>
      <span v-if="bookableTree?.length">Location</span>
      <span />
    </div>

    <!-- Template rows -->
    <div v-for="(tpl, idx) in templates" :key="idx"
      class="grid gap-2 items-center pr-5 py-2.5 border-b border-gray-100 last:border-0 transition-opacity"
      :class="dragIdx === idx ? 'opacity-40' : dragOverIdx === idx ? 'ring-2 ring-inset ring-[#1E2157]' : ''"
      :style="colStyle"
      draggable="true"
      @dragstart="dragIdx = idx"
      @dragover.prevent="dragOverIdx = idx"
      @drop.prevent="onDrop(idx)"
      @dragend="dragIdx = null; dragOverIdx = null">
      <i class="pi pi-bars text-xs text-gray-300 cursor-grab ml-3" />
      <InputText v-model="tpl.name" :placeholder="idx === 0 ? 'e.g. Morning' : idx === 1 ? 'e.g. Afternoon' : 'Session name'" class="h-9 text-sm w-full" />
      <div class="relative flex items-center">
        <span class="absolute left-3 text-gray-400 text-sm pointer-events-none">$</span>
        <InputNumber v-model="tpl.cost" :min="0" :minFractionDigits="2" :maxFractionDigits="2" placeholder="0.00" class="w-full" inputClass="pl-6 pr-2 h-9 text-sm text-right w-full" />
      </div>
      <DatePicker v-model="tpl.startTime" timeOnly hourFormat="12" placeholder="9:00 AM" class="w-full" inputClass="h-9 text-sm px-2"
        @update:model-value="v => onStartTimeChange(idx, v)" />
      <DatePicker v-model="tpl.endTime" timeOnly hourFormat="12" placeholder="12:00 PM" class="w-full" inputClass="h-9 text-sm px-2"
        @update:model-value="v => onEndTimeChange(idx, v)" />
      <InputNumber v-model="tpl.limit" :min="1" placeholder="∞" inputClass="h-9 text-sm text-right w-full px-2" style="width:60px" />
      <TreeSelect v-if="bookableTree?.length"
        :modelValue="tpl.bookableId ? { [tpl.bookableId]: true } : null"
        :options="bookableTree"
        selectionMode="single"
        placeholder="No venue"
        class="w-full h-9 text-sm"
        @node-select="(n: any) => tpl.bookableId = n.key"
        @node-unselect="() => tpl.bookableId = null" />
      <button
        class="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
        :class="templates.length > 1 ? 'text-gray-300 hover:text-red-400 hover:bg-red-50' : 'text-gray-200 cursor-not-allowed'"
        :disabled="templates.length <= 1"
        @click="() => { if (templates.length > 1) templates.splice(idx, 1) }">
        <i class="pi pi-times text-sm" />
      </button>
    </div>

    <div class="px-5 py-3.5 flex justify-end border-t border-gray-100">
      <Button label="Add Session Type" icon="pi pi-plus" size="small" severity="secondary" outlined @click="addTemplate" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed, ref } from 'vue'

export interface BulkTemplate {
  name: string
  cost: number | null
  startTime: Date | null
  endTime: Date | null
  limit: number | null
  bookableId?: string | null
}

const props = defineProps<{
  modelValue: BulkTemplate[]
  bookableTree?: any[]
  daysCount?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [BulkTemplate[]]
}>()

const templates = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})

const totalSessions = computed(() => (props.daysCount ?? 0) * templates.value.filter(t => t.name.trim()).length)

const hasLocation = computed(() => (props.bookableTree?.length ?? 0) > 0)

const colStyle = computed(() =>
  hasLocation.value
    ? 'grid-template-columns: 28px 1fr 80px 95px 95px 55px 200px 28px'
    : 'grid-template-columns: 28px 1fr 80px 95px 95px 55px 28px'
)

const dragIdx = ref<number | null>(null)
const dragOverIdx = ref<number | null>(null)

function onDrop(toIdx: number) {
  const fromIdx = dragIdx.value
  if (fromIdx === null || fromIdx === toIdx) return
  const arr = [...templates.value]
  const [moved] = arr.splice(fromIdx, 1)
  arr.splice(toIdx, 0, moved)
  emit('update:modelValue', arr)
}

function minutesFromDate(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}

function addMinutesToDate(base: Date, mins: number): Date {
  const d = new Date(base)
  d.setHours(Math.floor(mins / 60) % 24, mins % 60, 0, 0)
  return d
}

function onStartTimeChange(idx: number, v: Date | null) {
  if (!v) return
  const tpl = templates.value[idx]
  // If end time is before or equal to start time, push end time 1 hour forward
  if (tpl.endTime) {
    const startMins = minutesFromDate(v)
    const endMins = minutesFromDate(tpl.endTime)
    if (endMins <= startMins) {
      tpl.endTime = addMinutesToDate(v, startMins + 60)
    }
  }
}

function onEndTimeChange(idx: number, v: Date | null) {
  if (!v) return
  const tpl = templates.value[idx]
  // If end time is before or equal to start time, push start time back 1 hour
  if (tpl.startTime) {
    const startMins = minutesFromDate(tpl.startTime)
    const endMins = minutesFromDate(v)
    if (endMins <= startMins) {
      tpl.startTime = addMinutesToDate(v, endMins - 60 < 0 ? 0 : endMins - 60)
    }
  }
}

function addTemplate() {
  const last = templates.value[templates.value.length - 1]
  // Start time = last row's end time (or 1h after last start)
  let startTime: Date | null = null
  let endTime: Date | null = null
  if (last?.endTime) {
    startTime = new Date(last.endTime)
    const endMins = minutesFromDate(last.endTime) + 60
    endTime = addMinutesToDate(last.endTime, endMins)
  }
  const newTpl: BulkTemplate = {
    name: '',
    cost: null,
    startTime,
    endTime,
    limit: null,
    bookableId: null,
  }
  emit('update:modelValue', [...templates.value, newTpl])
}
</script>
