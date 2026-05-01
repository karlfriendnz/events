<template>
  <div v-if="loading" class="flex items-center justify-center h-screen text-sm text-gray-400">Loading…</div>

  <BookingScheduler v-else-if="activity?.booking_flow === 'scheduler'"
    :activity-id="activity.id" />

  <BookingWizard v-else />
</template>

<script setup lang="ts">
definePageMeta({ layout: 'embed' })

const route = useRoute()
const db = useDb()

const activity = ref<any | null>(null)
const loading = ref(true)

async function load() {
  // Public flow gets ?activityId=… (and a ?org=… that the wizard reads).
  // If no activityId is set we fall through to the wizard which has its own
  // activity picker.
  const activityId = String(route.query.activityId ?? '')
  if (!activityId) { loading.value = false; return }
  const { data } = await (db.from as any)('activities')
    .select('id, name, color, icon, booking_flow, status, bookings_enabled')
    .eq('id', activityId)
    .maybeSingle()
  if (data && data.status === 'ACTIVE' && data.bookings_enabled !== false) {
    activity.value = data
  }
  loading.value = false
}
load()
</script>
