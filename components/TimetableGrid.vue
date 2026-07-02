<!--
  TimetableGrid — a true time-of-day × weekday timetable for the club's classes.
  Vertical axis = time (auto-fit to the day's sessions, hourly gridlines), columns =
  Mon–Sun. Each class is an absolutely-positioned block, colour-coded by its
  code/programme, with side-by-side lanes for overlaps and a live "now" line on
  today. Desktop grid only — the page shows an agenda list on mobile.
-->
<script setup lang="ts">
import { minLabel, layoutDay, type TimetableSession } from '~/composables/useClassTimetable'

const props = withDefaults(defineProps<{ sessions: TimetableSession[]; hourHeight?: number }>(), { hourHeight: 72 })
const emit = defineEmits<{ (e: 'select', s: TimetableSession): void }>()

// Display order Mon→Sun; data uses 0=Sun..6=Sat.
const DAYS = [{ d: 1, label: 'Mon' }, { d: 2, label: 'Tue' }, { d: 3, label: 'Wed' }, { d: 4, label: 'Thu' }, { d: 5, label: 'Fri' }, { d: 6, label: 'Sat' }, { d: 0, label: 'Sun' }]

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

const byDay = computed(() => {
  const out: Record<number, (TimetableSession & { lane: number; cols: number })[]> = {}
  for (const { d } of DAYS) out[d] = layoutDay(props.sessions.filter(s => s.day === d))
  return out
})

function blockStyle(s: TimetableSession & { lane: number; cols: number }) {
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
function fillClass(s: TimetableSession) {
  if (s.capacity == null) return 'bg-white/70 text-gray-500'
  if (s.count > s.capacity) return 'bg-red-100 text-red-700'
  if (s.count >= s.capacity) return 'bg-amber-100 text-amber-700'
  if (s.count / s.capacity >= 0.8) return 'bg-amber-50 text-amber-600'
  return 'bg-white/70 text-gray-500'
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
      <div class="min-w-[860px]">
        <!-- header row -->
        <div class="grid sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-200"
          :style="{ gridTemplateColumns: '60px repeat(7, minmax(108px, 1fr))' }">
          <div class="py-2.5" />
          <div v-for="col in DAYS" :key="col.d"
            class="py-2.5 text-center border-l border-gray-100"
            :class="col.d === nowDay ? 'bg-primary/5' : ''">
            <span class="text-xs font-bold uppercase tracking-wide" :class="col.d === nowDay ? 'text-primary' : 'text-gray-500'">{{ col.label }}</span>
          </div>
        </div>

        <!-- body -->
        <div class="grid" :style="{ gridTemplateColumns: '60px repeat(7, minmax(108px, 1fr))' }">
          <!-- time gutter -->
          <div class="relative" :style="{ height: gridHeight + 'px' }">
            <div v-for="h in hours" :key="h" class="absolute right-2 -translate-y-1/2 text-[11px] font-medium text-gray-400 tabular-nums"
              :style="{ top: (h - range.startHour) * hourHeight + 'px' }">{{ minLabel(h * 60) }}</div>
          </div>

          <!-- day columns -->
          <div v-for="col in DAYS" :key="col.d" class="relative border-l border-gray-100"
            :class="col.d === nowDay ? 'bg-primary/[0.02]' : ''"
            :style="{ height: gridHeight + 'px', backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${hourHeight - 1}px, rgb(243 244 246) ${hourHeight - 1}px, rgb(243 244 246) ${hourHeight}px)` }">

            <!-- now line -->
            <div v-if="col.d === nowDay && nowTop != null" class="absolute left-0 right-0 z-10 pointer-events-none" :style="{ top: nowTop + 'px' }">
              <div class="h-px bg-rose-500/80" />
              <div class="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-rose-500 shadow" />
            </div>

            <!-- class blocks -->
            <button v-for="s in byDay[col.d]" :key="s.id" type="button"
              class="group absolute rounded-lg border text-left overflow-hidden transition-all hover:z-30 hover:shadow-lg hover:-translate-y-px focus:outline-none focus:ring-2 focus:ring-primary/40"
              :style="blockStyle(s)" @click="emit('select', s)"
              v-tooltip.top="`${s.groupName}\n${s.startLabel}–${s.endLabel}${s.coach ? ' · ' + s.coach : ''}${s.venue ? ' · ' + s.venue : ''}${s.capacity != null ? ' · ' + s.count + '/' + s.capacity : ''}`">
              <span class="absolute inset-y-0 left-0 w-1" :style="{ background: s.color }" />
              <div class="pl-2.5 pr-1.5 py-1 h-full flex flex-col min-w-0">
                <p class="text-[11px] font-semibold text-gray-800 leading-tight line-clamp-2">{{ s.groupName }}</p>
                <p class="text-[10px] text-gray-400 mt-0.5 tabular-nums truncate">{{ s.startLabel }}–{{ s.endLabel }}</p>
                <div class="mt-auto flex items-center gap-1 flex-wrap pt-0.5">
                  <span v-if="s.capacity != null || s.count" class="text-[9px] font-semibold px-1 py-px rounded" :class="fillClass(s)">{{ s.count }}<template v-if="s.capacity != null">/{{ s.capacity }}</template></span>
                  <span v-if="s.coach" class="text-[9px] text-gray-400 truncate min-w-0">{{ s.coach }}</span>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
