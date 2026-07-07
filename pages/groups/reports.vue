<!--
  Classes → Reports. The Week View's summary stats (classes/week, scheduled
  hours, spots filled, utilisation), promoted to their own page — club-wide
  tiles plus per-LOCATION and per-PROGRAMME breakdowns. Lens-aware (the header
  location switcher narrows everything) with a term filter.
-->
<script setup lang="ts">
import type { TimetableSession } from '~/composables/useClassTimetable'

const ct = useClassTimetable()
const tm = useTermsMemberships()
const gc = useGroupCodes()
const { ensureTerms, t } = useTerms()
void ensureTerms()
const { inActiveLocation, locations: clubLocations, ensureLocations } = useActiveLocation()
void ensureLocations()
useBreadcrumbs([{ label: () => t('group', true), to: '/groups' }, { label: 'Reports' }])

const loading = ref(true)
const allSessions = ref<TimetableSession[]>([])
const terms = ref<any[]>([])
const termId = ref<string>('all')

const termOptions = computed(() => [
  { label: `All ${t('term', true, true)}`, value: 'all' },
  ...terms.value.map(tr => ({ label: tr.name, value: tr.id })),
])

const filtered = computed(() => allSessions.value.filter(s =>
  inActiveLocation(s.locationId) &&
  (termId.value === 'all' || s.termId === termId.value)))

function metricsOf(list: TimetableSession[]) {
  const mins = list.reduce((a, x) => a + (x.endMin - x.startMin), 0)
  const cap = list.reduce((a, x) => a + (x.capacity ?? 0), 0)
  const filled = list.reduce((a, x) => a + Math.min(x.count, x.capacity ?? x.count), 0)
  return {
    classes: new Set(list.map(x => x.groupId)).size,
    sessions: list.length,
    hours: Math.round(mins / 6) / 10,
    capacity: cap,
    filled,
    fillPct: cap ? Math.round((filled / cap) * 100) : null,
  }
}

const overall = computed(() => metricsOf(filtered.value))

// Per-location: lens-aware set grouped by locationId (plus a "No location" bucket)
const byLocation = computed(() => {
  const rows: { name: string; color: string | null; m: ReturnType<typeof metricsOf> }[] = []
  for (const l of clubLocations.value) {
    const list = filtered.value.filter(s => s.locationId === l.id)
    if (list.length) rows.push({ name: l.name, color: l.color, m: metricsOf(list) })
  }
  const unlocated = filtered.value.filter(s => !s.locationId)
  if (unlocated.length) rows.push({ name: 'No location', color: null, m: metricsOf(unlocated) })
  return rows
})

// Per-programme (code)
const byProgramme = computed(() => {
  const map = new Map<string, { name: string; color: string | null; list: TimetableSession[] }>()
  for (const s of filtered.value) {
    const key = s.codeId ?? '__none'
    if (!map.has(key)) map.set(key, { name: s.codeName ?? 'Ungrouped', color: s.color, list: [] })
    map.get(key)!.list.push(s)
  }
  return [...map.values()].map(r => ({ name: r.name, color: r.color, m: metricsOf(r.list) }))
})

function pctClass(p: number | null) {
  if (p == null) return 'text-gray-400'
  return p >= 90 ? 'text-red-600' : p >= 75 ? 'text-amber-600' : 'text-emerald-600'
}

async function load() {
  loading.value = true
  const [{ sessions }, loadedTerms] = await Promise.all([ct.loadSessions(), tm.loadTerms()])
  allSessions.value = sessions
  terms.value = loadedTerms
  const today = new Date().toISOString().slice(0, 10)
  const active = loadedTerms.find((tr: any) => (tr.start_date ?? '') <= today && (tr.end_date ?? '') >= today)
  if (active && sessions.some(s => s.termId === active.id)) termId.value = active.id
  loading.value = false
}
onMounted(load)
</script>

<template>
  <div class="p-3 sm:p-6 space-y-5">
    <div class="flex items-center gap-2">
      <Select v-model="termId" :options="termOptions" optionLabel="label" optionValue="value" class="w-full sm:w-44" />
      <NuxtLink to="/groups/timetable" class="ml-auto text-sm text-primary hover:underline whitespace-nowrap">Week view →</NuxtLink>
    </div>

    <div v-if="loading" class="card p-16 text-center text-gray-400 text-sm">
      <i class="pi pi-spin pi-spinner text-2xl mb-2 block" /> Loading…
    </div>

    <template v-else>
      <!-- Overall tiles (the strip that lived on the Week View) -->
      <div class="flex flex-wrap items-stretch gap-2 sm:gap-3">
        <div class="card px-4 py-3 flex-1 min-w-[130px]">
          <p class="text-lg font-bold text-gray-900">{{ overall.classes }}</p>
          <p class="text-xs text-gray-500">{{ t('group', true) }} / week</p>
        </div>
        <div class="card px-4 py-3 flex-1 min-w-[130px]">
          <p class="text-lg font-bold text-gray-900">{{ overall.hours }}<span class="text-sm font-medium text-gray-400 ml-0.5">hrs</span></p>
          <p class="text-xs text-gray-500">Scheduled time</p>
        </div>
        <div class="card px-4 py-3 flex-1 min-w-[130px]">
          <p class="text-lg font-bold text-gray-900">{{ overall.filled }}<span v-if="overall.capacity" class="text-sm font-medium text-gray-400">/{{ overall.capacity }}</span></p>
          <p class="text-xs text-gray-500">Spots filled</p>
        </div>
        <div class="card px-4 py-3 flex-1 min-w-[130px]">
          <p class="text-lg font-bold" :class="pctClass(overall.fillPct)">{{ overall.fillPct != null ? overall.fillPct + '%' : '—' }}</p>
          <p class="text-xs text-gray-500">Utilisation</p>
        </div>
      </div>

      <!-- Per-location breakdown -->
      <div v-if="byLocation.length > 1" class="card p-0 overflow-hidden">
        <div class="px-4 sm:px-5 py-3 border-b border-gray-100">
          <h3 class="text-sm font-semibold text-gray-800">By location</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                <th class="px-4 sm:px-5 py-2.5">Location</th>
                <th class="px-3 py-2.5 text-right">{{ t('group', true) }} / week</th>
                <th class="px-3 py-2.5 text-right">Hours</th>
                <th class="px-3 py-2.5 text-right">Spots filled</th>
                <th class="px-3 py-2.5 text-right">Utilisation</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="r in byLocation" :key="r.name" class="hover:bg-gray-50">
                <td class="px-4 sm:px-5 py-2.5"><span class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: r.color || '#CBD5E1' }" /><span class="font-medium text-gray-800">{{ r.name }}</span></span></td>
                <td class="px-3 py-2.5 text-right num">{{ r.m.classes }}</td>
                <td class="px-3 py-2.5 text-right num">{{ r.m.hours }}</td>
                <td class="px-3 py-2.5 text-right num">{{ r.m.filled }}<span v-if="r.m.capacity" class="text-gray-400">/{{ r.m.capacity }}</span></td>
                <td class="px-3 py-2.5 text-right num font-semibold" :class="pctClass(r.m.fillPct)">{{ r.m.fillPct != null ? r.m.fillPct + '%' : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Per-programme breakdown -->
      <div v-if="byProgramme.length" class="card p-0 overflow-hidden">
        <div class="px-4 sm:px-5 py-3 border-b border-gray-100">
          <h3 class="text-sm font-semibold text-gray-800">By {{ t('code', false, true) }}</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                <th class="px-4 sm:px-5 py-2.5">{{ t('code') }}</th>
                <th class="px-3 py-2.5 text-right">{{ t('group', true) }} / week</th>
                <th class="px-3 py-2.5 text-right">Hours</th>
                <th class="px-3 py-2.5 text-right">Spots filled</th>
                <th class="px-3 py-2.5 text-right">Utilisation</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="r in byProgramme" :key="r.name" class="hover:bg-gray-50">
                <td class="px-4 sm:px-5 py-2.5"><span class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: r.color || '#CBD5E1' }" /><span class="font-medium text-gray-800">{{ r.name }}</span></span></td>
                <td class="px-3 py-2.5 text-right num">{{ r.m.classes }}</td>
                <td class="px-3 py-2.5 text-right num">{{ r.m.hours }}</td>
                <td class="px-3 py-2.5 text-right num">{{ r.m.filled }}<span v-if="r.m.capacity" class="text-gray-400">/{{ r.m.capacity }}</span></td>
                <td class="px-3 py-2.5 text-right num font-semibold" :class="pctClass(r.m.fillPct)">{{ r.m.fillPct != null ? r.m.fillPct + '%' : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p v-if="!filtered.length" class="card p-10 text-center text-sm text-gray-400">No scheduled {{ t('group', true, true) }} for this {{ t('term', false, true) }}.</p>
    </template>
  </div>
</template>
