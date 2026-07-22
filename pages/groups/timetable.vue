<!--
  /groups/timetable — Week View. A time-of-day × weekday timetable of every class
  the club runs (from member_group_schedules), colour-coded by code/programme.
  Filter by term / code / venue / coach. Desktop = <TimetableGrid> time-grid;
  mobile = a per-day agenda. Reads existing data only — no new schema.
-->
<script setup lang="ts">
import { minLabel, type TimetableSession } from '~/composables/useClassTimetable'

const ct = useClassTimetable()
const gc = useGroupCodes()
const tm = useTermsMemberships()
const finder = useClassFinder()
const route = useRoute()
const { orgReady } = useOrg()
const { ensureTerms, t } = useTerms()
void ensureTerms()

// Breadcrumb trail lives in the top control bar (like the rest of the app) —
// the page no longer repeats a title/subtitle in its body.
useBreadcrumbs([{ label: () => t('group', true), to: '/groups' }, { label: 'Week View' }])

const loading = ref(true)
const allSessions = ref<TimetableSession[]>([])
const codes = ref<any[]>([])
const terms = ref<any[]>([])

const termId = ref<string>('all')
const codeIds = ref<string[]>([])
const venue = ref<string>('all')
const coach = ref<string>('all')
const focusDay = ref<number | null>(null)   // null = week; 0–6 = focused day view

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

async function load() {
  loading.value = true
  const { sessions, codes: cs } = await ct.loadSessions()
  allSessions.value = sessions
  codes.value = cs
  // Scoped entry (e.g. a saved view's "Week View" button): ?codes=id1,id2 pre-filters
  // to those programmes (expanded to include their sub-codes, like the saved views do).
  const qc = route.query.codes
  if (qc && !codeIds.value.length) codeIds.value = gc.closeSelection(String(qc).split(',').filter(Boolean), cs)
  terms.value = await tm.loadTerms()
  // Default to the active term (today within range), else the latest term with sessions.
  const today = new Date().toISOString().slice(0, 10)
  const termsWithSessions = new Set(sessions.map(s => s.termId).filter(Boolean))
  const active = terms.value.find((t: any) => t.start_date && t.end_date && t.start_date <= today && today <= t.end_date && termsWithSessions.has(t.id))
  termId.value = active?.id ?? (terms.value.find((t: any) => termsWithSessions.has(t.id))?.id ?? 'all')
  loading.value = false
}
watch(orgReady, r => { if (r) load() }, { immediate: true })

const termOptions = computed(() => [{ label: `All ${t('term', true, true)}`, value: 'all' }, ...terms.value.map((tm: any) => ({ label: tm.name, value: tm.id }))])
const codeOptions = computed(() => gc.treeOptions(codes.value))
const venueOptions = computed(() => {
  const set = new Set(allSessions.value.map(s => s.venue).filter(Boolean))
  return [{ label: `All ${t('venue', true, true)}`, value: 'all' }, ...[...set].sort().map(v => ({ label: v, value: v }))]
})
const coachOptions = computed(() => {
  const set = new Set(allSessions.value.map(s => s.coach).filter(Boolean) as string[])
  return [{ label: `All ${t('coach', true, true)}`, value: 'all' }, ...[...set].sort().map(c => ({ label: c, value: c }))]
})

const { inActiveLocation: inLens, activeLocationId: lensActiveId, locations: clubLocations } = useActiveLocation()
const lensAll = computed(() => !lensActiveId.value)
const locFilter = ref<string[]>([])
const locFilterOptions = computed(() => clubLocations.value.map(l => ({ label: l.name, value: l.id })))
const inLocFilter = (id: string | null) =>
  !lensAll.value || !locFilter.value.length || (id != null && locFilter.value.includes(id))
const filtered = computed(() => allSessions.value.filter(s =>
  inLens(s.locationId) &&
  inLocFilter(s.locationId) &&
  (termId.value === 'all' || s.termId === termId.value) &&
  (!codeIds.value.length || (s.codeId != null && codeIds.value.includes(s.codeId))) &&
  (venue.value === 'all' || s.venue === venue.value) &&
  (coach.value === 'all' || s.coach === coach.value),
))

// legend — codes actually present in the filtered set
const legend = computed(() => {
  const seen = new Map<string, { name: string; color: string }>()
  for (const s of filtered.value) {
    const key = s.codeId ?? '__none'
    if (!seen.has(key)) seen.set(key, { name: s.codeName ?? 'Ungrouped', color: s.color })
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
})

const stats = computed(() => {
  const s = filtered.value
  const mins = s.reduce((a, x) => a + (x.endMin - x.startMin), 0)
  const cap = s.reduce((a, x) => a + (x.capacity ?? 0), 0)
  const filled = s.reduce((a, x) => a + Math.min(x.count, x.capacity ?? x.count), 0)
  return { classes: s.length, hours: Math.round(mins / 6) / 10, capacity: cap, filled, fillPct: cap ? Math.round((filled / cap) * 100) : null }
})

// mobile agenda grouped by weekday (Mon→Sun)
const agenda = computed(() => DAY_ORDER.map(d => ({
  d, label: fullDay(d),
  items: filtered.value.filter(s => s.day === d).sort((a, b) => a.startMin - b.startMin),
})).filter(x => x.items.length))
function fullDay(d: number) { return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d] }

const anyFilter = computed(() => termId.value !== 'all' || codeIds.value.length || venue.value !== 'all' || coach.value !== 'all')
function clearFilters() { termId.value = 'all'; codeIds.value = []; venue.value = 'all'; coach.value = 'all' }
function openGroup(s: TimetableSession) { navigateTo(`/groups/${s.groupId}`) }
</script>

<template>
  <div class="p-3 sm:p-6 space-y-4 sm:space-y-5">
    <!-- filters + key -->
    <div class="card p-3 sm:p-4 space-y-3">
      <div class="flex flex-wrap items-center gap-2 sm:gap-3">
        <Select v-model="termId" :options="termOptions" optionLabel="label" optionValue="value" class="w-full sm:w-44" />
        <ChipMultiSelect v-model="codeIds" :options="codeOptions" optionLabel="label" optionValue="value" 
     :placeholder="`All ${t('code', true, true)}`" :maxSelectedLabels="2" class="w-full sm:w-52" :showToggleAll="false"   />
        <MultiSelect v-if="lensAll && clubLocations.length > 1" v-model="locFilter" :options="locFilterOptions"
          optionLabel="label" optionValue="value" display="chip" :placeholder="'All locations'" class="w-full sm:w-52" />
        <Select v-model="venue" :options="venueOptions" optionLabel="label" optionValue="value" class="w-full sm:w-40" filter />
        <Select v-model="coach" :options="coachOptions" optionLabel="label" optionValue="value" class="w-full sm:w-40" filter />
        <button v-if="anyFilter" type="button" class="text-xs font-medium text-gray-400 hover:text-gray-700 px-1.5 py-1" @click="clearFilters">Clear</button>
        <button type="button" @click="finder.openFinder()"
          class="sm:ml-auto inline-flex items-center gap-1.5 text-sm text-white px-3 py-2 rounded-lg" style="background:#1E2157">
          <i class="pi pi-search text-xs" /> Find a {{ t('group', false, true) }}
        </button>
        <NuxtLink to="/groups" class="hidden sm:inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary px-3 py-2 rounded-lg border border-gray-200 hover:border-gray-300">
          <i class="pi pi-table text-xs" /> Table view
        </NuxtLink>
      </div>
      <!-- colour key (codes present in view) -->
      <div v-if="!loading && legend.length" class="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-3 border-t border-gray-100">
        <span class="text-[10px] font-bold uppercase tracking-wide text-gray-400 mr-0.5">Key</span>
        <span v-for="l in legend" :key="l.name" class="inline-flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-sm shrink-0" :style="{ background: l.color }" />
          <span class="text-xs text-gray-500 whitespace-nowrap">{{ l.name }}</span>
        </span>
      </div>
    </div>

    <!-- loading -->
    <div v-if="loading" class="card p-16 text-center text-gray-400 text-sm">
      <i class="pi pi-spin pi-spinner text-2xl mb-2 block" /> Loading timetable…
    </div>

    <!-- empty -->
    <div v-else-if="!filtered.length" class="card p-12 sm:p-16 text-center">
      <i class="pi pi-calendar text-3xl text-gray-300 mb-3 block" />
      <p class="text-sm font-medium text-gray-700">{{ allSessions.length ? `No ${t('group', true, true)} match these filters` : `No ${t('group', false, true)} times scheduled yet` }}</p>
      <p class="text-xs text-gray-400 mt-1">{{ allSessions.length ? 'Try clearing a filter.' : `Add weekly session times on a ${t('group', false, true)} to see them here.` }}</p>
      <button v-if="allSessions.length && anyFilter" class="mt-4 text-sm text-primary hover:underline" @click="clearFilters">Clear filters</button>
    </div>

    <template v-else>
      <!-- desktop grid (click a day name → focused day view) -->
      <div class="hidden md:block">
        <TimetableGrid :sessions="filtered" :focus-day="focusDay" @select="openGroup"
          @focus-day="d => focusDay = d" @clear-focus="focusDay = null" />
      </div>

      <!-- mobile agenda -->
      <div class="md:hidden space-y-4">
        <div v-for="day in agenda" :key="day.d">
          <h2 class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2 px-1">{{ day.label }}</h2>
          <div class="space-y-2">
            <button v-for="s in day.items" :key="s.id" type="button" @click="openGroup(s)"
              class="w-full card p-0 overflow-hidden flex items-stretch text-left active:scale-[0.99] transition-transform">
              <span class="w-1.5 shrink-0" :style="{ background: s.color }" />
              <div class="flex-1 min-w-0 px-3 py-2.5">
                <div class="flex items-start justify-between gap-2">
                  <p class="text-sm font-semibold text-gray-800 leading-tight">{{ s.groupName }}</p>
                  <span v-if="s.capacity != null" class="shrink-0 text-[11px] font-semibold px-1.5 py-0.5 rounded"
                    :class="s.count > s.capacity ? 'bg-red-100 text-red-700' : s.count >= s.capacity ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'">{{ s.count }}/{{ s.capacity }}</span>
                </div>
                <p class="text-xs text-gray-500 mt-0.5 tabular-nums">{{ s.startLabel }}–{{ s.endLabel }}</p>
                <p v-if="s.coach || s.venue" class="text-xs text-gray-400 mt-0.5 truncate">
                  <span v-if="s.coach">{{ s.coach }}</span><span v-if="s.coach && s.venue"> · </span><span v-if="s.venue">{{ s.venue }}</span>
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
