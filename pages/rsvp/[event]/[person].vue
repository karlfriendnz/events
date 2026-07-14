<!--
  RSVP — "are you coming, yes or no".

  The simplest thing an invited member can be asked. It is NOT a registration
  form: the answer IS the invitee's status (invitees.status CONFIRMED/DECLINED),
  which is why this page has no <FormRenderer> in it. A form is the opt-in layer
  the club adds when yes/no isn't enough — and when the event HAS one, saying yes
  hands the member straight over to it.

  Public by design (the link arrives by email, allow-listed in auth.global.ts +
  PUBLIC_PREFIXES): a member who has never logged in must still be able to reply.
  The (event, person) pair in the URL is the credential — /api/public-rsvp only
  answers for an invitee row that already exists.
-->
<script setup lang="ts">
import { locationSummary } from '~/composables/useLocation'

definePageMeta({ layout: 'embed' })

const route = useRoute()
const eventId = route.params.event as string
const personId = route.params.person as string

const loading = ref(true)
const saving = ref<'yes' | 'no' | null>(null)
const error = ref('')
const data = ref<any>(null)

// True once they've answered — the page then shows the outcome rather than the
// two buttons (with a "change my answer" way back, because people change plans).
const answered = ref(false)

const going = computed(() => data.value?.status === 'CONFIRMED')
const cancelled = computed(() => ['CANCELLED', 'ARCHIVED'].includes(data.value?.event?.status))

const firstName = computed(() => data.value?.person?.first_name || '')
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

async function load() {
  try {
    data.value = await $fetch('/api/public-rsvp', { method: 'POST', body: { eventId, personId } })
    // Already replied on a previous visit → open on the outcome, not the buttons.
    answered.value = !!data.value.responded
  } catch (e: any) {
    error.value = e?.data?.message || 'This invitation link is no longer valid.'
  } finally {
    loading.value = false
  }
}

async function respond(response: 'yes' | 'no') {
  saving.value = response
  try {
    data.value = await $fetch('/api/public-rsvp', { method: 'POST', body: { eventId, personId, response } })
    answered.value = true
  } catch (e: any) {
    error.value = e?.data?.message || 'Could not save your answer. Please try again.'
  } finally {
    saving.value = null
  }
}

onMounted(load)
</script>

<template>
  <div class="min-h-screen bg-[#F5F8FA] flex items-start sm:items-center justify-center p-3 sm:p-6">
    <div class="w-full max-w-lg">
      <div v-if="loading" class="card p-10 text-center text-sm text-gray-400">
        <i class="pi pi-spin pi-spinner text-xl text-gray-300 block mb-2" />
        Loading your invitation…
      </div>

      <div v-else-if="error" class="card p-8 text-center">
        <i class="pi pi-exclamation-circle text-2xl text-gray-300 block mb-3" />
        <p class="text-sm text-gray-600">{{ error }}</p>
      </div>

      <div v-else class="card overflow-hidden">
        <!-- The event, so they know what they're answering about -->
        <div class="px-5 sm:px-6 py-5 border-b border-gray-100">
          <p v-if="firstName" class="text-xs text-gray-400 mb-1">Hi {{ firstName }}, you're invited to</p>
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
          <!-- A cancelled event still renders (so the link isn't just dead), but
               there's nothing left to answer. -->
          <div v-if="cancelled" class="rounded-lg bg-amber-50 border border-amber-100 px-4 py-3">
            <p class="text-sm text-amber-800">This event has been cancelled — there's nothing to reply to.</p>
          </div>

          <!-- The whole page, in two buttons -->
          <template v-else-if="!answered">
            <p class="text-sm font-medium text-gray-800 mb-4">Are you coming?</p>
            <div class="flex flex-col sm:flex-row gap-3">
              <Button label="Yes, I'll be there" icon="pi pi-check" class="flex-1 justify-center"
                :loading="saving === 'yes'" :disabled="!!saving"
                style="background:#059669;border-color:#059669" @click="respond('yes')" />
              <Button label="No, I can't make it" icon="pi pi-times" severity="secondary" outlined
                class="flex-1 justify-center" :loading="saving === 'no'" :disabled="!!saving"
                @click="respond('no')" />
            </div>
          </template>

          <!-- Answered — say so plainly, and let them change their mind -->
          <template v-else>
            <div class="flex items-start gap-3 rounded-lg px-4 py-3"
              :class="going ? 'bg-emerald-50 border border-emerald-100' : 'bg-gray-50 border border-gray-200'">
              <i class="pi mt-0.5" :class="going ? 'pi-check-circle text-emerald-600' : 'pi-times-circle text-gray-400'" />
              <div>
                <p class="text-sm font-medium" :class="going ? 'text-emerald-900' : 'text-gray-700'">
                  {{ going ? "You're going." : "You've said you can't make it." }}
                </p>
                <p class="text-xs mt-0.5" :class="going ? 'text-emerald-700' : 'text-gray-500'">
                  {{ going ? "We've let the club know." : "Thanks for letting us know." }}
                </p>
              </div>
            </div>

            <!-- Yes + the event asks for more than yes → hand them to the form -->
            <NuxtLink v-if="going && data.event.form_id" :to="`/r/event/${eventId}`"
              class="mt-4 flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 hover:border-primary transition-colors">
              <div>
                <p class="text-sm font-medium text-gray-800">There are a few more questions</p>
                <p class="text-xs text-gray-500 mt-0.5">The club needs some details for this event.</p>
              </div>
              <i class="pi pi-arrow-right text-primary text-xs" />
            </NuxtLink>

            <button type="button" class="mt-4 text-xs text-gray-500 hover:text-primary hover:underline"
              @click="answered = false">
              Change my answer
            </button>
          </template>
        </div>
      </div>

      <p class="text-center text-xs text-gray-400 mt-4">Powered by Friendly Manager</p>
    </div>
  </div>
</template>
