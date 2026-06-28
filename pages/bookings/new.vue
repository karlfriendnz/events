<template>
  <div class="flex flex-col h-full relative">
    <!-- Picker — shown until the staff member chooses a path. Mirrors the
         public /book home: each non-coach activity gets its own card,
         coach activities aggregate under a single "Coaching" entry. -->
    <div v-if="!activeActivity" class="flex-1 overflow-y-auto bg-[#F5F8FA]">
      <div class="max-w-3xl mx-auto py-6 sm:py-10 px-3 sm:px-6 pb-20 md:pb-10">
        <h1 class="text-xl font-bold text-gray-900">New booking</h1>
        <p class="text-sm text-gray-500 mt-1">
          Pick what you'd like to book.
        </p>

        <div v-if="loading" class="text-sm text-gray-400 py-8 text-center">Loading…</div>

        <!-- Home: activities + single Coaching aggregator. -->
        <div v-else-if="!activeCategory" class="mt-6">
          <div v-if="!activities.length" class="text-sm text-gray-400 py-12 text-center">
            No bookable activities yet.
          </div>
          <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button v-if="coachActivities.length" type="button"
              class="flex items-center gap-4 px-5 py-4 bg-white rounded-xl border-2 border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all text-left"
              @click="activeCategory = '__coaching__'; categoryView = 'services'">
              <div class="w-12 h-12 rounded-xl shrink-0 flex items-center justify-center bg-primary/10">
                <i class="pi pi-user text-xl text-primary" />
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
              class="flex items-center gap-4 px-5 py-4 bg-white rounded-xl border-2 border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all text-left"
              @click="pickActivity(a)">
              <div class="w-12 h-12 rounded-xl shrink-0 flex items-center justify-center overflow-hidden"
                :style="{ background: a.color ? `${a.color}1A` : '#1E21571A' }">
                <img v-if="a.image_url" :src="a.image_url" class="w-full h-full object-cover" />
                <i v-else class="pi text-xl"
                  :class="a.icon || 'pi-bolt'"
                  :style="{ color: a.color || '#1E2157' }" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-base font-bold text-gray-900 truncate">{{ a.name }}</p>
                <p class="text-xs text-gray-500 mt-0.5 line-clamp-2">{{ a.description || activitySubtitle(a) }}</p>
              </div>
              <i class="pi pi-arrow-right text-gray-300" />
            </button>
          </div>
        </div>

        <!-- Drill-down — Coaching: Services / Coaches toggle. -->
        <div v-else class="mt-6">
          <button type="button" class="text-xs font-semibold text-gray-500 hover:text-gray-700 mb-3 flex items-center gap-1"
            @click="resetCategory">
            <i class="pi pi-arrow-left text-[10px]" /> Back
          </button>
          <div class="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 class="text-base font-bold text-gray-900">Coaching</h2>
              <p class="text-xs text-gray-500 mt-0.5">
                {{ categoryView === 'services' ? 'Pick a service — coach listed beside each.' : 'Pick a coach to see what they offer.' }}
              </p>
            </div>
            <div class="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1 shrink-0">
              <button v-for="t in ['services', 'coaches']" :key="t" type="button"
                class="px-3 py-1 rounded-md text-[11px] font-semibold transition-colors"
                :class="categoryView === t ? 'bg-primary text-white' : 'text-gray-500 hover:text-gray-700'"
                @click="categoryView = t as any">
                {{ t === 'services' ? 'Services' : 'Coaches' }}
              </button>
            </div>
          </div>

          <!-- SERVICES view — modes from coach activities, grouped by category -->
          <div v-if="categoryView === 'services'">
            <div v-if="!modesInCategory.length" class="text-sm text-gray-400 py-8 text-center">No options here right now.</div>
            <div v-else class="space-y-5">
              <div v-for="g in groupedModesInCategory" :key="g.name">
                <p class="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">{{ g.name }}</p>
                <div class="grid grid-cols-1 gap-2">
                  <button v-for="m in g.modes" :key="m.id" type="button"
                    class="flex items-start gap-3 px-4 py-3 rounded-xl border-2 bg-white text-left transition-all border-gray-100 hover:border-gray-200 hover:shadow-sm"
                    @click="pickActivityWithMode(m.activity, m.id)">
                    <div class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      :style="`background:${m.activity.color || '#1E2157'}1A;color:${m.activity.color || '#1E2157'}`">
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

          <!-- COACHES view — list of coach activities -->
          <div v-else>
            <div v-if="!providersInCategory.length" class="text-sm text-gray-400 py-8 text-center">No coaches yet.</div>
            <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button v-for="a in providersInCategory" :key="a.id" type="button"
                class="flex items-start gap-3 px-4 py-4 rounded-xl border-2 bg-white text-left transition-all border-gray-100 hover:border-gray-200 hover:shadow-sm"
                @click="pickActivity(a)">
                <div class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  :style="`background:${a.color || '#1E2157'}1A;color:${a.color || '#1E2157'}`">
                  <i :class="`pi ${a.icon || 'pi-user'} text-base`" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-bold text-gray-900 truncate">{{ a.name }}</p>
                  <p class="text-xs text-gray-400">
                    {{ a.modeCount }} option{{ a.modeCount === 1 ? '' : 's' }}
                    <span class="ml-1 inline-block bg-emerald-50 text-emerald-700 text-[10px] font-bold px-1 py-0.5 rounded">Coach</span>
                  </p>
                </div>
                <i class="pi pi-arrow-right text-gray-300 text-xs mt-1" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Selected: render the right flow -->
    <BookingScheduler v-else-if="activeActivity.booking_flow === 'scheduler'"
      :activity-id="activeActivity.id"
      :preset-bookable-id="presetBookableId"
      :preset-start="presetStart"
      :preset-end="presetEnd"
      staff
      @done="goBack" />
    <ItemBooker v-else-if="activeActivity.booking_flow === 'item'"
      :activity-id="activeActivity.id"
      staff
      @back="goBack"
      @done="goBack" />
    <BookingWizard v-else
      :activity-id="activeActivity.id"
      :preset-mode-id="activeModeId"
      staff />

  </div>
</template>

<script setup lang="ts">
const db = useDb()
const route = useRoute()
const { orgId } = useOrg()

const loading = ref(true)
const activities = ref<any[]>([])
const allModes = ref<any[]>([])
const activeActivity = ref<any | null>(null)
const activeModeId = ref<string | null>(null)

// Drill-down state. activeCategory:
//   null            — home (activity cards + Coaching aggregator)
//   '__coaching__'  — Coaching drill-down with services/coaches toggle
const activeCategory = ref<string | null>(null)
const categoryView = ref<'services' | 'coaches'>('services')

function resetCategory() {
  activeCategory.value = null
  categoryView.value = 'services'
}

async function load() {
  if (!orgId.value) return
  loading.value = true
  const [{ data: actData }, { data: modeData }] = await Promise.all([
    (db.from as any)('activities')
      .select('id, name, description, color, icon, image_url, booking_flow, status, bookings_enabled, staff_bookable_id')
      .eq('org_id', orgId.value)
      .eq('status', 'ACTIVE')
      .eq('bookings_enabled', true)
      .order('name'),
    (db.from as any)('activity_modes')
      .select('id, name, activity_id, category, period_price, period_unit, sort_order')
      .order('sort_order').order('name'),
  ])
  const orgActivityIds = new Set((actData ?? []).map((a: any) => a.id))
  const activitiesById: Record<string, any> = {}
  for (const a of actData ?? []) activitiesById[a.id] = a
  activities.value = actData ?? []
  allModes.value = (modeData ?? [])
    .filter((m: any) => orgActivityIds.has(m.activity_id))
    .map((m: any) => ({ ...m, activity: activitiesById[m.activity_id] }))
  loading.value = false
  // Pre-select if the caller passed ?activityId= (e.g. coming from
  // /activities/:id "Booking link" → straight into the right flow).
  const presetId = String(route.query.activityId ?? '')
  if (presetId) {
    const match = activities.value.find(a => a.id === presetId)
    if (match) activeActivity.value = match
  }
  // Single-activity orgs: skip the picker — there's nothing to choose
  // between, so jump straight into that activity's flow.
  if (!activeActivity.value && activities.value.length === 1) {
    activeActivity.value = activities.value[0]
  }
}
watch(orgId, load, { immediate: true })

function activitySubtitle(a: any): string {
  if (a.booking_flow === 'scheduler') return 'Pick a court, time, and how you want to play.'
  if (a.booking_flow === 'item') return 'Pick a rate, pick when, and you\'re away.'
  return 'Step through the booking and we\'ll guide you.'
}

// Coach vs non-coach split for the home grid.
const coachActivities = computed(() => activities.value.filter(a => !!a.staff_bookable_id))
const nonCoachActivities = computed(() => activities.value.filter(a => !a.staff_bookable_id))

// Modes inside the Coaching drill-down — every mode whose activity is a coach.
const modesInCategory = computed(() => {
  if (activeCategory.value !== '__coaching__') return []
  return allModes.value.filter(m => !!m.activity?.staff_bookable_id)
})

// Group coach modes by category so the Services view shows Tennis / Cricket / …
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
      if (a.name === 'Other') return 1
      if (b.name === 'Other') return -1
      return a.name.localeCompare(b.name)
    })
})

// Coach activities for the Coaches view, with their mode counts.
const providersInCategory = computed(() => {
  if (activeCategory.value !== '__coaching__') return []
  return coachActivities.value.map(a => ({
    ...a,
    modeCount: allModes.value.filter(m => m.activity_id === a.id).length,
  }))
})

// Slot context — passed through from the venue page when an admin clicks a
// specific availability slot. The scheduler picks these up to skip straight
// to the mode dialog with the slot pre-filled.
const presetBookableId = computed(() => (route.query.bookableId as string | undefined) ?? null)
const presetStart = computed(() => buildPresetIso(route.query.date as string | undefined, route.query.startTime as string | undefined))
const presetEnd   = computed(() => buildPresetIso(route.query.date as string | undefined, route.query.endTime as string | undefined))

function buildPresetIso(dateIso?: string | null, timeStr?: string | null): string | null {
  if (!dateIso || !timeStr) return null
  const d = new Date(dateIso)
  const [h, m] = timeStr.split(':').map(Number)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

function pickActivity(a: any) {
  activeActivity.value = a
  activeModeId.value = null
}
function pickActivityWithMode(activity: any, modeId: string) {
  activeActivity.value = activity
  activeModeId.value = modeId
}
function goBack() {
  activeActivity.value = null
  activeModeId.value = null
  activeCategory.value = null
  categoryView.value = 'services'
}
</script>
