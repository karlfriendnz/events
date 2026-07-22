<script setup lang="ts">
// Repeating-series overview — the destination of the "Repeats" chip on a recurring
// event. Two tabs (Upcoming / Past) over a DataTable of every occurrence in the
// series (master + children), each with its invitee count. Read-only; a row opens
// that occurrence's event page.
import { useEventsApi } from '~/composables/useEventsApi'

const route = useRoute()
const masterId = computed(() => route.params.id as string)
const { orgId } = useOrg()
const eventsApi = useEventsApi()

useBreadcrumbs([{ label: 'Events', to: '/events' }, { label: 'Repeating series' }])

const loading = ref(true)
const master = ref<any>(null)
const rows = ref<{ id: string; startAt: string | null; status: string; invitees: number; confirmed: number }[]>([])
const activeTab = ref<'upcoming' | 'past'>('upcoming')
const search = ref('')

// master duration (ms) so each occurrence can show a start–end range
const durationMs = computed(() => {
  const s = master.value?.startAt ? new Date(master.value.startAt).getTime() : null
  const e = master.value?.endAt ? new Date(master.value.endAt).getTime() : null
  return s != null && e != null && e > s ? e - s : null
})

async function load() {
  loading.value = true
  try {
    const [m, series, counts] = await Promise.all([
      eventsApi.get(masterId.value).catch(() => null),
      eventsApi.series(masterId.value),
      orgId.value ? eventsApi.inviteeCountsByOrg(orgId.value).catch(() => []) : Promise.resolve([]),
    ])
    master.value = m
    const countMap = new Map(counts.map(c => [c.eventId, c]))
    rows.value = series.map(s => {
      const c = countMap.get(s.id)
      return { id: s.id, startAt: s.startAt, status: s.status, invitees: c?.total ?? 0, confirmed: c?.confirmed ?? 0 }
    })
  } finally { loading.value = false }
}
onMounted(load)
watch(masterId, load)

const now = Date.now()
function isPast(r: { startAt: string | null }) {
  return r.startAt ? new Date(r.startAt).getTime() < now : false   // undated → upcoming
}

const dateFmt = new Intl.DateTimeFormat('en-NZ', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const timeFmt = new Intl.DateTimeFormat('en-NZ', { hour: 'numeric', minute: '2-digit' })
function dateLabel(iso: string | null) { return iso ? dateFmt.format(new Date(iso)) : 'No date' }
function timeLabel(iso: string | null) {
  if (!iso) return '—'
  const start = new Date(iso)
  if (durationMs.value == null) return timeFmt.format(start)
  const end = new Date(start.getTime() + durationMs.value)
  return `${timeFmt.format(start)} – ${timeFmt.format(end)}`
}

function matchesSearch(r: { startAt: string | null; status: string }) {
  const q = search.value.trim().toLowerCase()
  if (!q) return true
  return `${dateLabel(r.startAt)} ${timeLabel(r.startAt)} ${r.status}`.toLowerCase().includes(q)
}

const upcoming = computed(() => rows.value.filter(r => !isPast(r) && matchesSearch(r))
  .sort((a, b) => (a.startAt || '').localeCompare(b.startAt || '')))
const past = computed(() => rows.value.filter(r => isPast(r) && matchesSearch(r))
  .sort((a, b) => (b.startAt || '').localeCompare(a.startAt || '')))
const shown = computed(() => activeTab.value === 'upcoming' ? upcoming.value : past.value)

// tab counts ignore the search box so the tabs read as totals
const upcomingCount = computed(() => rows.value.filter(r => !isPast(r)).length)
const pastCount = computed(() => rows.value.filter(r => isPast(r)).length)

function statusClass(s: string) {
  const k = (s || '').toUpperCase()
  if (k === 'PUBLISHED') return 'bg-emerald-50 text-emerald-700'
  if (k === 'CANCELLED') return 'bg-red-50 text-red-600'
  if (k === 'DRAFT') return 'bg-gray-100 text-gray-500'
  return 'bg-gray-100 text-gray-600'
}
function openOccurrence(r: { id: string }) { navigateTo(`/events/view/${r.id}`) }
</script>

<template>
  <div class="p-3 sm:p-6 space-y-4 sm:space-y-5">
    <!-- header -->
    <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <button class="text-gray-400 hover:text-gray-700" @click="navigateTo(`/events/view/${masterId}`)">
            <i class="pi pi-arrow-left" />
          </button>
          <h1 class="text-lg sm:text-2xl font-semibold truncate">{{ master?.title || 'Repeating series' }}</h1>
          <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium shrink-0">
            <i class="pi pi-replay text-[10px]" /> {{ rows.length }} occurrences
          </span>
        </div>
      </div>
      <div class="sm:ml-auto">
        <IconField>
          <InputIcon class="pi pi-search" />
          <InputText v-model="search" placeholder="Search occurrences" class="w-full sm:w-64" />
        </IconField>
      </div>
    </div>

    <!-- tabs -->
    <div class="flex gap-1 border-b border-gray-200 overflow-x-auto no-scrollbar">
      <button
        class="border-b-2 -mb-px whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors"
        :class="activeTab === 'upcoming' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'"
        @click="activeTab = 'upcoming'">
        Upcoming <span class="text-xs text-gray-400">({{ upcomingCount }})</span>
      </button>
      <button
        class="border-b-2 -mb-px whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors"
        :class="activeTab === 'past' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'"
        @click="activeTab = 'past'">
        Past <span class="text-xs text-gray-400">({{ pastCount }})</span>
      </button>
    </div>

    <div v-if="loading" class="text-center text-gray-400 py-16"><i class="pi pi-spin pi-spinner text-2xl" /></div>

    <div v-else-if="!shown.length" class="text-center text-gray-400 py-16">
      <i class="pi pi-calendar text-3xl mb-3 block" />
      No {{ activeTab }} occurrences{{ search ? ' match your search' : '' }}.
    </div>

    <div v-else class="card overflow-hidden">
      <DataTable :value="shown" dataKey="id" removableSort paginator :rows="25" :rowsPerPageOptions="[25, 50, 100]"
        rowHover class="text-sm" @row-click="e => openOccurrence(e.data)">
        <Column field="startAt" header="Date" sortable>
          <template #body="{ data }"><span class="font-medium text-gray-800">{{ dateLabel(data.startAt) }}</span></template>
        </Column>
        <Column header="Time">
          <template #body="{ data }"><span class="text-gray-600">{{ timeLabel(data.startAt) }}</span></template>
        </Column>
        <Column field="status" header="Status" sortable>
          <template #body="{ data }">
            <span class="inline-block px-2 py-0.5 rounded text-xs font-medium capitalize" :class="statusClass(data.status)">{{ (data.status || '').toLowerCase() }}</span>
          </template>
        </Column>
        <Column field="invitees" header="Invitees" sortable>
          <template #body="{ data }"><span class="text-gray-700">{{ data.invitees }}</span></template>
        </Column>
        <Column field="confirmed" header="Confirmed" sortable>
          <template #body="{ data }"><span class="text-gray-700">{{ data.confirmed }}</span></template>
        </Column>
        <Column class="w-10">
          <template #body><i class="pi pi-chevron-right text-gray-300" /></template>
        </Column>
      </DataTable>
    </div>
  </div>
</template>
