<template>
  <!-- Theme wrapper. CSS vars from the org's booker_theme cascade into
       every nested component, so any element styled with var(--booker-…)
       picks up the brand colours without extra plumbing. -->
  <div :style="themeVars" class="min-h-full">
    <div v-if="loading" class="flex items-center justify-center h-screen text-sm text-gray-400">Loading…</div>

    <BookingScheduler v-else-if="picked && picked.booking_flow === 'scheduler'"
      :activity-id="picked.id"
      :show-back-to-picker="!cameFromDeepLink"
      :embedded="embedded"
      @back="onPickerBack"
      @cancel="onPickerBack" />

    <ItemBooker v-else-if="picked && picked.booking_flow === 'item'"
      :activity-id="picked.id"
      :show-back-to-picker="!cameFromDeepLink"
      :embedded="embedded"
      @back="onPickerBack"
      @cancel="onPickerBack" />

    <BookingWizard v-else-if="picked"
      :activity-id="picked.id"
      :preset-mode-id="pickedModeId"
      :show-back-to-picker="!cameFromDeepLink"
      :embedded="embedded"
      @back="onPickerBack"
      @cancel="onPickerBack" />

    <!-- No activity yet — show the picker. Embedded variant fills the
         iframe edge-to-edge; standalone "Open" variant centres the
         cards so a standalone page doesn't look stretched on a wide
         monitor. Background uses the org's themed canvas colour. -->
    <div v-else class="min-h-screen px-4 py-10 sm:py-16"
      :style="{ background: theme.canvas }">
      <div :class="embedded ? '' : 'max-w-3xl mx-auto'">
        <header class="text-center mb-8">
          <h1 class="text-xl sm:text-3xl font-bold text-gray-900 tracking-tight">What would you like to book?</h1>
          <p class="text-sm text-gray-500 mt-1.5">Pick an option below to start.</p>
        </header>

        <div v-if="!activities.length" class="text-center text-sm text-gray-400 py-12">
          No bookable activities are available right now.
        </div>

        <!-- Main home: each non-coach activity as its own card, plus a
             single aggregate "Coaching" card if any coaches exist.
             Coaches don't appear by name on the front page so the menu
             stays short — clicking Coaching drills into the by-service
             / by-coach toggle. -->
        <div v-else-if="!activeCategory">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button v-if="coachActivities.length" type="button"
              class="group flex items-center gap-4 px-5 py-4 bg-white rounded-xl border-2 border-gray-100 hover:shadow-sm transition-all text-left"
              @click="activeCategory = '__coaching__'; categoryView = 'services'">
              <div class="w-12 h-12 rounded-xl shrink-0 flex items-center justify-center"
                :style="{ background: `${theme.primary}1A` }">
                <i class="pi pi-user text-xl" :style="{ color: theme.primary }" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-base font-bold text-gray-900 truncate">Coaching</p>
                <p class="text-xs text-gray-500 mt-0.5">
                  {{ coachActivities.length }} coach{{ coachActivities.length === 1 ? '' : 'es' }} —
                  pick a service or a person.
                </p>
              </div>
              <i class="pi pi-arrow-right text-gray-300" />
            </button>

            <button v-for="a in nonCoachActivities" :key="a.id" type="button"
              class="group flex items-center gap-4 px-5 py-4 bg-white rounded-xl border-2 border-gray-100 hover:shadow-sm transition-all text-left"
              :style="{ '--hover-border': theme.primary } as any"
              onmouseover="this.style.borderColor=this.style.getPropertyValue('--hover-border')+'66'"
              onmouseout="this.style.borderColor=''"
              @click="picked = a">
              <div class="w-12 h-12 rounded-xl shrink-0 flex items-center justify-center overflow-hidden"
                :style="{ background: a.color ? `${a.color}1A` : `${theme.primary}1A` }">
                <img v-if="a.image_url" :src="a.image_url" class="w-full h-full object-cover" />
                <i v-else class="pi text-xl"
                  :class="a.icon || 'pi-bolt'"
                  :style="{ color: a.color || theme.primary }" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-base font-bold text-gray-900 truncate">{{ a.name }}</p>
                <p class="text-xs text-gray-500 mt-0.5 line-clamp-2">{{ a.description || activitySubtitle(a) }}</p>
              </div>
              <i class="pi pi-arrow-right text-gray-300" />
            </button>
          </div>
          <p v-if="!coachActivities.length && !nonCoachActivities.length" class="text-sm text-gray-400 text-center py-12">
            Nothing to book right now.
          </p>
        </div>

        <!-- Drill-down — has a Services/Coaches toggle when scoped to a
             specific category, but for the "Every activity" landing
             ('__all__') it's just a clean grid menu so the visitor isn't
             distracted with controls before they've picked anything. -->
        <div v-else>
          <button v-if="activeCategory !== '__all__'" type="button"
            class="text-xs font-semibold text-gray-500 hover:text-gray-700 mb-3 flex items-center gap-1"
            @click="resetCategory">
            <i class="pi pi-arrow-left text-[10px]" /> Back
          </button>
          <div v-if="activeCategory !== '__all__'" class="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 class="text-base font-bold text-gray-900">{{ activeCategory === '__coaching__' ? 'Coaching' : activeCategory }}</h2>
              <p class="text-xs text-gray-500 mt-0.5">
                {{ categoryView === 'services' ? 'Pick a service — coach listed beside each.' : 'Pick a coach to see what they offer.' }}
              </p>
            </div>
            <div class="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1 shrink-0">
              <button v-for="t in ['services', 'coaches']" :key="t" type="button"
                class="px-3 py-1 rounded-md text-[11px] font-semibold transition-colors"
                :class="categoryView === t ? 'text-white' : 'text-gray-500 hover:text-gray-700'"
                :style="categoryView === t ? { background: theme.primary } : {}"
                @click="categoryView = t as any">
                {{ t === 'services' ? 'Services' : 'Coaches' }}
              </button>
            </div>
          </div>

          <div v-if="categoryView === 'services'">
            <div v-if="!modesInCategory.length" class="text-sm text-gray-400 py-8 text-center">No options here right now.</div>
            <div v-else class="space-y-5">
              <!-- Group by category (Tennis, Cricket, …). Modes without a
                   category fall under an "Other" heading. Within Coaching
                   the ordering is alphabetical by category name. -->
              <div v-for="g in groupedModesInCategory" :key="g.name">
                <p class="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">{{ g.name }}</p>
                <div class="grid grid-cols-1 gap-2">
                  <button v-for="m in g.modes" :key="m.id" type="button"
                    class="flex items-start gap-3 px-4 py-3 rounded-xl border-2 bg-white text-left transition-all border-gray-100 hover:shadow-sm"
                    @click="pickModeFromCategory(m)">
                    <div class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      :style="`background:${m.activity.color || theme.primary}1A;color:${m.activity.color || theme.primary}`">
                      <i :class="`pi ${m.activity.icon || 'pi-bolt'} text-base`" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-bold text-gray-900 truncate">{{ m.name }}</p>
                      <p class="text-xs text-gray-400">
                        via <span class="font-semibold text-gray-600">{{ m.activity.name }}</span>
                        <span v-if="m.period_price != null" class="ml-1">· ${{ m.period_price }}<span v-if="m.period_unit"> / {{ m.period_unit }}</span></span>
                      </p>
                    </div>
                    <i class="pi pi-arrow-right text-gray-300 text-xs mt-1" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div v-else>
            <div v-if="!providersInCategory.length" class="text-sm text-gray-400 py-8 text-center">No providers in this category yet.</div>
            <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button v-for="a in providersInCategory" :key="a.id" type="button"
                class="group flex items-center gap-4 px-5 py-4 bg-white rounded-xl border-2 border-gray-100 hover:shadow-sm transition-all text-left"
                @click="picked = a">
                <div class="w-12 h-12 rounded-xl shrink-0 flex items-center justify-center"
                  :style="{ background: a.color ? `${a.color}1A` : `${theme.primary}1A` }">
                  <img v-if="a.image_url" :src="a.image_url" class="w-full h-full object-cover rounded-xl" />
                  <i v-else class="pi text-xl"
                    :class="a.icon || (a.staff_bookable_id ? 'pi-user' : 'pi-bolt')"
                    :style="{ color: a.color || theme.primary }" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-base font-bold text-gray-900 truncate">{{ a.name }}</p>
                  <!-- Subtitle only appears when the visitor is in a
                       specific category — on the "Every activity" landing
                       the grid is just a menu, no extra metadata. -->
                  <p v-if="activeCategory !== '__all__'" class="text-xs text-gray-500 mt-0.5">
                    {{ a.modeCount }} option{{ a.modeCount === 1 ? '' : 's' }}
                    <span v-if="a.staff_bookable_id" class="ml-1 inline-block bg-emerald-50 text-emerald-700 text-[10px] font-bold px-1 py-0.5 rounded">Coach</span>
                  </p>
                  <p v-else-if="a.description" class="text-xs text-gray-500 mt-0.5 line-clamp-2">{{ a.description }}</p>
                </div>
                <i class="pi pi-arrow-right text-gray-300" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'embed' })

interface Activity {
  id: string
  name: string
  description: string | null
  color: string | null
  icon: string | null
  image_url: string | null
  booking_flow: 'wizard' | 'scheduler' | 'item'
  status: string
  bookings_enabled: boolean | null
  staff_bookable_id?: string | null
}

const route = useRoute()
const db = useDb()

const activities = ref<Activity[]>([])
const allModes = ref<any[]>([])
const picked = ref<Activity | null>(null)
const pickedModeId = ref<string | null>(null)
const loading = ref(true)
// Drill-down state. activeCategory:
//   null              — show the home (non-coach activities + Coaching card)
//   '__coaching__'    — show all coach activities in services/coaches toggle
//   '__all__'         — every activity (legacy "browse everything" link)
//   <category name>   — that specific service category
const activeCategory = ref<string | null>(null)
const categoryView = ref<'services' | 'coaches'>('services')

function resetCategory() {
  activeCategory.value = null
  categoryView.value = 'services'
}
// True when the embed was deep-linked straight at an activity (the host
// site has its own "Book Tennis" button, no picker on this page). When
// true, we don't render a back button inside BookingScheduler /
// BookingWizard — there's nowhere to go back to inside this iframe.
const cameFromDeepLink = ref(false)
// True when the page is being embedded in an iframe — the snippet copied
// from the public-links popover sets ?embed=1, which switches the views
// to fill the host container edge-to-edge instead of the centred,
// max-width "Open" layout.
const embedded = computed(() => route.query.embed === '1' || route.query.embed === 'true')

// Org-level theme. booker_theme is jsonb so settings can grow without
// another migration; for now we read the three colours and fall back
// to FriendlyManager defaults when the column is missing values.
interface BookerTheme { canvas: string; primary: string; on_primary: string }
const theme = ref<BookerTheme>({ canvas: '#F5F8FA', primary: '#1E2157', on_primary: '#FFFFFF' })
const themeVars = computed(() => ({
  '--booker-canvas': theme.value.canvas,
  '--booker-primary': theme.value.primary,
  '--booker-on-primary': theme.value.on_primary,
} as any))

// Friendly subtitle when an activity has no description set.
function activitySubtitle(a: Activity): string {
  if (a.booking_flow === 'scheduler') return 'Pick a court, time, and how you want to play.'
  if (a.booking_flow === 'item') return 'Pick a rate, pick when, and you\'re away.'
  return 'Step through the booking and we\'ll guide you.'
}

// Distinct categories with counts. Drives the "By service" cards.
const categoryCards = computed(() => {
  const map: Record<string, { name: string; count: number; providers: Set<string> }> = {}
  for (const m of allModes.value) {
    const cat = (m.category ?? '').trim()
    if (!cat) continue
    if (!map[cat]) map[cat] = { name: cat, count: 0, providers: new Set() }
    map[cat].count++
    map[cat].providers.add(m.activity_id)
  }
  return Object.values(map)
    .map(c => ({ name: c.name, count: c.count, providerCount: c.providers.size }))
    .sort((a, b) => a.name.localeCompare(b.name))
})
// Coach vs non-coach split for the home page. Coach activities (those
// with staff_bookable_id set) are aggregated under the single "Coaching"
// card so the front page doesn't list every coach by name.
const coachActivities = computed(() => activities.value.filter(a => !!a.staff_bookable_id))
const nonCoachActivities = computed(() => activities.value.filter(a => !a.staff_bookable_id))

const modesInCategory = computed(() => {
  if (activeCategory.value === '__all__') return allModes.value
  if (activeCategory.value === '__coaching__') {
    return allModes.value.filter(m => !!m.activity?.staff_bookable_id)
  }
  return allModes.value.filter(m => (m.category ?? '').trim() === activeCategory.value)
})

// Same modes as `modesInCategory` but grouped by their `category` field.
// Used by the Services view inside the Coaching drill-down so e.g. "Tennis"
// and "Cricket" each get a heading with their modes underneath.
const groupedModesInCategory = computed(() => {
  const buckets: Record<string, any[]> = {}
  for (const m of modesInCategory.value) {
    const key = (m.category ?? '').trim() || 'Other'
    if (!buckets[key]) buckets[key] = []
    buckets[key].push(m)
  }
  return Object.entries(buckets)
    .map(([name, modes]) => ({ name, modes }))
    .sort((a, b) => {
      // Push the catch-all "Other" bucket to the bottom; otherwise alpha.
      if (a.name === 'Other') return 1
      if (b.name === 'Other') return -1
      return a.name.localeCompare(b.name)
    })
})

// Activities with at least one mode in the active category — the
// "Coaches" pivot inside the drill-down. For '__coaching__' we list
// every coach activity directly (they're the providers).
const providersInCategory = computed(() => {
  if (activeCategory.value === '__coaching__') {
    return coachActivities.value.map(a => ({
      ...a,
      modeCount: allModes.value.filter(m => m.activity_id === a.id).length,
    }))
  }
  const counts: Record<string, number> = {}
  for (const m of modesInCategory.value) counts[m.activity_id] = (counts[m.activity_id] ?? 0) + 1
  return activities.value
    .filter(a => counts[a.id] > 0)
    .map(a => ({ ...a, modeCount: counts[a.id] }))
})
function pickModeFromCategory(m: any) {
  picked.value = m.activity
  pickedModeId.value = m.id
}
function onPickerBack() {
  picked.value = null
  pickedModeId.value = null
  activeCategory.value = null
  categoryView.value = 'services'
}

async function load() {
  const orgId = route.query.org as string | undefined
  if (!orgId) { loading.value = false; return }
  const [{ data: orgRow }, { data }, { data: modes }] = await Promise.all([
    (db.from as any)('organisations')
      .select('booker_theme')
      .eq('id', orgId)
      .maybeSingle(),
    (db.from as any)('activities')
      .select('id, name, description, color, icon, image_url, booking_flow, status, bookings_enabled, staff_bookable_id')
      .eq('org_id', orgId)
      .eq('status', 'ACTIVE')
      .neq('bookings_enabled', false)
      .order('sort_order')
      .order('name'),
    (db.from as any)('activity_modes')
      .select('id, name, activity_id, category, period_price, period_unit, sort_order')
      .order('sort_order').order('name'),
  ])
  // Merge org theme over defaults so a partial jsonb (e.g. only
  // `primary` set) still ends up with sane canvas / on_primary values.
  const t = (orgRow?.booker_theme ?? {}) as Partial<BookerTheme>
  theme.value = {
    canvas: t.canvas || '#F5F8FA',
    primary: t.primary || '#1E2157',
    on_primary: t.on_primary || '#FFFFFF',
  }
  activities.value = (data ?? []) as Activity[]
  // Stitch each mode to its activity for the "By service" view. Modes
  // outside this org are filtered out via the activities list.
  const byId: Record<string, any> = {}
  for (const a of activities.value) byId[a.id] = a
  allModes.value = (modes ?? [])
    .filter((m: any) => byId[m.activity_id])
    .map((m: any) => ({ ...m, activity: byId[m.activity_id] }))

  // Honour ?activityId= so the embed can deep-link straight into one
  // activity's flow (e.g. a "Book Tennis" button on the marketing site).
  // Track the deep-link case so the inner views know not to render a
  // back button — there's no picker to return to.
  const presetId = route.query.activityId as string | undefined
  if (presetId) {
    const match = activities.value.find(a => a.id === presetId)
    if (match) {
      picked.value = match
      cameFromDeepLink.value = true
    }
  }
  // Single-activity orgs: skip the picker entirely. Same back-button
  // suppression as the deep-link case — the picker would just be a
  // single card the visitor would click anyway.
  if (!picked.value && activities.value.length === 1) {
    picked.value = activities.value[0] ?? null
    cameFromDeepLink.value = true
  }
  loading.value = false
}
load()
</script>
