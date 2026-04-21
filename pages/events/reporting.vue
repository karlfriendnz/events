<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Header -->
    <div class="px-6 py-5 border-b border-gray-200 bg-white shrink-0">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-gray-900">Event Reporting</h1>
          <p class="text-sm text-gray-500 mt-0.5">Analyse attendance, registrations and revenue across multiple events</p>
        </div>
      </div>

      <!-- Category + date filters -->
      <div class="flex items-center gap-3 mt-4 flex-wrap">
        <div class="flex items-center gap-2">
          <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</label>
          <Select
            v-model="selectedCategoryId"
            :options="[{ id: null, name: 'All categories', color: '#94a3b8' }, ...categories]"
            option-label="name"
            option-value="id"
            placeholder="Choose category…"
            style="min-width:200px"
            size="small"
          >
            <template #option="{ option }">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: option.color ?? '#94a3b8' }" />
                {{ option.name }}
              </div>
            </template>
            <template #value="{ value }">
              <div v-if="value !== undefined" class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full shrink-0"
                  :style="{ background: categories.find(c => c.id === value)?.color ?? '#94a3b8' }" />
                {{ value === null ? 'All categories' : categories.find(c => c.id === value)?.name }}
              </div>
            </template>
          </Select>
        </div>

        <div class="flex items-center gap-2">
          <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">From</label>
          <input v-model="dateFrom" type="date"
            class="h-8 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#1E2157] transition-colors bg-white" />
        </div>
        <div class="flex items-center gap-2">
          <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">To</label>
          <input v-model="dateTo" type="date"
            class="h-8 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#1E2157] transition-colors bg-white" />
        </div>

        <button class="text-xs text-gray-400 hover:text-gray-600 transition-colors" @click="clearFilters">Clear</button>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">

      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-20">
        <i class="pi pi-spin pi-spinner text-2xl text-gray-300" />
      </div>

      <template v-else-if="filteredEvents.length">

        <!-- Summary stat cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Events</p>
            <p class="text-2xl font-bold text-gray-800">{{ filteredEvents.length }}</p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Total Invitees</p>
            <p class="text-2xl font-bold text-gray-800">{{ totalStats.invitees }}</p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Confirmed</p>
            <p class="text-2xl font-bold text-green-600">{{ totalStats.confirmed }}</p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Avg Attendance</p>
            <p class="text-2xl font-bold text-[#1E2157]">
              {{ totalStats.attendanceRate !== null ? totalStats.attendanceRate + '%' : '—' }}
            </p>
          </div>
        </div>

        <!-- Per-event table -->
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div class="px-5 py-3.5 border-b border-gray-100 bg-gray-50">
            <p class="text-sm font-semibold text-gray-700">Events breakdown</p>
          </div>
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                <th class="text-left px-5 py-3">Event</th>
                <th class="text-left px-4 py-3 w-36">Date</th>
                <th class="text-right px-4 py-3 w-24">Invitees</th>
                <th class="text-right px-4 py-3 w-24">Confirmed</th>
                <th class="text-right px-4 py-3 w-24">Attended</th>
                <th class="text-right px-4 py-3 w-28">Attendance %</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in eventRows" :key="row.id"
                class="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer"
                @click="navigateTo(`/events/${row.id}?tab=reporting`)">
                <td class="px-5 py-3">
                  <div class="flex items-center gap-2">
                    <span v-if="row.category" class="w-2 h-2 rounded-full shrink-0" :style="{ background: row.category.color ?? '#94a3b8' }" />
                    <span class="font-medium text-gray-800">{{ row.title }}</span>
                  </div>
                </td>
                <td class="px-4 py-3 text-gray-500 text-xs">{{ row.dateLabel }}</td>
                <td class="px-4 py-3 text-right text-gray-700">{{ row.invitees }}</td>
                <td class="px-4 py-3 text-right text-green-600 font-medium">{{ row.confirmed }}</td>
                <td class="px-4 py-3 text-right text-gray-700">{{ row.attended }}</td>
                <td class="px-4 py-3 text-right">
                  <span v-if="row.attendanceRate !== null"
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                    :class="row.attendanceRate >= 75 ? 'bg-green-50 text-green-700' : row.attendanceRate >= 50 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-600'">
                    {{ row.attendanceRate }}%
                  </span>
                  <span v-else class="text-gray-300">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Attendance trend (simple bar chart) -->
        <div v-if="eventRows.some(r => r.attendanceRate !== null)" class="bg-white rounded-xl border border-gray-200 px-5 py-5">
          <p class="text-sm font-semibold text-gray-700 mb-4">Attendance rate by event</p>
          <div class="space-y-2.5">
            <div v-for="row in eventRows.filter(r => r.attendanceRate !== null)" :key="row.id" class="flex items-center gap-3">
              <span class="text-xs text-gray-500 w-40 truncate shrink-0">{{ row.title }}</span>
              <div class="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                <div class="h-2 rounded-full transition-all duration-500"
                  :style="{ width: row.attendanceRate + '%', background: row.attendanceRate! >= 75 ? '#10B981' : row.attendanceRate! >= 50 ? '#F59E0B' : '#EF4444' }" />
              </div>
              <span class="text-xs font-semibold w-10 text-right shrink-0"
                :class="row.attendanceRate! >= 75 ? 'text-green-600' : row.attendanceRate! >= 50 ? 'text-yellow-600' : 'text-red-500'">
                {{ row.attendanceRate }}%
              </span>
            </div>
          </div>
        </div>

      </template>

      <!-- Empty state -->
      <div v-else-if="!loading" class="flex flex-col items-center justify-center py-24 text-gray-400">
        <i class="pi pi-chart-bar text-4xl mb-3 text-gray-300" />
        <p class="text-sm font-medium text-gray-500">No events found</p>
        <p class="text-xs mt-1">Try adjusting the category or date filters</p>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
const { orgId } = useOrg()
const db = useDb()

// ── Filters ──────────────────────────────────────────────────────────
const selectedCategoryId = ref<string | null | undefined>(undefined)
const dateFrom = ref('')
const dateTo = ref('')

function clearFilters() {
  selectedCategoryId.value = undefined
  dateFrom.value = ''
  dateTo.value = ''
}

// ── Data ─────────────────────────────────────────────────────────────
const loading = ref(true)
const categories = ref<any[]>([])
const allEvents = ref<any[]>([])
// inviteesByEvent[eventId] = { total, confirmed }
const inviteesByEvent = ref<Record<string, { total: number; confirmed: number }>>({})
// attendedByEvent[eventId] = count of unique persons with at least one attended record
const attendedByEvent = ref<Record<string, number>>({})

async function load() {
  loading.value = true
  const [{ data: cats }, { data: evts }] = await Promise.all([
    db.from('categories').select('id, name, color, icon').eq('org_id', orgId.value).order('name'),
    db.from('events')
      .select('id, title, start_at, category_id, category:categories!category_id(id, name, color)')
      .eq('org_id', orgId.value)
      .neq('status', 'ARCHIVED')
      .order('start_at', { ascending: false }),
  ])

  categories.value = cats ?? []
  allEvents.value = evts ?? []

  const eventIds = (evts ?? []).map((e: any) => e.id)
  if (!eventIds.length) { loading.value = false; return }

  // Chunk helper to avoid URL length limits
  async function queryInChunks<T>(table: string, column: string, ids: string[], extraQuery?: (q: any) => any): Promise<T[]> {
    const CHUNK = 100
    const results: T[] = []
    for (let i = 0; i < ids.length; i += CHUNK) {
      let q = db.from(table).select('*').in(column, ids.slice(i, i + CHUNK))
      if (extraQuery) q = extraQuery(q)
      const { data } = await q
      if (data) results.push(...data)
    }
    return results
  }

  const invs = await queryInChunks<any>('invitees', 'event_id', eventIds, q => q.select('id, event_id, status'))

  // Build invitees map
  const iMap: Record<string, { total: number; confirmed: number }> = {}
  for (const inv of invs) {
    if (!iMap[inv.event_id]) iMap[inv.event_id] = { total: 0, confirmed: 0 }
    iMap[inv.event_id].total++
    if (inv.status === 'CONFIRMED') iMap[inv.event_id].confirmed++
  }
  inviteesByEvent.value = iMap

  // Load sessions to get session IDs per event, then load attendance
  const sessions = await queryInChunks<any>('sessions', 'event_id', eventIds, q => q.select('id, event_id'))
  const sessionToEvent: Record<string, string> = {}
  for (const s of sessions) sessionToEvent[s.id] = s.event_id
  const sessionIds = sessions.map((s: any) => s.id)

  const aMap: Record<string, Set<string>> = {}
  if (sessionIds.length) {
    const attendanceRows = await queryInChunks<any>('attendance', 'session_id', sessionIds, q => q.select('person_id, session_id, event_id').eq('attended', true))
    for (const row of attendanceRows) {
      const evtId = row.event_id ?? sessionToEvent[row.session_id]
      if (!evtId) continue
      if (!aMap[evtId]) aMap[evtId] = new Set()
      aMap[evtId].add(row.person_id)
    }
  }
  attendedByEvent.value = Object.fromEntries(Object.entries(aMap).map(([k, v]) => [k, v.size]))

  loading.value = false
}

onMounted(load)

// ── Filtering ─────────────────────────────────────────────────────────
const filteredEvents = computed(() => {
  return allEvents.value.filter(evt => {
    if (selectedCategoryId.value !== undefined && selectedCategoryId.value !== null) {
      if (evt.category_id !== selectedCategoryId.value) return false
    }
    if (dateFrom.value && (!evt.start_at || new Date(evt.start_at) < new Date(dateFrom.value))) return false
    if (dateTo.value && (!evt.start_at || new Date(evt.start_at) > new Date(dateTo.value + 'T23:59:59'))) return false
    return true
  })
})

// ── Row computation ───────────────────────────────────────────────────
const eventRows = computed(() => {
  return filteredEvents.value.map(evt => {
    const inv = inviteesByEvent.value[evt.id] ?? { total: 0, confirmed: 0 }
    const attended = attendedByEvent.value[evt.id] ?? 0
    const attendanceRate = inv.confirmed > 0 ? Math.round(attended / inv.confirmed * 100) : null
    const dateLabel = evt.start_at
      ? new Date(evt.start_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—'
    return {
      id: evt.id,
      title: evt.title,
      category: evt.category,
      dateLabel,
      invitees: inv.total,
      confirmed: inv.confirmed,
      attended,
      attendanceRate,
    }
  })
})

// ── Totals ────────────────────────────────────────────────────────────
const totalStats = computed(() => {
  const invitees = eventRows.value.reduce((s, r) => s + r.invitees, 0)
  const confirmed = eventRows.value.reduce((s, r) => s + r.confirmed, 0)
  const attended = eventRows.value.reduce((s, r) => s + r.attended, 0)
  const attendanceRate = confirmed > 0 ? Math.round(attended / confirmed * 100) : null
  return { invitees, confirmed, attended, attendanceRate }
})
</script>
