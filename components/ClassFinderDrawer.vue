<!--
  ClassFinderDrawer — reusable right-slide "Find a class" tool. Mounted ONCE in the
  default layout; opened from any screen via useClassFinder().openFinder(). Parameter-only
  search over the club's classes, results ranked by fit, with a Shortlist tab to compare.
-->
<script setup lang="ts">
import { useClassFinder, GENDER_OPTIONS, TIME_BANDS, WEEKDAYS, type FinderClass } from '~/composables/useClassFinder'

const finder = useClassFinder()
const gc = useGroupCodes()
const tm = useTermsMemberships()
const { open, params } = finder

const loading = ref(false)
const loaded = ref(false)
const classes = ref<FinderClass[]>([])
const codes = ref<any[]>([])
const terms = ref<any[]>([])

// Only reveal matches once the user has actually entered something to search on
// (term + only-with-space are defaults, so they don't count as "started filling in").
const hasCriteria = computed(() => {
  const p = params.value
  return p.age != null || p.days.length > 0 || p.timeBand !== 'any' || p.codeIds.length > 0 || !!p.gender || !!p.venue
})

async function load() {
  loading.value = true
  const [{ classes: cs, codes: cd }, ts] = await Promise.all([finder.loadClasses(), tm.loadTerms()])
  classes.value = cs
  codes.value = cd
  terms.value = ts
  // Default the term to the one active today (if not already set).
  if (params.value.termId == null) {
    const today = new Date().toISOString().slice(0, 10)
    const active = ts.find((t: any) => t.start_date && t.end_date && t.start_date <= today && today <= t.end_date)
    if (active) params.value.termId = active.id
  }
  loaded.value = true
  loading.value = false
}
watch(open, o => { if (o && !loaded.value) load() })

const codeOptions = computed(() => gc.treeOptions(codes.value))
const termOptions = computed(() => [{ label: 'Any term', value: null }, ...terms.value.map((t: any) => ({ label: t.name, value: t.id }))])
const venueOptions = computed(() => {
  const set = new Set<string>()
  classes.value.forEach(c => c.venues.forEach(v => set.add(v)))
  return [{ label: 'Any venue', value: null }, ...[...set].sort().map(v => ({ label: v, value: v }))]
})

const results = computed(() => finder.match(classes.value, params.value))

function toggleDay(d: number) {
  params.value.days = params.value.days.includes(d) ? params.value.days.filter(x => x !== d) : [...params.value.days, d]
}
const activeFilterCount = computed(() => {
  const p = params.value
  return (p.age != null ? 1 : 0) + (p.days.length ? 1 : 0) + (p.timeBand !== 'any' ? 1 : 0) +
    (p.codeIds.length ? 1 : 0) + (p.gender ? 1 : 0) + (p.venue ? 1 : 0) + (p.onlyWithSpace ? 1 : 0)
})

function fmtTime(mins: number) {
  const h = Math.floor(mins / 60), m = mins % 60
  const ap = h >= 12 ? 'PM' : 'AM'
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`
}
function dayShort(d: number) { return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d] }
function spaceLabel(c: FinderClass) {
  if (c.capacity == null) return 'Open'
  if (c.spaces && c.spaces > 0) return `${c.spaces} ${c.spaces === 1 ? 'space' : 'spaces'}`
  return 'Full'
}
function spaceClass(c: FinderClass) {
  if (c.capacity == null) return 'text-gray-400'
  if (c.spaces && c.spaces > 0) return 'bg-emerald-50 text-emerald-700'
  return 'text-gray-400'
}
function viewClass(c: FinderClass) { finder.close(); navigateTo(`/groups/${c.groupId}`) }
// Add person → open the class page with its Add-person dialog already up.
function addPersonToClass(c: FinderClass) { finder.close(); navigateTo(`/groups/${c.groupId}?add=member`) }
</script>

<template>
  <Teleport to="body">
    <!-- backdrop -->
    <Transition name="cf-fade">
      <div v-if="open" class="fixed inset-0 bg-black/30 z-[60]" @click="finder.close()" />
    </Transition>
    <!-- panel -->
    <Transition name="cf-drawer">
      <aside v-if="open" class="fixed top-0 right-0 bottom-0 w-full sm:w-[440px] bg-white shadow-2xl z-[61] flex flex-col">
        <!-- header -->
        <div class="px-5 pt-4 pb-3 border-b border-gray-100 flex items-start justify-between gap-3 shrink-0">
          <div>
            <h2 class="text-sm font-semibold text-gray-900 flex items-center gap-2"><i class="pi pi-search text-primary text-xs" /> Find a class</h2>
            <p class="text-xs text-gray-500 mt-0.5">Match someone to the right class.</p>
          </div>
          <button class="text-gray-400 hover:text-gray-700" @click="finder.close()"><i class="pi pi-times" /></button>
        </div>

        <!-- search -->
        <div class="flex-1 min-h-0 flex flex-col">
          <!-- params -->
          <div class="px-5 py-4 border-b border-gray-100 space-y-3 shrink-0 max-h-[52%] overflow-y-auto">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-xs font-medium text-gray-500 block mb-1">Age</label>
                <InputNumber v-model="params.age" :min="0" :max="99" placeholder="Any" showButtons buttonLayout="stacked" class="w-full" inputClass="w-full" />
              </div>
              <div>
                <label class="text-xs font-medium text-gray-500 block mb-1">Gender</label>
                <Select v-model="params.gender" :options="GENDER_OPTIONS" optionLabel="label" optionValue="value" class="w-full" />
              </div>
            </div>
            <div>
              <label class="text-xs font-medium text-gray-500 block mb-1">Day</label>
              <div class="flex flex-wrap gap-1">
                <button v-for="d in WEEKDAYS" :key="d.value" type="button" @click="toggleDay(d.value)"
                  class="px-2.5 py-1 rounded-md text-xs font-medium border transition-colors"
                  :class="params.days.includes(d.value) ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'">{{ d.label }}</button>
              </div>
            </div>
            <div>
              <label class="text-xs font-medium text-gray-500 block mb-1">Time of day</label>
              <div class="flex flex-wrap gap-1">
                <button v-for="b in TIME_BANDS" :key="b.value" type="button" @click="params.timeBand = b.value as any"
                  class="px-2.5 py-1 rounded-md text-xs font-medium border transition-colors"
                  :class="params.timeBand === b.value ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'">{{ b.label }}</button>
              </div>
            </div>
            <div>
              <label class="text-xs font-medium text-gray-500 block mb-1">Programme</label>
              <MultiSelect v-model="params.codeIds" :options="codeOptions" optionLabel="label" optionValue="value" display="chip"
                placeholder="Any programme" :maxSelectedLabels="2" class="w-full" :showToggleAll="false" filter />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-xs font-medium text-gray-500 block mb-1">Term</label>
                <Select v-model="params.termId" :options="termOptions" optionLabel="label" optionValue="value" class="w-full" />
              </div>
              <div>
                <label class="text-xs font-medium text-gray-500 block mb-1">Venue</label>
                <Select v-model="params.venue" :options="venueOptions" optionLabel="label" optionValue="value" class="w-full" filter />
              </div>
            </div>
            <div class="flex items-center justify-between pt-1">
              <label class="text-xs font-medium text-gray-600 flex items-center gap-2">
                <ToggleSwitch v-model="params.onlyWithSpace" /> Only classes with space
              </label>
              <button v-if="activeFilterCount" type="button" class="text-xs text-gray-400 hover:text-gray-700" @click="finder.resetParams()">Reset</button>
            </div>
          </div>

          <!-- results (only once the user has started filling in the form) -->
          <div class="flex-1 min-h-0 overflow-y-auto">
            <div v-if="!hasCriteria" class="p-8 text-center">
              <i class="pi pi-sliders-h text-2xl text-gray-300 mb-2 block" />
              <p class="text-sm text-gray-600 font-medium">Enter a few details above</p>
              <p class="text-xs text-gray-400 mt-1">Age, day, programme… and we'll find matching classes.</p>
            </div>
            <template v-else>
            <div class="px-5 py-2 text-xs text-gray-400 sticky top-0 bg-white/95 backdrop-blur border-b border-gray-50">
              {{ loading ? 'Searching…' : `${results.length} ${results.length === 1 ? 'class' : 'classes'} match` }}
            </div>
            <div v-if="loading" class="p-10 text-center text-gray-400"><i class="pi pi-spin pi-spinner text-xl" /></div>
            <div v-else-if="!results.length" class="p-8 text-center">
              <i class="pi pi-search text-2xl text-gray-300 mb-2 block" />
              <p class="text-sm text-gray-600 font-medium">No classes match</p>
              <p class="text-xs text-gray-400 mt-1">Try loosening a filter.</p>
            </div>
            <div v-else class="p-3 space-y-2">
              <div v-for="c in results" :key="c.groupId"
                class="relative card p-0 overflow-hidden flex items-stretch">
                <span class="w-1.5 shrink-0" :style="{ background: c.color }" />
                <div class="flex-1 min-w-0 px-3 py-2.5">
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                      <p class="text-sm font-semibold text-gray-800 truncate">{{ c.name }}</p>
                      <p v-if="c.codeName" class="text-[11px] text-gray-400 truncate">{{ c.codeName }}</p>
                    </div>
                    <span class="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded" :class="spaceClass(c)">{{ spaceLabel(c) }}</span>
                  </div>
                  <div class="mt-1.5 space-y-0.5">
                    <p v-for="(s, i) in c.sessions" :key="i" class="text-[11px] text-gray-500 tabular-nums flex items-center gap-1">
                      <span class="text-gray-400 w-8 shrink-0">{{ dayShort(s.day) }}</span>{{ fmtTime(s.startMin) }} – {{ fmtTime(s.endMin) }}
                    </p>
                  </div>
                  <p v-if="c.venues.length || c.coach || c.ageRange" class="text-[11px] text-gray-400 mt-1 truncate">
                    <span v-if="c.venues.length"><i class="pi pi-map-marker text-[8px]" /> {{ c.venues.join(', ') }}</span>
                    <span v-if="c.coach"> · {{ c.coach }}</span>
                    <span v-if="c.ageRange"> · Age {{ c.ageRange }}</span>
                  </p>
                  <div class="flex items-center gap-3 mt-2">
                    <button type="button" @click="addPersonToClass(c)"
                      class="text-xs font-medium px-2 py-1 rounded-md border bg-white border-gray-200 text-gray-700 hover:border-gray-300 transition-colors inline-flex items-center gap-1">
                      <i class="pi pi-user-plus text-[10px]" /> Add person
                    </button>
                    <button type="button" @click="viewClass(c)" class="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1">Open class <i class="pi pi-angle-right text-[10px]" /></button>
                  </div>
                </div>
              </div>
            </div>
            </template>
          </div>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
.cf-fade-enter-active, .cf-fade-leave-active { transition: opacity .25s ease; }
.cf-fade-enter-from, .cf-fade-leave-to { opacity: 0; }
.cf-drawer-enter-active, .cf-drawer-leave-active { transition: transform .28s cubic-bezier(.4, 0, .2, 1); }
.cf-drawer-enter-from, .cf-drawer-leave-to { transform: translateX(100%); }
</style>
