<!--
  A club's view of an event SHARED to it by a governing body. The event itself is
  read-only (the club doesn't own it), but the club invites ITS OWN people and sees
  only its own invitees' statuses — scoped via <EventInviteeManager :club-org-id>.
-->
<script setup lang="ts">
const route = useRoute()
const { orgId } = useOrg()
const eventsApi = useEventsApi()

const id = route.params.id as string
const event = ref<any>(null)
const loading = ref(true)

async function load() {
  loading.value = true
  event.value = await eventsApi.get(id).catch(() => null)
  loading.value = false
}
onMounted(load)

useBreadcrumbs([{ label: 'Events', to: '/events' }, { label: () => event.value?.title || 'Shared event' } as any])

const whenLabel = computed(() => {
  const s = event.value?.startAt
  if (!s) return ''
  const d = new Date(s)
  const date = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return `${date} · ${time}`
})
</script>

<template>
  <div class="p-3 sm:p-6 space-y-4 sm:space-y-5">
    <div v-if="loading" class="py-20 flex justify-center"><i class="pi pi-spin pi-spinner text-2xl text-gray-300" /></div>
    <div v-else-if="!event" class="py-20 text-center text-sm text-gray-400">This shared event is no longer available.</div>
    <template v-else>
      <!-- Read-only event hero -->
      <div class="card p-0 overflow-hidden">
        <div class="relative h-40 sm:h-56 bg-gray-100">
          <img v-if="event.bannerUrl" :src="event.bannerUrl" class="absolute inset-0 w-full h-full object-cover" />
          <div v-else class="absolute inset-0" style="background:linear-gradient(100deg,var(--brand-primary),var(--brand-primary-hover))" />
          <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div class="absolute bottom-0 left-0 right-0 p-4 sm:p-5 text-white">
            <span class="inline-flex items-center gap-1 bg-white/20 backdrop-blur text-white text-xs font-semibold px-2 py-0.5 rounded-full mb-1.5">
              <i class="pi pi-share-alt text-[10px]" /> Shared with your club
            </span>
            <h1 class="text-lg sm:text-2xl font-bold leading-tight">{{ event.title }}</h1>
            <p v-if="whenLabel" class="text-sm text-white/90 mt-0.5">{{ whenLabel }}</p>
          </div>
        </div>
        <p v-if="event.description" class="px-4 sm:px-5 py-3 text-sm text-gray-600 whitespace-pre-line">{{ event.description }}</p>
      </div>

      <!-- The club invites its OWN people; only its invitees show (club-scoped). -->
      <div class="card p-4 sm:p-5">
        <div class="flex items-center gap-2 mb-3">
          <i class="pi pi-users text-primary" />
          <h2 class="text-sm font-semibold text-gray-800">Your invitees</h2>
          <span class="text-xs text-gray-400">— only your club's invitees show here</span>
        </div>
        <EventInviteeManager v-if="orgId" :event-id="id" :club-org-id="orgId" />
      </div>
    </template>
  </div>
</template>
