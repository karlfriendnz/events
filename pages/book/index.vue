<template>
  <div v-if="loading" class="flex items-center justify-center h-screen text-sm text-gray-400">Loading…</div>

  <!-- Picked a scheduler activity (Tennis, Football, Swimming).
       showBackToPicker only when the user came in via the picker —
       deep-linked embeds (?activityId=…) skip it so the host page
       isn't offering a "back" that goes nowhere meaningful. -->
  <BookingScheduler v-else-if="picked && picked.booking_flow === 'scheduler'"
    :activity-id="picked.id"
    :show-back-to-picker="!cameFromDeepLink"
    @back="picked = null"
    @cancel="picked = null" />

  <!-- Picked a wizard activity (Birthdays etc.) — pre-select so the
       wizard skips its own activity-picker step. Back on the first
       visible step bubbles here so we can re-show the picker. -->
  <BookingWizard v-else-if="picked"
    :activity-id="picked.id"
    :show-back-to-picker="!cameFromDeepLink"
    @back="picked = null"
    @cancel="picked = null" />

  <!-- No activity yet — show the picker. No wizard step strip here
       because we haven't entered any flow yet; the user is choosing
       between completely different booking journeys. -->
  <div v-else class="min-h-screen bg-gray-50 px-4 py-10 sm:py-16">
    <div class="max-w-3xl mx-auto">
      <header class="text-center mb-8">
        <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">What would you like to book?</h1>
        <p class="text-sm text-gray-500 mt-1.5">Pick an option below to start.</p>
      </header>

      <div v-if="!activities.length" class="text-center text-sm text-gray-400 py-12">
        No bookable activities are available right now.
      </div>
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button v-for="a in activities" :key="a.id" type="button"
          class="group flex items-center gap-4 px-5 py-4 bg-white rounded-xl border-2 border-gray-100 hover:border-[#1E2157]/40 hover:shadow-sm transition-all text-left"
          @click="picked = a">
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
          <i class="pi pi-arrow-right text-gray-300 group-hover:text-[#1E2157] transition-colors" />
        </button>
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
  booking_flow: 'wizard' | 'scheduler'
  status: string
  bookings_enabled: boolean | null
}

const route = useRoute()
const db = useDb()

const activities = ref<Activity[]>([])
const picked = ref<Activity | null>(null)
const loading = ref(true)
// True when the embed was deep-linked straight at an activity (the host
// site has its own "Book Tennis" button, no picker on this page). When
// true, we don't render a back button inside BookingScheduler /
// BookingWizard — there's nowhere to go back to inside this iframe.
const cameFromDeepLink = ref(false)

// Friendly subtitle when an activity has no description set.
function activitySubtitle(a: Activity): string {
  return a.booking_flow === 'scheduler'
    ? 'Pick a court, time, and how you want to play.'
    : 'Step through the booking and we\'ll guide you.'
}

async function load() {
  const orgId = route.query.org as string | undefined
  if (!orgId) { loading.value = false; return }
  const { data } = await (db.from as any)('activities')
    .select('id, name, description, color, icon, image_url, booking_flow, status, bookings_enabled')
    .eq('org_id', orgId)
    .eq('status', 'ACTIVE')
    .neq('bookings_enabled', false)
    .order('sort_order')
    .order('name')
  activities.value = (data ?? []) as Activity[]

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
  loading.value = false
}
load()
</script>
