<template>
  <div class="p-3 sm:p-6 space-y-4 sm:space-y-5">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="min-w-0">
        <h1 class="text-lg sm:text-2xl font-semibold text-gray-900 truncate">{{ event?.title || 'Programme' }}</h1>
        <p class="text-xs sm:text-sm text-gray-500 mt-0.5">
          {{ runs }} · {{ dates.length }} day{{ dates.length !== 1 ? 's' : '' }} · {{ sessionTypes.length }} session{{ sessionTypes.length !== 1 ? 's' : '' }} a day
        </p>
      </div>
      <NuxtLink :to="`/events/${route.params.id}`"
        class="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-600 hover:border-gray-300 shrink-0">
        <i class="pi pi-pencil text-xs" /> Edit programme
      </NuxtLink>
    </div>

    <!-- Overall fill -->
    <div class="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
      <div class="flex items-center justify-between text-sm mb-2">
        <span class="font-semibold text-gray-800">Overall availability</span>
        <span class="text-gray-500">
          <span class="font-semibold text-gray-800">{{ totals.booked }}</span> booked ·
          {{ totals.capacity ? `${totals.spaces} space${totals.spaces !== 1 ? 's' : ''} left of ${totals.capacity}` : 'no capacity set' }}
        </span>
      </div>
      <div class="h-2.5 rounded-full bg-gray-100 overflow-hidden">
        <div class="h-full rounded-full transition-[width]" :class="barColor(totals.booked, totals.capacity)"
          :style="{ width: totals.capacity ? Math.min(100, (totals.booked / totals.capacity) * 100) + '%' : '0%' }" />
      </div>
    </div>

    <div v-if="loading" class="bg-white rounded-xl border border-gray-200 py-16 text-center text-sm text-gray-400">Loading availability…</div>
    <div v-else-if="!sessions.length" class="bg-white rounded-xl border border-gray-200 py-16 text-center text-sm text-gray-400">
      This programme has no sessions yet.
    </div>

    <!-- Availability grid: dates × session types -->
    <div v-else class="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm border-collapse min-w-[560px]">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-200">
              <th class="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide sticky left-0 bg-gray-50 z-10">Date</th>
              <th v-for="tp in sessionTypes" :key="tp.title" class="text-left px-4 py-2.5 min-w-[150px]">
                <div class="text-sm font-semibold text-gray-800">{{ tp.title }}</div>
                <div class="text-xs text-gray-400 font-normal">{{ tp.timeLabel }}</div>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="d in dates" :key="d" class="hover:bg-gray-50/60">
              <td class="px-4 py-3 whitespace-nowrap font-medium text-gray-700 sticky left-0 bg-white z-10">{{ dateLabel(d) }}</td>
              <td v-for="tp in sessionTypes" :key="tp.title" class="px-4 py-3 align-top">
                <div v-if="grid[d] && grid[d][tp.title]">
                  <div class="flex items-center justify-between text-xs mb-1">
                    <span class="font-medium" :class="cellClass(grid[d][tp.title])">{{ cellLabel(grid[d][tp.title]) }}</span>
                    <span class="text-gray-400">{{ grid[d][tp.title].cap === null ? '∞' : `${grid[d][tp.title].booked}/${grid[d][tp.title].cap}` }}</span>
                  </div>
                  <div class="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div class="h-full rounded-full" :class="barColor(grid[d][tp.title].booked, grid[d][tp.title].cap)"
                      :style="{ width: barWidth(grid[d][tp.title]) }" />
                  </div>
                </div>
                <span v-else class="text-gray-300">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Cell { cap: number | null; booked: number; spaces: number; limited: boolean }

const db = useDb()
const route = useRoute()
const breadcrumbs = useBreadcrumbs()

const loading = ref(true)
const event = ref<any>(null)
const sessions = ref<any[]>([])
const bookedBySession = ref<Record<string, number>>({})

const dayKey = (iso: string | null) => iso ? new Date(iso).toISOString().slice(0, 10) : ''
const timeMins = (iso: string | null) => { if (!iso) return 0; const d = new Date(iso); return d.getHours() * 60 + d.getMinutes() }
const dateLabel = (key: string) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) }
const timeShort = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }) : ''

const runs = computed(() => {
  const e = event.value
  if (!e?.start_at) return 'No dates'
  const s = new Date(e.start_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
  const end = e.end_at ? new Date(e.end_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '…'
  return `${s} – ${end}`
})

// Session types = distinct titles, ordered by earliest time of day.
const sessionTypes = computed(() => {
  const map: Record<string, { title: string; mins: number; timeLabel: string }> = {}
  for (const s of sessions.value) {
    const title = s.title || 'Session'
    const mins = timeMins(s.start_at)
    if (!map[title] || mins < map[title].mins) map[title] = { title, mins, timeLabel: `${timeShort(s.start_at)} – ${timeShort(s.end_at)}` }
  }
  return Object.values(map).sort((a, b) => a.mins - b.mins)
})
const dates = computed(() => [...new Set(sessions.value.map(s => dayKey(s.start_at)).filter(Boolean))].sort())

function makeCell(s: any): Cell {
  const cap = s.capacity_max ?? null
  const booked = bookedBySession.value[s.id] ?? 0
  const spaces = cap === null ? Infinity : cap - booked
  const limited = cap !== null && cap > 0 && spaces > 0 && spaces / cap <= 0.1
  return { cap, booked, spaces, limited }
}
// Precomputed grid[date][type] → Cell | null.
const grid = computed(() => {
  const g: Record<string, Record<string, Cell | null>> = {}
  for (const d of dates.value) {
    g[d] = {}
    for (const tp of sessionTypes.value) {
      const s = sessions.value.find(x => dayKey(x.start_at) === d && (x.title || 'Session') === tp.title)
      g[d][tp.title] = s ? makeCell(s) : null
    }
  }
  return g
})

function cellClass(c: Cell) {
  if (c.cap === null) return 'text-gray-500'
  if (c.spaces <= 0) return 'text-red-600'
  if (c.limited) return 'text-amber-600'
  return 'text-green-700'
}
function cellLabel(c: Cell) {
  if (c.cap === null) return `${c.booked} booked`
  if (c.spaces <= 0) return 'Full'
  return `${c.spaces} space${c.spaces !== 1 ? 's' : ''}`
}
function barColor(booked: number, cap: number | null) {
  if (cap === null || cap === 0) return 'bg-gray-300'
  const r = booked / cap
  if (r >= 1) return 'bg-red-500'
  if (r >= 0.9) return 'bg-amber-500'
  return 'bg-green-500'
}
function barWidth(c: Cell) {
  if (!c.cap) return c.booked ? '100%' : '0%'
  return Math.min(100, (c.booked / c.cap) * 100) + '%'
}
const totals = computed(() => {
  let capacity = 0, booked = 0, anyCap = false
  for (const s of sessions.value) {
    booked += bookedBySession.value[s.id] ?? 0
    if (s.capacity_max != null) { capacity += s.capacity_max; anyCap = true }
  }
  return { capacity: anyCap ? capacity : 0, booked, spaces: Math.max(0, capacity - booked) }
})

async function load() {
  loading.value = true
  const id = route.params.id as string
  const { data: ev } = await (db.from as any)('events').select('*').eq('id', id).maybeSingle()
  event.value = ev
  breadcrumbs.value = [{ label: 'Programme', to: '/programme' }, { label: ev?.title ?? 'Programme' }]
  const { data: sess } = await (db.from as any)('sessions')
    .select('id, title, start_at, end_at, capacity_max, is_master, sort_order')
    .eq('event_id', id)
    .order('start_at', { ascending: true })
  sessions.value = sess ?? []
  const ids = sessions.value.map((s: any) => s.id)
  if (ids.length) {
    const { data: rs } = await (db.from as any)('registration_sessions').select('session_id, status').in('session_id', ids)
    const m: Record<string, number> = {}
    for (const r of (rs ?? [])) if (r.status === 'CONFIRMED') m[r.session_id] = (m[r.session_id] ?? 0) + 1
    bookedBySession.value = m
  }
  loading.value = false
}
onMounted(load)
</script>
