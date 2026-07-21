<template>
  <div class="p-3 sm:p-6">
    <!-- Title lives in the control bar (pageTitles map). -->

    <!-- View toggle: my rolls to complete vs every session -->
    <div class="flex items-center gap-2 mb-4">
      <div class="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-sm">
        <button type="button" class="px-3 py-1.5 rounded-md font-medium transition-colors"
          :class="view === 'mine' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'"
          @click="view = 'mine'">
          To complete<span v-if="todoCount" class="ml-1.5 text-xs px-1.5 py-0.5 rounded-full"
            :class="view === 'mine' ? 'bg-white/20' : 'bg-amber-100 text-amber-700'">{{ todoCount }}</span>
        </button>
        <button type="button" class="px-3 py-1.5 rounded-md font-medium transition-colors"
          :class="view === 'all' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'"
          @click="view = 'all'">All sessions</button>
      </div>
      <span class="relative ml-auto w-full sm:w-64">
        <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
        <InputText v-model="search" :placeholder="`Search ${t('group', true, true)} or events…`" class="w-full !pl-8" size="small" />
      </span>
    </div>

    <!-- ── MINE: rolls I need to complete ── -->
    <template v-if="view === 'mine'">
      <div v-if="mineLoading" class="text-sm text-gray-400 py-12 text-center">Loading…</div>

      <div v-else-if="!hasResponsibilities"
        class="card p-10 text-center text-sm text-surface-500">
        <i class="pi pi-check-square text-3xl text-surface-300 mb-3 block" />
        <p class="font-semibold text-surface-700 mb-1">Nothing assigned to you</p>
        <p>You're not down to take attendance for any {{ t('group', true, true) }} or events yet.</p>
        <button class="inline-flex items-center gap-1 mt-4 text-sm font-semibold text-[#1976d2] hover:underline" @click="view = 'all'">
          See all sessions <i class="pi pi-arrow-right text-[10px]" />
        </button>
      </div>

      <div v-else-if="!mineFiltered.length"
        class="card p-10 text-center text-sm text-surface-500">
        <i class="pi pi-check-circle text-3xl text-emerald-300 mb-3 block" />
        <p class="font-semibold text-surface-700 mb-1">All caught up</p>
        <p>No attendance to take right now. New sessions appear here as they come up.</p>
      </div>

      <template v-else>
        <p class="text-xs text-gray-400 mb-2">
          <span v-if="todoCount" class="text-amber-700 font-semibold">{{ todoCount }} to complete</span>
          <span v-else class="text-emerald-600 font-semibold">Up to date</span>
          · {{ mineFiltered.length }} in the next 2 weeks
        </p>

        <!-- Desktop -->
        <div class="card p-0 overflow-hidden hidden md:block">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wide">
                <th class="px-4 py-2.5 font-semibold">{{ t('group') }} / Event</th>
                <th class="px-4 py-2.5 font-semibold w-40">Date</th>
                <th class="px-4 py-2.5 font-semibold w-40">Time</th>
                <th class="px-4 py-2.5 font-semibold">Location</th>
                <th class="px-4 py-2.5 font-semibold w-32">Status</th>
                <th class="px-4 py-2.5 font-semibold w-40 text-right"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in mineFiltered" :key="row.eventId" class="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                <td class="px-4 py-2.5">
                  <span class="flex items-center gap-2.5 min-w-0">
                    <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: row.color || '#94a3b8' }" />
                    <NuxtLink :to="`/events/${row.eventId}?tab=attendance`" class="font-semibold text-gray-900 truncate hover:text-primary hover:underline">{{ row.name }}</NuxtLink>
                  </span>
                </td>
                <td class="px-4 py-2.5 text-gray-600">{{ row.dateLabel }}</td>
                <td class="px-4 py-2.5 text-gray-600">{{ row.timeLabel }}</td>
                <td class="px-4 py-2.5 text-gray-500">{{ row.locationLabel || '—' }}</td>
                <td class="px-4 py-2.5">
                  <span class="text-[11px] font-semibold px-2 py-0.5 rounded-full" :class="STATUS[row.status].cls">{{ STATUS[row.status].label }}</span>
                </td>
                <td class="px-4 py-2.5 text-right">
                  <NuxtLink :to="`/events/${row.eventId}?tab=attendance`"
                    class="text-xs font-semibold px-3 py-1.5 rounded inline-flex items-center gap-1 whitespace-nowrap"
                    :class="row.status === 'todo' ? 'text-white bg-[#1976d2] hover:bg-[#125ea8]' : 'text-[#1976d2] hover:underline'">
                    {{ row.status === 'done' ? 'Review' : row.status === 'upcoming' ? 'Open' : 'Take attendance' }}
                    <i class="pi pi-arrow-right text-[10px]" />
                  </NuxtLink>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Mobile -->
        <div class="md:hidden bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          <NuxtLink v-for="row in mineFiltered" :key="row.eventId" :to="`/events/${row.eventId}?tab=attendance`"
            class="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
            <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: row.color || '#94a3b8' }" />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-gray-900 truncate">{{ row.name }}</p>
              <p class="text-xs text-gray-500 truncate">{{ row.dateLabel }} · {{ row.timeLabel }}<span v-if="row.locationLabel"> · {{ row.locationLabel }}</span></p>
            </div>
            <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" :class="STATUS[row.status].cls">{{ STATUS[row.status].label }}</span>
          </NuxtLink>
        </div>
      </template>
    </template>

    <!-- ── ALL: every group-linked session (org-wide, next 15 days) ── -->
    <template v-else>
      <div v-if="loading" class="text-sm text-gray-400 py-12 text-center">Loading…</div>

      <div v-else-if="!allRows.length"
        class="card p-10 text-center text-sm text-surface-500">
        <i class="pi pi-check-square text-3xl text-surface-300 mb-3 block" />
        <p class="font-semibold text-surface-700 mb-1">No attendance sessions yet</p>
        <p>Create an attendance {{ t('event', false, true) }} from a {{ t('group', false, true) }}'s page to start tracking who shows up.</p>
        <NuxtLink to="/groups"
          class="inline-flex items-center gap-1 mt-4 text-sm font-semibold text-[#1976d2] hover:underline">
          Go to {{ t('group', true) }} <i class="pi pi-arrow-right text-[10px]" />
        </NuxtLink>
      </div>

      <template v-else>
        <p class="text-xs text-gray-400 mb-2">{{ filteredRows.length }} session{{ filteredRows.length === 1 ? '' : 's' }} · next 15 days</p>

        <!-- Desktop: DataTable -->
        <div class="card p-0 overflow-hidden hidden md:block">
          <DataTable :value="filteredRows" dataKey="id" removableSort sortField="start" :sortOrder="1"
            :paginator="filteredRows.length > 25" :rows="25" :rowsPerPageOptions="[25, 50, 100]"
            class="text-sm">
            <Column field="groupName" :header="t('group')" sortable>
              <template #body="{ data }">
                <span class="flex items-center gap-2.5 min-w-0">
                  <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: data.groupColor || '#94a3b8' }" />
                  <NuxtLink :to="`/events/${data.eventId}?tab=attendance`" class="font-semibold text-gray-900 truncate hover:text-primary hover:underline">{{ data.groupName }}</NuxtLink>
                  <span v-if="data.isToday" class="text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0" style="background:#EAF1FE;color:#2563EB">Today</span>
                </span>
              </template>
            </Column>
            <Column field="start" header="Date" sortable class="w-44">
              <template #body="{ data }">{{ data.dateLabel }}</template>
            </Column>
            <Column field="timeLabel" header="Time" class="w-44" />
            <Column field="locationLabel" header="Location" sortable>
              <template #body="{ data }"><span class="text-gray-500">{{ data.locationLabel || '—' }}</span></template>
            </Column>
            <Column class="w-44 !text-right">
              <template #body="{ data }">
                <NuxtLink v-if="data.isToday" :to="`/events/${data.eventId}?tab=attendance`"
                  class="text-xs font-semibold text-white bg-[#1976d2] hover:bg-[#125ea8] px-3 py-1.5 rounded inline-flex items-center gap-1 whitespace-nowrap">
                  Take attendance <i class="pi pi-arrow-right text-[10px]" />
                </NuxtLink>
                <NuxtLink v-else :to="`/events/${data.eventId}?tab=attendance`"
                  class="text-xs font-semibold text-[#1976d2] hover:underline inline-flex items-center gap-1 whitespace-nowrap">
                  Open <i class="pi pi-arrow-right text-[10px]" />
                </NuxtLink>
              </template>
            </Column>
          </DataTable>
        </div>

        <!-- Mobile: card list -->
        <div class="md:hidden bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          <NuxtLink v-for="row in filteredRows" :key="row.id" :to="`/events/${row.eventId}?tab=attendance`"
            class="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
            <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: row.groupColor || '#94a3b8' }" />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-gray-900 truncate">{{ row.groupName }}
                <span v-if="row.isToday" class="text-[10px] px-1.5 py-0.5 rounded-full font-semibold ml-1" style="background:#EAF1FE;color:#2563EB">Today</span>
              </p>
              <p class="text-xs text-gray-500 truncate">{{ row.dateLabel }} · {{ row.timeLabel }}<span v-if="row.locationLabel"> · {{ row.locationLabel }}</span></p>
            </div>
            <i class="pi pi-chevron-right text-gray-300 text-xs shrink-0" />
          </NuxtLink>
          <p v-if="!filteredRows.length" class="px-4 py-6 text-sm text-gray-400 text-center">No sessions match your search.</p>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
const { orgId } = useOrg()
const financesApi = useFinancesApi()
const scoped = useScopedRoles()
const { ensureTerms, t } = useTerms()
void ensureTerms()

const view = ref<'mine' | 'all'>('mine')
const search = ref('')
const { inActiveLocation } = useActiveLocation()

const STATUS = {
  todo: { label: 'Needs roll', cls: 'bg-amber-100 text-amber-700' },
  upcoming: { label: 'Upcoming', cls: 'bg-slate-100 text-slate-600' },
  done: { label: 'Done', cls: 'bg-emerald-100 text-emerald-700' },
} as const
type Status = keyof typeof STATUS

function fmtTime(d: Date) {
  return d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })
}
function locationLabelOf(e: { locationType?: string | null; bookableName?: string | null; address?: string | null; meetingLink?: string | null }) {
  if (e.locationType === 'BOOKABLE' && e.bookableName) return e.bookableName
  if (e.locationType === 'ADDRESS') return e.address ?? ''
  if (e.locationType === 'ONLINE') return e.meetingLink ? 'Online' : ''
  return ''
}

// ── "All sessions" (existing org-wide list, next 15 days) ──
interface SessionRow {
  id: string; eventId: string; groupName: string; groupColor: string | null; locationId: string | null
  start: Date; end: Date; isToday: boolean; dateLabel: string; timeLabel: string; locationLabel: string
}
const loading = ref(true)
const allRows = ref<SessionRow[]>([])
const filteredRows = computed(() => {
  const base = allRows.value.filter(r => inActiveLocation(r.locationId))
  const q = search.value.trim().toLowerCase()
  if (!q) return base
  return base.filter(r => r.groupName.toLowerCase().includes(q) || r.locationLabel.toLowerCase().includes(q) || r.dateLabel.toLowerCase().includes(q))
})

async function loadAll() {
  if (!orgId.value) return
  loading.value = true
  const horizonStart = new Date(); horizonStart.setHours(0, 0, 0, 0)
  const horizonEnd = new Date(horizonStart); horizonEnd.setDate(horizonEnd.getDate() + 15)
  const todayEnd = new Date(horizonStart); todayEnd.setDate(todayEnd.getDate() + 1)
  const sessions = await financesApi.attendanceSessions(orgId.value, horizonStart.toISOString(), horizonEnd.toISOString()).catch(() => [])
  allRows.value = (sessions ?? []).map((e) => {
    const start = new Date(e.startAt as string)
    const end = new Date(e.endAt as string)
    const isToday = start >= horizonStart && start < todayEnd
    return {
      id: e.eventId, eventId: e.eventId, groupName: e.groupName || e.eventTitle || 'Attendance', groupColor: e.groupColor ?? null,
      locationId: e.locationId ?? null, start, end, isToday,
      dateLabel: isToday ? 'Today' : start.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }),
      timeLabel: `${fmtTime(start)} – ${fmtTime(end)}`,
      locationLabel: locationLabelOf({ locationType: e.locationType, bookableName: e.bookableName, address: e.address, meetingLink: e.meetingLink }),
    } as SessionRow
  })
  loading.value = false
}

// ── "To complete" (mine — my groups/events, with derived status) ──
interface InboxRow {
  eventId: string; name: string; color: string | null; locationId: string | null
  start: Date; status: Status; dateLabel: string; timeLabel: string; locationLabel: string
}
const mineLoading = ref(true)
const hasResponsibilities = ref(false)
const mineRows = ref<InboxRow[]>([])
let defaultedView = false

const ORDER: Record<Status, number> = { todo: 0, upcoming: 1, done: 2 }
const mineFiltered = computed(() => {
  const q = search.value.trim().toLowerCase()
  const base = mineRows.value
    .filter(r => inActiveLocation(r.locationId))
    .filter(r => !q || r.name.toLowerCase().includes(q) || r.locationLabel.toLowerCase().includes(q) || r.dateLabel.toLowerCase().includes(q))
  return [...base].sort((a, b) => {
    if (ORDER[a.status] !== ORDER[b.status]) return ORDER[a.status] - ORDER[b.status]
    // todo/upcoming: soonest first; done: most recent first
    return a.status === 'done' ? b.start.getTime() - a.start.getTime() : a.start.getTime() - b.start.getTime()
  })
})
const todoCount = computed(() => mineRows.value.filter(r => r.status === 'todo' && inActiveLocation(r.locationId)).length)

async function loadMine() {
  if (!orgId.value) return
  mineLoading.value = true
  await scoped.load()
  const groupIds = scoped.groupsICanTakeAttendance.value
  const eventIds = scoped.eventsICanTakeAttendance.value
  hasResponsibilities.value = !!(groupIds.length || eventIds.length)
  if (!hasResponsibilities.value) { mineRows.value = []; mineLoading.value = false; maybeDefaultView(); return }

  const now = new Date()
  const from = new Date(now); from.setDate(from.getDate() - 21); from.setHours(0, 0, 0, 0)
  const to = new Date(now); to.setDate(to.getDate() + 15); to.setHours(0, 0, 0, 0)
  const items = await financesApi.attendanceInbox(orgId.value, { groupIds, eventIds, from: from.toISOString(), to: to.toISOString() }).catch(() => [])

  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date(startOfToday); endOfToday.setDate(endOfToday.getDate() + 1)
  mineRows.value = items.map((e) => {
    const start = new Date(e.startAt as string)
    const end = new Date(e.endAt as string)
    const isToday = start >= startOfToday && start < endOfToday
    const status: Status = start.getTime() > Date.now() ? 'upcoming' : (e.markedCount > 0 ? 'done' : 'todo')
    return {
      eventId: e.eventId, name: e.groupName || e.eventTitle || 'Attendance', color: e.groupColor ?? null, locationId: e.locationId ?? null,
      start, status,
      dateLabel: isToday ? 'Today' : start.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }),
      timeLabel: `${fmtTime(start)} – ${fmtTime(end)}`,
      locationLabel: locationLabelOf({ locationType: e.locationType, bookableName: e.bookableName, address: e.address, meetingLink: e.meetingLink }),
    } as InboxRow
  })
  mineLoading.value = false
  maybeDefaultView()
}

// On first load, a user with no attendance duties lands on "All" instead of an
// empty personal list (admins/super-admins have no assigned classes).
function maybeDefaultView() {
  if (defaultedView) return
  defaultedView = true
  if (!hasResponsibilities.value) view.value = 'all'
}

async function reload() {
  await Promise.all([loadAll(), loadMine()])
}
watch(orgId, reload, { immediate: true })
</script>
