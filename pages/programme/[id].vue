<template>
  <div class="p-3 sm:p-6 space-y-4 sm:space-y-5">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="min-w-0">
        <h1 class="text-lg sm:text-2xl font-semibold text-gray-900 truncate">{{ event?.title || 'Programme' }}</h1>
        <p class="text-xs sm:text-sm text-gray-500 mt-0.5">
          {{ runs }} · {{ sessions.length }} session{{ sessions.length !== 1 ? 's' : '' }} ·
          <span class="font-medium text-gray-700">{{ totals.booked }}</span> booked{{ totals.capacity ? ` of ${totals.capacity}` : '' }}
        </p>
      </div>
      <NuxtLink :to="`/events/${route.params.id}`"
        class="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-600 hover:border-gray-300 shrink-0">
        <i class="pi pi-pencil text-xs" /> Edit programme
      </NuxtLink>
    </div>

    <div v-if="loading" class="bg-white rounded-xl border border-gray-200 py-16 text-center text-sm text-gray-400">Loading dates…</div>
    <div v-else-if="!sessions.length" class="bg-white rounded-xl border border-gray-200 py-16 text-center text-sm text-gray-400">
      This programme has no dates yet.
    </div>

    <!-- Dates list, grouped by week -->
    <div v-else class="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm border-collapse min-w-[640px]">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <th class="px-4 py-2.5">Session</th>
              <th v-if="hasVenues" class="px-4 py-2.5 hidden md:table-cell">Venue</th>
              <th class="px-4 py-2.5 hidden sm:table-cell">Roll taker</th>
              <th class="px-4 py-2.5 whitespace-nowrap">Booked / Limit</th>
              <th class="px-4 py-2.5 w-[28%] hidden sm:table-cell"></th>
            </tr>
          </thead>

          <template v-for="wk in weeks" :key="wk.key">
            <tbody>
              <tr v-for="row in wk.rows" :key="row.s.id" :class="rowClass(row)" class="border-b border-gray-100">
                <td class="px-4 py-3" :class="{ 'pl-8': row.samePrevDay }">
                  <NuxtLink :to="`/events/${route.params.id}?tab=attendance`" class="text-gray-800 hover:text-primary">
                    <span class="text-gray-500">{{ row.samePrevDay ? '' : dayLabel(row.s.start_at) }}</span>
                    <span v-if="!row.samePrevDay" class="text-gray-300"> — </span>{{ row.s.title || 'Session' }}
                    <span class="text-gray-400 text-xs">· {{ timeShort(row.s.start_at) }}</span>
                  </NuxtLink>
                </td>
                <td v-if="hasVenues" class="px-4 py-3 hidden md:table-cell text-gray-500">{{ venueLabel(row.s) }}</td>
                <td class="px-4 py-3 hidden sm:table-cell text-gray-400">{{ '—' }}</td>
                <td class="px-4 py-3 whitespace-nowrap tabular-nums" :class="cellClass(row)">
                  <span class="font-medium">{{ row.booked }}</span> / {{ row.cap === null ? '∞' : row.cap }}
                </td>
                <td class="px-4 py-3 hidden sm:table-cell">
                  <div class="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div class="h-full rounded-full" :class="barColor(row.booked, row.cap)" :style="{ width: barWidth(row) }" />
                  </div>
                </td>
              </tr>
              <!-- weekly total -->
              <tr class="bg-gray-50/70 border-b border-gray-200 text-gray-500 italic">
                <td class="px-4 py-2 text-right" :colspan="hasVenues ? 3 : 2">Week total</td>
                <td class="px-4 py-2 whitespace-nowrap tabular-nums">
                  <span class="font-medium text-gray-700">{{ wk.booked }}</span> / {{ wk.capacity || '∞' }}
                </td>
                <td class="px-4 py-2 hidden sm:table-cell" />
              </tr>
            </tbody>
          </template>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Row { s: any; booked: number; cap: number | null; samePrevDay: boolean; past: boolean; today: boolean }

const db = useDb()
const route = useRoute()
const breadcrumbs = useBreadcrumbs()

const loading = ref(true)
const event = ref<any>(null)
const sessions = ref<any[]>([])
const bookedBySession = ref<Record<string, number>>({})

const dayKey = (iso: string | null) => iso ? new Date(iso).toISOString().slice(0, 10) : ''
const dayLabel = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : ''
const timeShort = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }) : ''
const todayKey = new Date().toISOString().slice(0, 10)

// Monday-of-week key for grouping.
function weekKey(iso: string) {
  const d = new Date(iso); d.setHours(0, 0, 0, 0)
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  return d.toISOString().slice(0, 10)
}
function weekLabel(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return 'Week of ' + new Date(y, m - 1, d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

const runs = computed(() => {
  const e = event.value
  if (!e?.start_at) return 'No dates'
  const s = new Date(e.start_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
  const end = e.end_at ? new Date(e.end_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '…'
  return `${s} – ${end}`
})

function venueLabel(s: any) {
  if (!s.location_type) return ''
  if (s.location_type === 'ONLINE') return s.meeting_link ? 'Online' : 'Online'
  return s.address || ''
}
const hasVenues = computed(() => sessions.value.some(s => venueLabel(s)))

function bookedFor(s: any) { return bookedBySession.value[s.id] ?? 0 }
function capFor(s: any) { return s.capacity_max ?? null }

// Sessions grouped into weeks, one row per session, with weekly totals.
const weeks = computed(() => {
  const ordered = [...sessions.value].sort((a, b) => (a.start_at || '').localeCompare(b.start_at || ''))
  const byWeek: Record<string, any[]> = {}
  for (const s of ordered) { const k = weekKey(s.start_at); (byWeek[k] ||= []).push(s) }
  return Object.keys(byWeek).sort().map(key => {
    let booked = 0, capacity = 0, anyCap = false, prevDay = ''
    const rows: Row[] = byWeek[key].map(s => {
      const b = bookedFor(s), cap = capFor(s), dk = dayKey(s.start_at)
      booked += b
      if (cap != null) { capacity += cap; anyCap = true }
      const row: Row = { s, booked: b, cap, samePrevDay: dk === prevDay, past: dk < todayKey, today: dk === todayKey }
      prevDay = dk
      return row
    })
    return { key, label: weekLabel(key), rows, booked, capacity: anyCap ? capacity : 0 }
  })
})

const totals = computed(() => {
  let capacity = 0, booked = 0, anyCap = false
  for (const s of sessions.value) { booked += bookedFor(s); if (s.capacity_max != null) { capacity += s.capacity_max; anyCap = true } }
  return { capacity: anyCap ? capacity : 0, booked }
})

function rowClass(r: Row) {
  if (r.today) return 'bg-green-50/60'
  if (r.past) return 'text-gray-400 bg-gray-50/40'
  return ''
}
function cellClass(r: Row) {
  if (r.cap === null) return 'text-gray-500'
  if (r.booked >= r.cap) return 'text-red-600'
  if (r.cap > 0 && (r.cap - r.booked) / r.cap <= 0.1) return 'text-amber-600'
  return 'text-gray-700'
}
function barColor(booked: number, cap: number | null) {
  if (cap === null || cap === 0) return 'bg-gray-300'
  const ratio = booked / cap
  if (ratio >= 1) return 'bg-red-500'
  if (ratio >= 0.9) return 'bg-amber-500'
  return 'bg-green-500'
}
function barWidth(r: Row) {
  if (!r.cap) return r.booked ? '100%' : '0%'
  return Math.min(100, (r.booked / r.cap) * 100) + '%'
}

async function load() {
  loading.value = true
  const id = route.params.id as string
  const { data: ev } = await (db.from as any)('events').select('*').eq('id', id).maybeSingle()
  event.value = ev
  breadcrumbs.value = [{ label: 'Programme', to: '/programme' }, { label: ev?.title ?? 'Programme' }]
  const { data: sess } = await (db.from as any)('sessions')
    .select('id, title, start_at, end_at, capacity_max, location_type, address, meeting_link, is_master, sort_order')
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
