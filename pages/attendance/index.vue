<template>
  <div class="p-3 sm:p-6">
    <div class="mb-6">
      <h1 class="text-xl font-semibold text-surface-900">Attendance</h1>
      <p class="text-sm text-surface-500 mt-0.5">Today's training sessions and what's coming up across every group.</p>
    </div>

    <div v-if="loading" class="text-sm text-gray-400 py-12 text-center">Loading…</div>

    <div v-else-if="!todayRows.length && !upcomingRows.length"
      class="card p-10 text-center text-sm text-surface-500">
      <i class="pi pi-check-square text-3xl text-surface-300 mb-3 block" />
      <p class="font-semibold text-surface-700 mb-1">No attendance sessions yet</p>
      <p>Create an attendance event from a group's page to start tracking who shows up.</p>
      <NuxtLink to="/groups"
        class="inline-flex items-center gap-1 mt-4 text-sm font-semibold text-[#1976d2] hover:underline">
        Go to Groups <i class="pi pi-arrow-right text-[10px]" />
      </NuxtLink>
    </div>

    <template v-else>
      <section v-if="todayRows.length" class="mb-8">
        <h2 class="text-xs font-bold tracking-widest text-gray-500 uppercase mb-3">Today</h2>
        <div class="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          <div v-for="row in todayRows" :key="row.id"
            class="flex items-center gap-4 px-4 sm:px-5 py-3 hover:bg-gray-50">
            <span class="w-2.5 h-2.5 rounded-full shrink-0"
              :style="{ background: row.groupColor || '#94a3b8' }" />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-gray-900 truncate">{{ row.groupName }}</p>
              <p class="text-xs text-gray-500 truncate">{{ row.timeLabel }}<span v-if="row.locationLabel"> · {{ row.locationLabel }}</span></p>
            </div>
            <NuxtLink :to="`/events/${row.eventId}?tab=attendance`"
              class="text-xs font-semibold text-white bg-[#1976d2] hover:bg-[#125ea8] px-3 py-1.5 rounded inline-flex items-center gap-1">
              Take attendance <i class="pi pi-arrow-right text-[10px]" />
            </NuxtLink>
          </div>
        </div>
      </section>

      <section v-if="upcomingRows.length">
        <h2 class="text-xs font-bold tracking-widest text-gray-500 uppercase mb-3">Upcoming</h2>
        <div class="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          <template v-for="(group, gi) in upcomingByDate" :key="group.dateKey">
            <div class="px-5 py-2 bg-gray-50 text-xs font-semibold text-gray-600">{{ group.dateLabel }}</div>
            <div v-for="row in group.rows" :key="row.id"
              class="flex items-center gap-4 px-4 sm:px-5 py-3 hover:bg-gray-50">
              <span class="w-2.5 h-2.5 rounded-full shrink-0"
                :style="{ background: row.groupColor || '#94a3b8' }" />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-gray-900 truncate">{{ row.groupName }}</p>
                <p class="text-xs text-gray-500 truncate">{{ row.timeLabel }}<span v-if="row.locationLabel"> · {{ row.locationLabel }}</span></p>
              </div>
              <NuxtLink :to="`/events/${row.eventId}?tab=attendance`"
                class="text-xs font-semibold text-[#1976d2] hover:underline inline-flex items-center gap-1">
                Open <i class="pi pi-arrow-right text-[10px]" />
              </NuxtLink>
            </div>
          </template>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
const db = useDb()
const { orgId } = useOrg()

interface SessionRow {
  id: string
  eventId: string
  groupName: string
  groupColor: string | null
  start: Date
  end: Date
  timeLabel: string
  locationLabel: string
}

const loading = ref(true)
const allRows = ref<SessionRow[]>([])

const todayRows = computed(() => {
  const start = new Date(); start.setHours(0, 0, 0, 0)
  const end = new Date(start); end.setDate(end.getDate() + 1)
  return allRows.value.filter(r => r.start >= start && r.start < end)
})

const upcomingRows = computed(() => {
  const cutoff = new Date(); cutoff.setHours(0, 0, 0, 0); cutoff.setDate(cutoff.getDate() + 1)
  const horizon = new Date(cutoff); horizon.setDate(horizon.getDate() + 14)
  return allRows.value.filter(r => r.start >= cutoff && r.start < horizon)
})

const upcomingByDate = computed(() => {
  const map = new Map<string, { dateKey: string; dateLabel: string; rows: SessionRow[] }>()
  for (const r of upcomingRows.value) {
    const key = r.start.toDateString()
    if (!map.has(key)) {
      map.set(key, {
        dateKey: key,
        dateLabel: r.start.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' }),
        rows: [],
      })
    }
    map.get(key)!.rows.push(r)
  }
  return Array.from(map.values())
})

function fmtTime(d: Date) {
  return d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })
}

async function load() {
  if (!orgId.value) return
  loading.value = true

  const horizonStart = new Date(); horizonStart.setHours(0, 0, 0, 0)
  const horizonEnd = new Date(horizonStart); horizonEnd.setDate(horizonEnd.getDate() + 15)

  // Each training event row is one occurrence — masters represent their
  // own first occurrence, children represent every subsequent week
  // (recurrence_parent_id is set). Group linkage (member_group_id) is
  // the canonical filter for "training events" so we don't depend on
  // a specific event style.
  const { data: events } = await (db.from as any)('events')
    .select('id, start_at, end_at, location_type, bookable_id, address, meeting_link, member_group:member_groups(id, name, color)')
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
    return {
      id: e.id,
      eventId: e.id,
      groupName: e.member_group?.name ?? 'Attendance',
      groupColor: e.member_group?.color ?? null,
      start,
      end,
      timeLabel: `${fmtTime(start)} – ${fmtTime(end)}`,
      locationLabel,
    } as SessionRow
  })

  loading.value = false
}

watch(orgId, load, { immediate: true })
</script>
