<template>
  <div class="flex flex-col h-full relative">
    <!-- Activity picker — shown until the staff member chooses an activity. -->
    <div v-if="!activeActivity" class="flex-1 overflow-y-auto bg-[#F5F8FA]">
      <div class="max-w-3xl mx-auto py-10 px-6">
        <h1 class="text-xl font-bold text-gray-900">New booking</h1>
        <p class="text-sm text-gray-500 mt-1">Pick what's being booked. Different activities use different flows.</p>

        <div v-if="loading" class="text-sm text-gray-400 py-8 text-center">Loading…</div>
        <div v-else-if="!activities.length" class="text-sm text-gray-400 py-8 text-center">
          No bookable activities yet. Create one in <NuxtLink to="/bookables?tab=activities" class="text-[#0e43a3] underline">Activities</NuxtLink>.
        </div>
        <div v-else class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button v-for="a in activities" :key="a.id" type="button"
            class="flex items-start gap-3 px-4 py-4 rounded-xl border-2 bg-white text-left transition-all border-gray-100 hover:border-gray-200 hover:shadow-sm"
            @click="pickActivity(a)">
            <div class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              :style="`background:${a.color || '#1E2157'}1A;color:${a.color || '#1E2157'}`">
              <i :class="`pi ${a.icon || 'pi-bolt'} text-base`" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-bold text-gray-900 truncate">{{ a.name }}</p>
              <p class="text-xs text-gray-400">
                {{ a.booking_flow === 'scheduler' ? 'Scheduler grid · 3-step booking' : 'Wizard · guided booking' }}
              </p>
            </div>
            <i class="pi pi-arrow-right text-gray-300 text-xs mt-1" />
          </button>
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
    <BookingWizard v-else
      :activity-id="activeActivity.id"
      staff />

  </div>
</template>

<script setup lang="ts">
const db = useDb()
const route = useRoute()
const { orgId } = useOrg()

const loading = ref(true)
const activities = ref<any[]>([])
const activeActivity = ref<any | null>(null)

async function load() {
  if (!orgId.value) return
  loading.value = true
  const { data } = await (db.from as any)('activities')
    .select('id, name, color, icon, booking_flow, status, bookings_enabled')
    .eq('org_id', orgId.value)
    .eq('status', 'ACTIVE')
    .eq('bookings_enabled', true)
    .order('name')
  activities.value = data ?? []
  loading.value = false
  // Pre-select if the caller passed ?activityId= (e.g. coming from
  // /activities/:id "Booking link" → straight into the right flow).
  const presetId = String(route.query.activityId ?? '')
  if (presetId) {
    const match = activities.value.find(a => a.id === presetId)
    if (match) activeActivity.value = match
  }
}
watch(orgId, load, { immediate: true })

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
}
function goBack() {
  activeActivity.value = null
}
</script>
