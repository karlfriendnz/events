<!--
  Self check-in — the page a member lands on after scanning the event's QR code
  (generated in EventAttendance.vue / the event editor's Attendance tab). One QR
  per event, so the URL carries only the event; the member finds themselves in
  the event's invitee list and taps "Check in".

  Public by design (layout `embed`, allow-listed in auth.global.ts + PUBLIC_PREFIXES):
  the QR is printed at the door, so a member with no login must still be able to
  check in. The credential is (event, person) — /api/public-check-in only marks
  attendance for an invitee row that already exists on this event, so nobody can
  check in to an event they were never invited to (mirrors the /rsvp model).

  Attendance itself is the staff-owned model: this only flips invitees.attended.
-->
<script setup lang="ts">
import { locationSummary } from '~/composables/useLocation'

definePageMeta({ layout: 'embed' })

const route = useRoute()
const eventId = route.params.id as string

const loading = ref(true)
const submitting = ref(false)
const error = ref('')
const data = ref<any>(null)

// The event's invitees (loaded up front) + the person the visitor picks.
const invitees = ref<{ personId: string; name: string }[]>([])
const suggestions = ref<{ personId: string; name: string }[]>([])
const selected = ref<{ personId: string; name: string } | null>(null)

// True once we've checked them in — the page then shows the outcome.
const checkedIn = ref(false)

const cancelled = computed(() => ['CANCELLED', 'ARCHIVED'].includes(data.value?.event?.status))

const whenLabel = computed(() => {
  const s = data.value?.event?.start_at
  if (!s) return 'Date to be confirmed'
  return new Date(s).toLocaleString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit',
  })
})
const whereLabel = computed(() => {
  const locs = data.value?.event?.locations
  if (Array.isArray(locs) && locs.length) return locationSummary(locs)
  return data.value?.event?.address ?? ''
})

function searchInvitees(e: { query: string }) {
  const q = e.query.trim().toLowerCase()
  suggestions.value = q
    ? invitees.value.filter(i => i.name.toLowerCase().includes(q))
    : invitees.value.slice(0, 50)
}

async function load() {
  try {
    // No personId → the endpoint returns the event + its invitee list, so the
    // page can render what they're checking in to and who can check in.
    data.value = await $fetch('/api/public-check-in', { method: 'POST', body: { eventId } })
    invitees.value = (data.value?.invitees ?? []).map((i: any) => ({
      personId: i.personId ?? i.person_id,
      name: i.name ?? `${i.first_name ?? ''} ${i.last_name ?? ''}`.trim(),
    }))
  } catch (e: any) {
    error.value = e?.data?.message || 'This check-in link is no longer valid.'
  } finally {
    loading.value = false
  }
}

async function submit() {
  if (!selected.value?.personId) { error.value = 'Please find and select your name.'; return }
  error.value = ''
  submitting.value = true
  try {
    await $fetch('/api/public-check-in', { method: 'POST', body: { eventId, personId: selected.value.personId } })
    checkedIn.value = true
  } catch (e: any) {
    error.value = e?.data?.message || 'Could not check you in. Please try again.'
  } finally {
    submitting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="min-h-screen bg-[#F5F8FA] flex items-start sm:items-center justify-center p-3 sm:p-6">
    <div class="w-full max-w-lg">
      <div v-if="loading" class="card p-10 text-center text-sm text-gray-400">
        <i class="pi pi-spin pi-spinner text-xl text-gray-300 block mb-2" />
        Loading…
      </div>

      <div v-else-if="error && !data" class="card p-8 text-center">
        <i class="pi pi-exclamation-circle text-2xl text-gray-300 block mb-3" />
        <p class="text-sm text-gray-600">{{ error }}</p>
      </div>

      <div v-else class="card overflow-hidden">
        <!-- The event, so they know what they're checking in to -->
        <div class="px-5 sm:px-6 py-5 border-b border-gray-100">
          <p class="text-xs text-gray-400 mb-1">Check in to</p>
          <h1 class="text-lg sm:text-2xl font-semibold text-gray-900">{{ data.event.title }}</h1>
          <div class="mt-3 space-y-1.5">
            <p class="text-sm text-gray-600 flex items-center gap-2">
              <i class="pi pi-calendar text-gray-300 text-xs" />{{ whenLabel }}
            </p>
            <p v-if="whereLabel" class="text-sm text-gray-600 flex items-center gap-2">
              <i class="pi pi-map-marker text-gray-300 text-xs" />{{ whereLabel }}
            </p>
          </div>
        </div>

        <div class="px-5 sm:px-6 py-6">
          <!-- A cancelled event can't be checked in to -->
          <div v-if="cancelled" class="rounded-lg bg-amber-50 border border-amber-100 px-4 py-3">
            <p class="text-sm text-amber-800">This event has been cancelled — there’s nothing to check in to.</p>
          </div>

          <!-- Find yourself + check in -->
          <template v-else-if="!checkedIn">
            <p class="text-sm font-medium text-gray-800 mb-1">You’re here — let’s check you in</p>
            <p class="text-xs text-gray-500 mb-4">Start typing your name and pick yourself from the list.</p>
            <form class="flex flex-col gap-3" @submit.prevent="submit">
              <AutoComplete v-model="selected" :suggestions="suggestions" optionLabel="name"
                dropdown force-selection placeholder="Your name" class="w-full" input-class="w-full"
                :disabled="submitting" @complete="searchInvitees" />
              <p v-if="error" class="text-xs text-red-600 -mt-1">{{ error }}</p>
              <Button type="submit" label="Check me in" icon="pi pi-check" class="w-full justify-center"
                :loading="submitting" :disabled="!selected" style="background:#059669;border-color:#059669" />
            </form>
          </template>

          <!-- Checked in -->
          <template v-else>
            <div class="flex items-start gap-3 rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3">
              <i class="pi pi-check-circle text-emerald-600 mt-0.5" />
              <div>
                <p class="text-sm font-medium text-emerald-900">
                  {{ selected?.name ? `You’re checked in, ${selected.name.split(' ')[0]}.` : 'You’re checked in.' }}
                </p>
                <p class="text-xs text-emerald-700 mt-0.5">Enjoy the {{ data.event.title }}.</p>
              </div>
            </div>
          </template>
        </div>
      </div>

      <p class="text-center text-xs text-gray-400 mt-4">Powered by Friendly Manager</p>
    </div>
  </div>
</template>
