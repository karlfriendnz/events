<template>
  <div class="min-h-screen bg-[#F5F8FA] py-12 px-6">
    <div class="max-w-md mx-auto">

      <div v-if="loading" class="flex items-center justify-center py-24 text-gray-400">
        <i class="pi pi-spin pi-spinner text-2xl" />
      </div>

      <div v-else-if="error"
        class="bg-white rounded-2xl border border-gray-200 px-6 py-12 text-center">
        <div class="w-14 h-14 mx-auto rounded-full bg-red-50 flex items-center justify-center mb-3">
          <i class="pi pi-times-circle text-2xl text-red-400" />
        </div>
        <p class="text-base font-semibold text-gray-700">Booking not found</p>
        <p class="text-sm text-gray-400 mt-1">Double-check the reference number on your confirmation email.</p>
      </div>

      <div v-else-if="b" class="space-y-5">
        <!-- Status hero -->
        <div class="text-center space-y-3">
          <div class="w-14 h-14 mx-auto rounded-full flex items-center justify-center"
            :class="statusBg">
            <i class="pi text-xl" :class="statusIcon" />
          </div>
          <div>
            <h1 class="text-xl font-bold text-gray-900">{{ statusTitle }}</h1>
            <p class="text-sm text-gray-500 mt-1">{{ statusBody }}</p>
          </div>
          <div class="flex items-center justify-center gap-2 text-xs">
            <span class="text-gray-500">Reference</span>
            <span class="font-mono font-semibold text-gray-800 bg-gray-100 rounded px-2 py-1">{{ b.reference }}</span>
          </div>
        </div>

        <!-- Booking summary card -->
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden text-left">
          <div class="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Booking summary</p>
            <span class="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
              :class="statusPill">
              {{ b.status }}
            </span>
          </div>
          <div class="p-4 space-y-3">
            <div v-if="b.activity">
              <p class="text-xs text-gray-400 mb-0.5">Activity</p>
              <p class="text-sm font-medium text-gray-900">{{ b.activity.name }}<template v-if="b.activity_mode"> — {{ b.activity_mode.name }}</template></p>
            </div>
            <div v-if="b.venue">
              <p class="text-xs text-gray-400 mb-0.5">Venue</p>
              <p class="text-sm font-medium text-gray-900">{{ b.venue.name }}</p>
              <p v-if="b.venue.location" class="text-xs text-gray-400">{{ b.venue.location }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400 mb-0.5">When</p>
              <p class="text-sm font-medium text-gray-900">{{ whenLabel }}</p>
            </div>
            <div v-if="b.contact_name">
              <p class="text-xs text-gray-400 mb-0.5">Booked by</p>
              <p class="text-sm font-medium text-gray-900">{{ b.contact_name }}</p>
              <p v-if="b.contact_email_masked" class="text-xs text-gray-400">{{ b.contact_email_masked }}</p>
            </div>
            <div v-if="b.attendee_count">
              <p class="text-xs text-gray-400 mb-0.5">Attendees</p>
              <p class="text-sm font-medium text-gray-900">{{ b.attendee_count }} {{ b.attendee_count === 1 ? 'person' : 'people' }}</p>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <p class="text-center text-xs text-gray-400">
          Need to make changes? Email <span class="font-medium text-gray-500">{{ b.org_name || 'the venue' }}</span> and quote your reference.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'embed' })

const route = useRoute()
const b = ref<any>(null)
const loading = ref(true)
const error = ref(false)

const ref_ = computed(() => String(route.params.ref ?? '').replace(/[^0-9a-fA-F]/g, ''))

async function load() {
  loading.value = true
  error.value = false
  try {
    b.value = await $fetch('/api/booking-lookup', { method: 'POST', body: { reference: ref_.value } })
  } catch {
    error.value = true
  }
  loading.value = false
}

const whenLabel = computed(() => {
  if (!b.value?.start_at) return ''
  const s = new Date(b.value.start_at)
  const e = b.value.end_at ? new Date(b.value.end_at) : null
  const dateStr = s.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const startStr = s.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
  if (!e) return `${dateStr} · ${startStr}`
  const endStr = e.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
  return `${dateStr} · ${startStr} – ${endStr}`
})

const statusBg = computed(() =>
  b.value?.status === 'CONFIRMED' ? 'bg-green-100'
    : b.value?.status === 'PENDING' ? 'bg-amber-100'
    : 'bg-gray-100')
const statusIcon = computed(() =>
  b.value?.status === 'CONFIRMED' ? 'pi-check text-green-600'
    : b.value?.status === 'PENDING' ? 'pi-clock text-amber-600'
    : 'pi-times text-gray-500')
const statusPill = computed(() =>
  b.value?.status === 'CONFIRMED' ? 'bg-green-100 text-green-700'
    : b.value?.status === 'PENDING' ? 'bg-amber-100 text-amber-700'
    : 'bg-gray-100 text-gray-600')
const statusTitle = computed(() => {
  if (b.value?.status === 'CONFIRMED') return 'Your booking is confirmed'
  if (b.value?.status === 'PENDING')   return 'Booking received'
  if (b.value?.status === 'CANCELLED') return 'Booking cancelled'
  return 'Booking'
})
const statusBody = computed(() => {
  if (b.value?.status === 'CONFIRMED') return 'See you then.'
  if (b.value?.status === 'PENDING')   return 'We\'re reviewing your booking — we\'ll email you once it\'s confirmed.'
  if (b.value?.status === 'CANCELLED') return 'This booking is no longer active.'
  return ''
})

watch(ref_, load, { immediate: true })
</script>
