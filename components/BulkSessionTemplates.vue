<template>
  <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
    <div class="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
      <div>
        <h3 class="text-sm font-semibold text-gray-700">Daily Session Templates</h3>
        <p class="text-xs text-gray-400 mt-0.5">Each template creates one session per day across the whole programme.</p>
      </div>
      <span v-if="totalSessions > 0" class="text-xs font-semibold px-3 py-1 rounded-full bg-primary/10 text-primary">
        {{ totalSessions }} sessions total
      </span>
    </div>

    <div v-if="layout !== 'panels'" class="overflow-x-auto">
    <div class="min-w-[600px] md:min-w-0">
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
      <span v-if="showLocation">Location</span>
      <span />
    </div>

    <!-- Template rows -->
    <div v-for="(tpl, idx) in templates" :key="idx"
      class="grid gap-2 items-center pr-5 py-2.5 border-b border-gray-100 last:border-0 transition-opacity"
      :class="dragIdx === idx ? 'opacity-40' : dragOverIdx === idx ? 'ring-2 ring-inset ring-primary' : ''"
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
      <!-- Per-session location — same button+dialog as the group session-times editor -->
      <button v-if="showLocation" type="button"
        class="h-9 text-sm text-left px-2.5 rounded-lg border border-gray-200 bg-white hover:border-gray-300 inline-flex items-center justify-between gap-2 w-full"
        @click="locDialogIdx = idx">
        <span :class="locSummary(tpl) ? 'text-gray-700 truncate' : 'text-gray-400'">{{ locSummary(tpl) || 'Choose location…' }}</span>
        <i class="pi pi-pencil text-[10px] text-gray-400 shrink-0" />
      </button>
      <button
        class="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
        :class="templates.length > 1 ? 'text-gray-300 hover:text-red-400 hover:bg-red-50' : 'text-gray-200 cursor-not-allowed'"
        :disabled="templates.length <= 1"
        @click="() => { if (templates.length > 1) templates.splice(idx, 1) }">
        <i class="pi pi-times text-sm" />
      </button>
    </div>

    </div>
    </div>

    <!-- ── Divider-separated sessions (one per row, title above every field) ── -->
    <div v-else class="divide-y divide-gray-100">
      <div v-for="(tpl, idx) in templates" :key="idx"
        class="px-5 py-4 sm:py-5 transition-colors"
        :class="dragIdx === idx ? 'opacity-40' : dragOverIdx === idx ? 'bg-primary/5' : ''"
        draggable="true"
        @dragstart="dragIdx = idx"
        @dragover.prevent="dragOverIdx = idx"
        @drop.prevent="onDrop(idx)"
        @dragend="dragIdx = null; dragOverIdx = null">

      <div class="flex items-start gap-3">
        <i class="pi pi-bars text-xs text-gray-300 cursor-grab shrink-0 mt-2.5" />

        <!-- Every field is a labeled row on one aligned left column -->
        <div class="flex-1 min-w-0 space-y-2.5">
          <div class="flex items-center gap-3">
            <label class="text-xs font-semibold text-gray-500 w-16 shrink-0">Name</label>
            <InputText v-model="tpl.name"
              :placeholder="idx === 0 ? 'e.g. Morning' : idx === 1 ? 'e.g. Afternoon' : 'Session name'"
              class="flex-1 min-w-0 h-9 text-sm" />
          </div>

          <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
            <label class="text-xs font-semibold text-gray-500 w-16 shrink-0">Time</label>
            <DatePicker v-model="tpl.startTime" timeOnly hourFormat="12" placeholder="9:00 AM" class="w-28" inputClass="h-9 text-sm px-2"
              @update:model-value="v => onStartTimeChange(idx, v)" />
            <span class="text-gray-300 text-sm">→</span>
            <DatePicker v-model="tpl.endTime" timeOnly hourFormat="12" placeholder="12:00 PM" class="w-28" inputClass="h-9 text-sm px-2"
              @update:model-value="v => onEndTimeChange(idx, v)" />
            <label class="text-xs font-semibold text-gray-500 shrink-0 ml-3">Capacity</label>
            <InputNumber v-model="tpl.limit" :min="1" placeholder="∞" class="w-24" inputClass="h-9 text-sm text-center w-full px-2" />
          </div>

          <div v-if="!showFees" class="flex items-center gap-3">
            <label class="text-xs font-semibold text-gray-500 w-16 shrink-0">Cost</label>
            <div class="relative flex items-center w-40">
              <span class="absolute left-3 text-gray-400 text-sm pointer-events-none z-10">$</span>
              <InputNumber v-model="tpl.cost" :min="0" :minFractionDigits="2" :maxFractionDigits="2" placeholder="0.00" class="w-full" inputClass="pl-6 pr-2 h-9 text-sm text-right w-full" />
            </div>
          </div>

          <div v-if="showLocation" class="flex items-center gap-3">
            <label class="text-xs font-semibold text-gray-500 w-16 shrink-0">Location</label>
            <button type="button"
              class="flex-1 min-w-0 h-9 text-sm text-left px-2.5 rounded-lg border border-gray-200 bg-white hover:border-gray-300 inline-flex items-center gap-2"
              @click="locDialogIdx = idx">
              <i class="pi pi-map-marker text-xs shrink-0" :class="locSummary(tpl) ? 'text-primary' : 'text-gray-300'" />
              <span class="flex-1 truncate" :class="locSummary(tpl) ? 'text-gray-700' : 'text-gray-400'">{{ locSummary(tpl) || 'Choose location…' }}</span>
              <i class="pi pi-pencil text-[10px] text-gray-400 shrink-0" />
            </button>
          </div>

          <!-- Fee — a fee can have multiple line items (the shared editor) -->
          <div v-if="showFees" class="flex items-start gap-3">
            <label class="text-xs font-semibold text-gray-500 w-16 shrink-0 pt-2">Fee</label>
            <div class="flex-1 min-w-0">
              <FeeLineItemsTable :model-value="tpl.fees ?? []"
                @update:model-value="(v: FeeLineItem[]) => tpl.fees = v" />
            </div>
          </div>
        </div>

        <button
          class="flex items-center justify-center w-7 h-7 rounded-lg shrink-0 mt-1 transition-colors"
          :class="templates.length > 1 ? 'text-gray-300 hover:text-red-400 hover:bg-red-50' : 'text-gray-200 cursor-not-allowed'"
          :disabled="templates.length <= 1"
          @click="() => { if (templates.length > 1) templates.splice(idx, 1) }">
          <i class="pi pi-times text-sm" />
        </button>
      </div>
      </div>
    </div>

    <div class="px-5 py-3.5 flex justify-end border-t border-gray-100">
      <Button label="Add session" icon="pi pi-plus" size="small" severity="secondary" outlined @click="addTemplate" />
    </div>

    <!-- Session location picker — the shared <LocationEditor> in a dialog -->
    <Dialog :visible="locDialogIdx !== null" @update:visible="v => { if (!v) locDialogIdx = null }"
      modal header="Session location" :style="{ width: '95vw', maxWidth: '640px' }">
      <LocationEditor v-if="locDialogIdx !== null"
        :model-value="templates[locDialogIdx].location ?? []" :multi="false"
        @update:model-value="(v: LocationEntry[]) => { templates[locDialogIdx!].location = v }"
        @update:summary="(s: string) => { if (locDialogIdx !== null) templates[locDialogIdx].locationLabel = s }" />
      <template #footer>
        <Button label="Done" size="small" @click="locDialogIdx = null" style="background:var(--brand-primary); border-color:var(--brand-primary)" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed, ref } from 'vue'

import type { LocationEntry } from '~/composables/useLocation'
import type { FeeLineItem } from '~/composables/useFeeGroups'
// locationSummary is a module-level export auto-imported by Nuxt (no useLocation()).

export interface BulkTemplate {
  name: string
  cost: number | null
  startTime: Date | null
  endTime: Date | null
  limit: number | null
  bookableId?: string | null
  location?: LocationEntry[]
  // Resolved location text (venue names etc.) captured from <LocationEditor>'s
  // @update:summary, since the pure locationSummary() can't resolve venue ids.
  locationLabel?: string
  fees?: FeeLineItem[]
}

const props = defineProps<{
  modelValue: BulkTemplate[]
  bookableTree?: any[]
  daysCount?: number
  // Opt-in: a full Address/Venue/Online location per session template (a button
  // per row → dialog). Off by default so the advanced builder / [id] Sessions
  // tab keep their existing bookable-venue column.
  showLocation?: boolean
  // 'table' (default, compact grid) or 'panels' (roomy full-width stacked cards).
  layout?: 'table' | 'panels'
  // Opt-in: a full fee editor per session (multiple line items) instead of a
  // single Cost field. Panels layout only.
  showFees?: boolean
}>()

function emptyLocation(): LocationEntry {
  return { type: 'ADDRESS', venue_name: '', address: '', meeting_link: '', bookable_ids: [] }
}
function locSummary(tpl: BulkTemplate) {
  // Prefer the editor's resolved text (has real venue names); fall back to the
  // pure summary for address/online set before the dialog was ever opened.
  if (tpl.locationLabel && tpl.locationLabel !== 'No location') return tpl.locationLabel
  const m = tpl.location?.length ? locationSummary(tpl.location) : ''
  return (m && m !== 'No location' && m !== 'Venue') ? m : ''
}

const locDialogIdx = ref<number | null>(null)

const emit = defineEmits<{
  'update:modelValue': [BulkTemplate[]]
}>()

const templates = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})

const totalSessions = computed(() => (props.daysCount ?? 0) * templates.value.filter(t => t.name.trim()).length)

const hasLocation = computed(() => (props.bookableTree?.length ?? 0) > 0)

const colStyle = computed(() => {
  const mid = '28px 1fr 80px 95px 95px 55px'
  const venue = hasLocation.value ? ' 200px' : ''
  const loc = props.showLocation ? ' 180px' : ''
  return `grid-template-columns: ${mid}${venue}${loc} 28px`
})

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
    location: [emptyLocation()],
    fees: [],
  }
  emit('update:modelValue', [...templates.value, newTpl])
}
</script>
