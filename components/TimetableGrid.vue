<!--
  TimetableGrid — a true time-of-day × weekday timetable for the club's classes.
  Vertical axis = time (auto-fit to the day's sessions, hourly gridlines), columns =
  Mon–Sun. Each class is an absolutely-positioned block, colour-coded by its
  code/programme, with side-by-side lanes for overlaps and a live "now" line on today.

  DENSITY-ADAPTIVE: when too many classes run at once (lanes would be unreadable),
  that overlap cluster collapses into ONE summary card ("10 classes" grouped by start
  time, with a colour dot per class) that opens a drill-in dialog. Quiet overlaps
  (≤ maxLanes concurrent) still render as normal readable blocks — and because the
  layout is derived from the *filtered* set, narrowing a filter dissolves the summary
  cards back into blocks. Desktop grid only — the page shows an agenda list on mobile.
-->
<script setup lang="ts">
import { minLabel, type TimetableSession } from '~/composables/useClassTimetable'

const props = withDefaults(defineProps<{ sessions: TimetableSession[]; hourHeight?: number; maxLanes?: number; focusDay?: number | null }>(), { hourHeight: 72, maxLanes: 4, focusDay: null })
const emit = defineEmits<{ (e: 'select', s: TimetableSession): void; (e: 'focus-day', d: number): void; (e: 'clear-focus'): void }>()

// Display order Mon→Sun; data uses 0=Sun..6=Sat.
const DAYS = [{ d: 1, label: 'Mon' }, { d: 2, label: 'Tue' }, { d: 3, label: 'Wed' }, { d: 4, label: 'Thu' }, { d: 5, label: 'Fri' }, { d: 6, label: 'Sat' }, { d: 0, label: 'Sun' }]
const FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Day view: focusDay pins to one day full-width. With the whole width to itself,
// even 10 concurrent classes get readable lanes — so density collapse is disabled.
const displayDays = computed(() => props.focusDay == null ? DAYS : DAYS.filter(x => x.d === props.focusDay))
const gridCols = computed(() => props.focusDay == null ? '60px repeat(7, minmax(108px, 1fr))' : '60px minmax(0, 1fr)')
const effMaxLanes = computed(() => props.focusDay == null ? props.maxLanes : Infinity)

type Laid = TimetableSession & { lane: number; cols: number }
interface StartGroup { startMin: number; label: string; items: TimetableSession[] }
interface Summary { id: string; startMin: number; endMin: number; count: number; starts: StartGroup[] }

// Auto-fit the visible time window to the sessions (default 8am–6pm), rounded to the hour.
const range = computed(() => {
  if (!props.sessions.length) return { startHour: 8, endHour: 18 }
  let min = Infinity, max = -Infinity
  for (const s of props.sessions) { min = Math.min(min, s.startMin); max = Math.max(max, s.endMin) }
  return { startHour: Math.max(0, Math.floor(min / 60)), endHour: Math.min(24, Math.ceil(max / 60)) }
})
const startMin = computed(() => range.value.startHour * 60)
const gridHeight = computed(() => (range.value.endHour - range.value.startHour) * props.hourHeight)
const hours = computed(() => Array.from({ length: range.value.endHour - range.value.startHour + 1 }, (_, i) => range.value.startHour + i))

// Split a day's sessions into maximal-overlap clusters (transitively overlapping runs).
function clustersFor(items: TimetableSession[]): TimetableSession[][] {
  const evs = [...items].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)
  const out: TimetableSession[][] = []
  let cur: TimetableSession[] = [], end = -1
  for (const e of evs) {
    if (cur.length && e.startMin >= end) { out.push(cur); cur = []; end = -1 }
    cur.push(e); end = Math.max(end, e.endMin)
  }
  if (cur.length) out.push(cur)
  return out
}
// Assign side-by-side lanes within one cluster (google-calendar style). Returns peak concurrency (cols).
function laneAssign(cluster: TimetableSession[]): { laid: Laid[]; cols: number } {
  const laid = cluster.map(e => ({ ...e, lane: 0, cols: 1 })) as Laid[]
  const laneEnds: number[] = []
  for (const e of laid) {
    let i = 0
    for (; i < laneEnds.length; i++) if (laneEnds[i] <= e.startMin) break
    e.lane = i; laneEnds[i] = e.endMin
  }
  const cols = laneEnds.length
  for (const e of laid) e.cols = cols
  return { laid, cols }
}

// Per day: readable blocks for sparse clusters + a summary card for each over-dense one.
const byDay = computed(() => {
  const out: Record<number, { blocks: Laid[]; summaries: Summary[] }> = {}
  for (const { d } of displayDays.value) {
    const blocks: Laid[] = [], summaries: Summary[] = []
    for (const cluster of clustersFor(props.sessions.filter(s => s.day === d))) {
      const { laid, cols } = laneAssign(cluster)
      if (cols <= effMaxLanes.value) { blocks.push(...laid); continue }
      // collapse: group by start time + tally the programme (code) mix
      const cStart = Math.min(...cluster.map(c => c.startMin))
      const cEnd = Math.max(...cluster.map(c => c.endMin))
      const byStart = new Map<number, TimetableSession[]>()
      for (const c of cluster) { const a = byStart.get(c.startMin) ?? []; a.push(c); byStart.set(c.startMin, a) }
      const starts: StartGroup[] = [...byStart.entries()].sort((a, b) => a[0] - b[0])
        .map(([sm, items]) => ({ startMin: sm, label: minLabel(sm), items }))
      summaries.push({ id: `sum-${d}-${cStart}`, startMin: cStart, endMin: cEnd, count: cluster.length, starts })
    }
    out[d] = { blocks, summaries }
  }
  return out
})

function blockStyle(s: Laid) {
  const top = (s.startMin - startMin.value) / 60 * props.hourHeight
  const height = Math.max((s.endMin - s.startMin) / 60 * props.hourHeight - 3, 22)
  const gap = 3
  const widthPct = 100 / s.cols
  return {
    top: `${top}px`, height: `${height}px`,
    left: `calc(${s.lane * widthPct}% + 2px)`,
    width: `calc(${widthPct}% - ${gap + 2}px)`,
    background: s.color + '12', borderColor: s.color + '55',
  }
}
function summaryStyle(sm: Summary) {
  const top = (sm.startMin - startMin.value) / 60 * props.hourHeight
  const height = Math.max((sm.endMin - sm.startMin) / 60 * props.hourHeight - 3, 44)
  return { top: `${top}px`, height: `${height}px`, left: '2px', width: 'calc(100% - 5px)' }
}
function fillClass(s: TimetableSession) {
  if (s.capacity == null) return 'bg-white/70 text-gray-500'
  if (s.count > s.capacity) return 'bg-red-100 text-red-700'
  if (s.count >= s.capacity) return 'bg-amber-100 text-amber-700'
  if (s.count / s.capacity >= 0.8) return 'bg-amber-50 text-amber-600'
  return 'bg-white/70 text-gray-500'
}

// drill-in dialog
const openSummaryRef = ref<Summary | null>(null)
const dayLabelOf = ref('')
function openSummary(sm: Summary, dayLabel: string) { openSummaryRef.value = sm; dayLabelOf.value = dayLabel }
function pickFromSummary(s: TimetableSession) { openSummaryRef.value = null; emit('select', s) }
// When a class has space, jump to the group with its Add-person dialog open.
function addToGroup(s: TimetableSession) { openSummaryRef.value = null; navigateTo(`/groups/${s.groupId}?add=member`) }
function hasSpace(s: TimetableSession) { return s.capacity == null || s.count < s.capacity }
// Flatten the open cluster's start-groups into one time-sorted list for the table.
const summaryRows = computed(() => (openSummaryRef.value?.starts ?? []).flatMap(g => g.items))
// Consistent clock format for the modal — always H:MM AM/PM (e.g. "4:00 PM").
function fmtTime(mins: number): string {
  const h = Math.floor(mins / 60), m = mins % 60
  const ap = h >= 12 ? 'PM' : 'AM'
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`
}

// Live "now" indicator (Date is fine in a component).
const now = ref(new Date())
let timer: any = null
onMounted(() => { timer = setInterval(() => { now.value = new Date() }, 60000) })
onBeforeUnmount(() => timer && clearInterval(timer))
const nowDay = computed(() => now.value.getDay())
const nowTop = computed(() => {
  const mins = now.value.getHours() * 60 + now.value.getMinutes()
  if (mins < startMin.value || mins > range.value.endHour * 60) return null
  return (mins - startMin.value) / 60 * props.hourHeight
})
</script>

<template>
  <div class="card p-0 overflow-hidden">
    <div class="overflow-x-auto">
      <div :class="focusDay == null ? 'min-w-[860px]' : 'min-w-[420px]'">
        <!-- header row -->
        <div class="grid sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-200"
          :style="{ gridTemplateColumns: gridCols }">
          <div class="py-2.5 flex items-center justify-end pr-2">
            <button v-if="focusDay != null" type="button" @click="emit('clear-focus')"
              class="text-[11px] font-medium text-gray-400 hover:text-primary inline-flex items-center gap-1">
              <i class="pi pi-chevron-left text-[9px]" /> Week
            </button>
          </div>
          <div v-for="col in displayDays" :key="col.d"
            class="py-2.5 text-center border-l border-gray-100"
            :class="col.d === nowDay ? 'bg-primary/5' : ''">
            <button v-if="focusDay == null" type="button" @click="emit('focus-day', col.d)"
              class="text-xs font-bold uppercase tracking-wide transition-colors hover:text-primary"
              :class="col.d === nowDay ? 'text-primary' : 'text-gray-500'"
              v-tooltip.top="'View ' + FULL[col.d]">{{ col.label }}</button>
            <span v-else class="text-sm font-semibold" :class="col.d === nowDay ? 'text-primary' : 'text-gray-800'">{{ FULL[col.d] }}</span>
          </div>
        </div>

        <!-- body -->
        <div class="grid" :style="{ gridTemplateColumns: gridCols }">
          <!-- time gutter -->
          <div class="relative" :style="{ height: gridHeight + 'px' }">
            <div v-for="h in hours" :key="h" class="absolute right-2 -translate-y-1/2 text-[11px] font-medium text-gray-400 tabular-nums"
              :style="{ top: (h - range.startHour) * hourHeight + 'px' }">{{ minLabel(h * 60) }}</div>
          </div>

          <!-- day columns -->
          <div v-for="col in displayDays" :key="col.d" class="relative border-l border-gray-100"
            :class="col.d === nowDay ? 'bg-primary/[0.02]' : ''"
            :style="{ height: gridHeight + 'px', backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${hourHeight - 1}px, rgb(243 244 246) ${hourHeight - 1}px, rgb(243 244 246) ${hourHeight}px)` }">

            <!-- now line -->
            <div v-if="col.d === nowDay && nowTop != null" class="absolute left-0 right-0 z-10 pointer-events-none" :style="{ top: nowTop + 'px' }">
              <div class="h-px bg-rose-500/80" />
              <div class="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-rose-500 shadow" />
            </div>

            <!-- class blocks (sparse clusters) -->
            <button v-for="s in byDay[col.d].blocks" :key="s.id" type="button"
              class="group absolute rounded-lg border text-left overflow-hidden transition-all hover:z-30 hover:shadow-lg hover:-translate-y-px focus:outline-none focus:ring-2 focus:ring-primary/40"
              :style="blockStyle(s)" @click="emit('select', s)"
              v-tooltip.top="`${s.groupName}\n${s.startLabel}–${s.endLabel}${s.coach ? ' · ' + s.coach : ''}${s.venue ? ' · ' + s.venue : ''}${s.capacity != null ? ' · ' + s.count + '/' + s.capacity : ''}`">
              <span class="absolute inset-y-0 left-0 w-1" :style="{ background: s.color }" />
              <div class="pl-2.5 pr-1.5 py-1 h-full flex flex-col min-w-0">
                <p class="text-[11px] font-semibold text-gray-800 leading-tight line-clamp-2">{{ s.groupName }}</p>
                <p class="text-[10px] text-gray-400 mt-0.5 tabular-nums truncate">{{ s.startLabel }}–{{ s.endLabel }}</p>
                <p v-if="focusDay != null && s.venue" class="text-[10px] text-gray-400 mt-0.5 truncate flex items-center gap-1">
                  <i class="pi pi-map-marker text-[8px] shrink-0" />{{ s.venue }}
                </p>
                <div class="mt-auto flex items-center gap-1 flex-wrap pt-0.5">
                  <span v-if="s.capacity != null || s.count" class="text-[9px] font-semibold px-1 py-px rounded" :class="fillClass(s)">{{ s.count }}<template v-if="s.capacity != null">/{{ s.capacity }}</template></span>
                  <span v-if="s.coach" class="text-[9px] text-gray-400 truncate min-w-0">{{ s.coach }}</span>
                </div>
              </div>
            </button>

            <!-- density summary card (over-dense clusters) -->
            <button v-for="sm in byDay[col.d].summaries" :key="sm.id" type="button"
              class="absolute rounded-lg border border-gray-300 bg-white text-left overflow-hidden shadow-sm transition-all hover:z-30 hover:shadow-lg hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
              :style="summaryStyle(sm)" @click="openSummary(sm, col.label)"
              v-tooltip.top="`${sm.count} classes · ${minLabel(sm.startMin)}–${minLabel(sm.endMin)} — click to view`">
              <div class="px-2 py-1.5 h-full flex flex-col min-w-0">
                <div class="flex items-baseline justify-between gap-1">
                  <span class="text-[12px] font-bold text-gray-800 leading-none">{{ sm.count }} <span class="font-medium text-gray-500">classes</span></span>
                  <span class="text-[9px] text-gray-400 tabular-nums shrink-0">{{ minLabel(sm.startMin) }}</span>
                </div>
                <!-- by start time -->
                <div class="mt-1.5 space-y-0.5 overflow-hidden">
                  <div v-for="g in sm.starts" :key="g.startMin" class="flex items-center gap-1.5 min-w-0">
                    <span class="text-[10px] tabular-nums text-gray-500 w-11 shrink-0">{{ g.label }}</span>
                    <span class="text-[10px] font-semibold text-gray-700 shrink-0">{{ g.items.length }}</span>
                    <span class="flex items-center gap-px min-w-0 overflow-hidden">
                      <span v-for="c in g.items.slice(0, 8)" :key="c.id" class="w-1.5 h-1.5 rounded-full shrink-0" :style="{ background: c.color }" />
                    </span>
                  </div>
                </div>
                <span class="mt-auto text-[9px] font-medium text-primary/70 pt-1">View all →</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- drill-in dialog — the summary cluster as a table -->
  <Dialog :visible="!!openSummaryRef" modal :dismissableMask="true" :showHeader="false"
    @update:visible="v => { if (!v) openSummaryRef = null }" :style="{ width: '95vw', maxWidth: '820px' }" contentClass="!p-0">
    <div v-if="openSummaryRef" class="flex flex-col max-h-[80vh]">
      <div class="px-6 pt-5 pb-4 border-b border-gray-100 flex items-start justify-between gap-3">
        <div>
          <p class="text-sm font-semibold text-gray-900">{{ openSummaryRef.count }} classes on {{ dayLabelOf }}</p>
          <p class="text-xs text-gray-500 mt-0.5 tabular-nums">{{ fmtTime(openSummaryRef.startMin) }} – {{ fmtTime(openSummaryRef.endMin) }}</p>
        </div>
        <button class="text-gray-400 hover:text-gray-700 -mt-0.5" @click="openSummaryRef = null"><i class="pi pi-times" /></button>
      </div>
      <div class="overflow-auto px-4 py-2">
        <table class="w-full text-left border-collapse">
          <thead class="sticky top-0 bg-white">
            <tr class="text-[11px] font-semibold uppercase tracking-wide text-gray-400 border-b border-gray-200">
              <th class="w-1 p-0" />
              <th class="pl-3 pr-4 py-3 font-semibold">Class</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap">Time</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap">Coach</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap">Venue</th>
              <th class="px-4 py-3 font-semibold text-right whitespace-nowrap">Fill</th>
              <th class="pr-2 text-right whitespace-nowrap font-semibold">Availability</th>
              <th class="w-6" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in summaryRows" :key="s.id" @click="pickFromSummary(s)"
              class="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors">
              <!-- colour accent bar -->
              <td class="p-0"><span class="block w-1 h-9 rounded-full" :style="{ background: s.color }" /></td>
              <td class="pl-3 pr-4 py-4">
                <span class="text-sm font-medium text-gray-800">{{ s.groupName }}</span>
              </td>
              <td class="px-4 py-4 text-xs text-gray-500 tabular-nums whitespace-nowrap">{{ fmtTime(s.startMin) }} – {{ fmtTime(s.endMin) }}</td>
              <td class="px-4 py-4 text-xs text-gray-500 whitespace-nowrap">{{ s.coach || '—' }}</td>
              <td class="px-4 py-4 text-xs text-gray-500 whitespace-nowrap">{{ s.venue || '—' }}</td>
              <td class="px-4 py-4 text-right whitespace-nowrap">
                <span v-if="s.capacity != null" class="text-[11px] font-semibold px-1.5 py-0.5 rounded" :class="fillClass(s)">{{ s.count }}/{{ s.capacity }}</span>
                <span v-else class="text-xs text-gray-400">{{ s.count || '—' }}</span>
              </td>
              <td class="pr-2 text-right whitespace-nowrap">
                <button v-if="hasSpace(s)" type="button" @click.stop="addToGroup(s)"
                  v-tooltip.top="'Add someone — space available'"
                  class="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors inline-flex items-center gap-1">
                  <i class="pi pi-user-plus text-[9px]" />
                  <template v-if="s.capacity != null">{{ s.capacity - s.count }} {{ s.capacity - s.count === 1 ? 'space' : 'spaces' }}</template>
                  <template v-else>Open</template>
                </button>
                <span v-else class="text-[11px] font-medium text-gray-400">Full</span>
              </td>
              <td class="pr-2 text-right"><i class="pi pi-angle-right text-gray-300 text-xs" /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </Dialog>
</template>
