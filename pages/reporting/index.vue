<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-semibold text-surface-900">Reporting</h1>
        <p class="text-sm text-surface-500 mt-0.5">Cross-event analytics, attendance trends, and financial summaries.</p>
      </div>
      <Button label="Export" icon="pi pi-download" severity="secondary" size="small" @click="exportAll" />
    </div>

    <!-- KPI cards -->
    <div class="grid grid-cols-4 gap-4 mb-6">
      <div class="card p-4">
        <p class="text-xs text-surface-500 uppercase tracking-wide mb-1">Total Events</p>
        <p class="text-3xl font-bold text-surface-900">{{ kpis.totalEvents }}</p>
        <p class="text-xs text-green-600 mt-1">{{ kpis.publishedEvents }} published</p>
      </div>
      <div class="card p-4">
        <p class="text-xs text-surface-500 uppercase tracking-wide mb-1">Total Invitees</p>
        <p class="text-3xl font-bold text-surface-900">{{ kpis.totalInvitees }}</p>
        <p class="text-xs text-surface-500 mt-1">{{ kpis.confirmedInvitees }} confirmed</p>
      </div>
      <div class="card p-4">
        <p class="text-xs text-surface-500 uppercase tracking-wide mb-1">Sessions</p>
        <p class="text-3xl font-bold text-surface-900">{{ kpis.totalSessions }}</p>
        <p class="text-xs text-surface-500 mt-1">across all events</p>
      </div>
      <div class="card p-4">
        <p class="text-xs text-surface-500 uppercase tracking-wide mb-1">Est. Revenue</p>
        <p class="text-3xl font-bold text-primary">{{ formatCurrency(kpis.estimatedRevenue) }}</p>
        <p class="text-xs text-surface-500 mt-1">from confirmed attendees</p>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-4">
      <!-- Events by status -->
      <div class="card p-4">
        <h3 class="text-sm font-semibold text-surface-700 mb-4">Events by Status</h3>
        <ul class="space-y-2">
          <li v-for="row in eventsByStatus" :key="row.status" class="flex items-center justify-between">
            <Tag :value="row.status" :severity="statusSeverity(row.status)" />
            <div class="flex items-center gap-2">
              <div class="h-2 bg-primary rounded-full" :style="{ width: `${(row.count / kpis.totalEvents) * 80}px` }" />
              <span class="text-sm font-medium w-6 text-right">{{ row.count }}</span>
            </div>
          </li>
          <li v-if="!eventsByStatus.length" class="text-surface-400 text-sm">No data.</li>
        </ul>
      </div>

      <!-- Invitees by status -->
      <div class="card p-4">
        <h3 class="text-sm font-semibold text-surface-700 mb-4">Invitees by Status</h3>
        <ul class="space-y-2">
          <li v-for="row in inviteesByStatus" :key="row.status" class="flex items-center justify-between">
            <Tag :value="row.status" :severity="inviteeSeverity(row.status)" />
            <div class="flex items-center gap-2">
              <div class="h-2 bg-primary rounded-full"
                :style="{ width: `${Math.max(4, (row.count / (kpis.totalInvitees || 1)) * 80)}px` }" />
              <span class="text-sm font-medium w-6 text-right">{{ row.count }}</span>
            </div>
          </li>
          <li v-if="!inviteesByStatus.length" class="text-surface-400 text-sm">No data.</li>
        </ul>
      </div>

      <!-- Events by category -->
      <div class="card p-4">
        <h3 class="text-sm font-semibold text-surface-700 mb-4">Events by Category</h3>
        <ul class="space-y-2">
          <li v-for="row in eventsByCategory" :key="row.category" class="flex items-center justify-between text-sm">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full inline-block" :style="{ background: row.color || '#94a3b8' }" />
              <span class="text-surface-700 truncate max-w-28">{{ row.category }}</span>
            </div>
            <span class="font-medium">{{ row.count }}</span>
          </li>
          <li v-if="!eventsByCategory.length" class="text-surface-400 text-sm">No data.</li>
        </ul>
      </div>
    </div>

    <!-- Recent events table -->
    <div class="mt-6">
      <h3 class="text-sm font-semibold text-surface-700 mb-3">All Events</h3>
      <div class="card">
        <DataTable
          ref="reportTable"
          :value="events"
          :loading="loading"
          size="small"
          striped-rows
          export-filename="fm-events-report"
          :global-filter-fields="['title', 'status', 'style']"
        >
          <template #header>
            <div class="flex justify-between">
              <IconField>
                <InputIcon class="pi pi-search" />
                <InputText v-model="search" placeholder="Filter…" size="small" class="w-64" />
              </IconField>
            </div>
          </template>
          <template #empty>
            <p class="text-center py-8 text-surface-400">No events.</p>
          </template>
          <Column field="title" header="Event" />
          <Column field="style" header="Style" style="width:150px">
            <template #body="{ data }">
              <Tag :value="STYLE_LABELS[data.style] ?? data.style" severity="secondary" />
            </template>
          </Column>
          <Column field="status" header="Status" style="width:110px">
            <template #body="{ data }">
              <Tag :value="data.status" :severity="statusSeverity(data.status)" />
            </template>
          </Column>
          <Column field="start_at" header="Date" style="width:200px">
            <template #body="{ data }">
              <span>{{ data.start_at ? formatDate(data.start_at) : '—' }}<span v-if="data.end_at && data.start_at !== data.end_at" class="text-gray-400"> – {{ formatDate(data.end_at) }}</span></span>
              <span v-if="data.start_at && !data.is_all_day" class="block text-xs text-gray-400">{{ formatTime(data.start_at) }}<span v-if="data.end_at"> – {{ formatTime(data.end_at) }}</span></span>
            </template>
          </Column>
          <Column field="invitee_count" header="Invitees" style="width:90px">
            <template #body="{ data }">{{ data.invitee_count ?? 0 }}</template>
          </Column>
          <Column field="confirmed_count" header="Confirmed" style="width:100px">
            <template #body="{ data }">
              <span class="text-green-600 font-medium">{{ data.confirmed_count ?? 0 }}</span>
            </template>
          </Column>
          <Column header="Action" style="width:80px">
            <template #body="{ data }">
              <NuxtLink :to="`/events/${data.id}`" class="text-primary text-sm hover:underline">View</NuxtLink>
            </template>
          </Column>
        </DataTable>
      </div>
    </div>

    <Toast />
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'

const db = useDb()
const toast = useToast()

const loading = ref(true)
const search = ref('')
const events = ref<any[]>([])
const inviteeSummary = ref<any[]>([])
const reportTable = ref()

const STYLE_LABELS: Record<string, string> = {
  BASIC: 'Basic', ADVANCED: 'Advanced', MULTI_SESSION: 'Multi-Session',
  SPORTS_COMPETITION: 'Competition', HOLIDAY_PROGRAM: 'Camp / Program',
  ATTENDANCE: 'Attendance', COMPETITION: 'Competition',
}

function statusSeverity(s: string) {
  return { DRAFT: 'secondary', PUBLISHED: 'success', CANCELLED: 'danger', ARCHIVED: 'warn' }[s] ?? 'secondary'
}
function inviteeSeverity(s: string) {
  return {
    CONFIRMED: 'success', INVITED: 'info', DECLINED: 'danger',
    EXCLUDED: 'danger', INTERESTED: 'warn', HOLD: 'warn', WAITLISTED: 'secondary'
  }[s] ?? 'secondary'
}
function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n)
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}
function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })
}

const kpis = computed(() => {
  const totalEvents = events.value.length
  const publishedEvents = events.value.filter(e => e.status === 'PUBLISHED').length
  const totalInvitees = events.value.reduce((s, e) => s + (e.invitee_count ?? 0), 0)
  const confirmedInvitees = events.value.reduce((s, e) => s + (e.confirmed_count ?? 0), 0)
  const totalSessions = events.value.reduce((s, e) => s + (e.session_count ?? 0), 0)
  const totalFees = events.value.reduce((s, e) => s + (e.total_fees ?? 0), 0)
  const estimatedRevenue = confirmedInvitees * (totalFees / (totalEvents || 1))
  return { totalEvents, publishedEvents, totalInvitees, confirmedInvitees, totalSessions, estimatedRevenue }
})

const eventsByStatus = computed(() => {
  const counts: Record<string, number> = {}
  events.value.forEach(e => { counts[e.status] = (counts[e.status] ?? 0) + 1 })
  return Object.entries(counts).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count)
})

const inviteesByStatus = computed(() => {
  const counts: Record<string, number> = {}
  inviteeSummary.value.forEach(i => { counts[i.status] = (counts[i.status] ?? 0) + 1 })
  return Object.entries(counts).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count)
})

const eventsByCategory = computed(() => {
  const counts: Record<string, { count: number; color: string }> = {}
  events.value.forEach(e => {
    const name = e.category?.name ?? 'Uncategorised'
    const color = e.category?.color ?? '#94a3b8'
    if (!counts[name]) counts[name] = { count: 0, color }
    counts[name].count++
  })
  return Object.entries(counts).map(([category, v]) => ({ category, ...v })).sort((a, b) => b.count - a.count)
})

function exportAll() {
  reportTable.value?.exportCSV()
}

async function load() {
  loading.value = true
  const { DEFAULT_ORG_ID } = await import('~/composables/useDb')

  const [{ data: eventData }, { data: invData }] = await Promise.all([
    db.from('events')
      .select('*, category:categories(name, color)')
      .eq('org_id', DEFAULT_ORG_ID)
      .order('start_at'),
    db.from('invitees').select('event_id, status'),
  ])

  const invitees = invData ?? []

  // Aggregate per event
  const invCountByEvent: Record<string, number> = {}
  const confirmedByEvent: Record<string, number> = {}
  for (const inv of invitees) {
    invCountByEvent[inv.event_id] = (invCountByEvent[inv.event_id] ?? 0) + 1
    if (['CONFIRMED', 'HOLD'].includes(inv.status)) {
      confirmedByEvent[inv.event_id] = (confirmedByEvent[inv.event_id] ?? 0) + 1
    }
  }

  events.value = (eventData ?? []).map(e => ({
    ...e,
    invitee_count: invCountByEvent[e.id] ?? 0,
    confirmed_count: confirmedByEvent[e.id] ?? 0,
  }))

  inviteeSummary.value = invitees
  loading.value = false
}

onMounted(load)
</script>
