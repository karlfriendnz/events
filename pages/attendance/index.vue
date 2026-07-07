<template>
  <div class="p-3 sm:p-6">
    <!-- Title lives in the control bar (pageTitles map). -->

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
      <!-- Toolbar: search left -->
      <div class="flex items-center gap-2 mb-3">
        <span class="relative flex-1 sm:flex-none sm:w-72">
          <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
          <InputText v-model="search" :placeholder="`Search ${t('group', true, true)} or locations…`" class="w-full !pl-8" size="small" />
        </span>
        <span class="text-xs text-gray-400 ml-auto">{{ filteredRows.length }} session{{ filteredRows.length === 1 ? '' : 's' }} · next 15 days</span>
      </div>

      <!-- Desktop: DataTable -->
      <div class="card p-0 overflow-hidden hidden md:block">
        <DataTable :value="filteredRows" dataKey="id" removableSort sortField="start" :sortOrder="1"
          :paginator="filteredRows.length > 25" :rows="25" :rowsPerPageOptions="[25, 50, 100]"
          class="text-sm">
          <Column field="groupName" :header="t('group')" sortable>
            <template #body="{ data }">
              <span class="flex items-center gap-2.5 min-w-0">
                <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: data.groupColor || '#94a3b8' }" />
                <span class="font-semibold text-gray-900 truncate">{{ data.groupName }}</span>
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
  </div>
</template>

<script setup lang="ts">
const db = useDb()
const { orgId } = useOrg()
const { ensureTerms, t } = useTerms()
void ensureTerms()

interface SessionRow {
  id: string
  locationId: string | null
  eventId: string
  groupName: string
  groupColor: string | null
  start: Date
  end: Date
  isToday: boolean
  dateLabel: string
  timeLabel: string
  locationLabel: string
}

const loading = ref(true)
const allRows = ref<SessionRow[]>([])
const search = ref('')

const { inActiveLocation } = useActiveLocation()
const filteredRows = computed(() => {
  const base = allRows.value.filter(r => inActiveLocation(r.locationId))
  const q = search.value.trim().toLowerCase()
  if (!q) return base
  return base.filter(r =>
    r.groupName.toLowerCase().includes(q)
    || r.locationLabel.toLowerCase().includes(q)
    || r.dateLabel.toLowerCase().includes(q))
})

function fmtTime(d: Date) {
  return d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })
}

async function load() {
  if (!orgId.value) return
  loading.value = true

  const horizonStart = new Date(); horizonStart.setHours(0, 0, 0, 0)
  const horizonEnd = new Date(horizonStart); horizonEnd.setDate(horizonEnd.getDate() + 15)
  const todayEnd = new Date(horizonStart); todayEnd.setDate(todayEnd.getDate() + 1)

  // Each training event row is one occurrence — masters represent their
  // own first occurrence, children represent every subsequent week
  // (recurrence_parent_id is set). Group linkage (member_group_id) is
  // the canonical filter for "training events" so we don't depend on
  // a specific event style.
  const { data: events } = await (db.from as any)('events')
    .select('id, start_at, end_at, location_type, bookable_id, address, meeting_link, member_group:member_groups(id, name, color, location_id)')
    .eq('org_id', orgId.value)
    .not('member_group_id', 'is', null)
    .gte('start_at', horizonStart.toISOString())
    .lt('start_at', horizonEnd.toISOString())
    .order('start_at')

  const bookableIds = Array.from(new Set((events ?? []).map((e: any) => e.bookable_id).filter(Boolean)))
  const bookableNames: Record<string, string> = {}
  if (bookableIds.length) {
    const { data: bkbls } = await (db.from as any)('bookables').select('id, name').in('id', bookableIds)
    for (const b of bkbls ?? []) bookableNames[b.id] = b.name
  }

  allRows.value = (events ?? []).map((e: any) => {
    const start = new Date(e.start_at)
    const end = new Date(e.end_at)
    let locationLabel = ''
    if (e.location_type === 'BOOKABLE' && e.bookable_id) locationLabel = bookableNames[e.bookable_id] ?? ''
    else if (e.location_type === 'ADDRESS') locationLabel = e.address ?? ''
    else if (e.location_type === 'ONLINE') locationLabel = e.meeting_link ? 'Online' : ''
    const isToday = start >= horizonStart && start < todayEnd
    return {
      id: e.id,
      eventId: e.id,
      groupName: e.member_group?.name ?? 'Attendance',
      groupColor: e.member_group?.color ?? null,
      locationId: e.member_group?.location_id ?? null,
      start,
      end,
      isToday,
      dateLabel: isToday ? 'Today' : start.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }),
      timeLabel: `${fmtTime(start)} – ${fmtTime(end)}`,
      locationLabel,
    } as SessionRow
  })

  loading.value = false
}

watch(orgId, load, { immediate: true })
</script>
