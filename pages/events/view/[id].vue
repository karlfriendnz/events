<!--
  Simple "run the event" view — the landing page for a Quick event. Three things,
  one page: the basic details, who's invited, and take attendance. Attendance +
  invitee list are the SHARED <EventAttendance> component (same one the full event
  editor's Attendance tab uses). "Edit full event →" opens the main /events/:id editor.
-->
<script setup lang="ts">
definePageMeta({ layout: 'default' })

const route = useRoute()
const eventsApi = useEventsApi()
const id = computed(() => route.params.id as string)

const event = ref<any>(null)
const loading = ref(true)
const inviteOpen = ref(false)
const breadcrumbs = useBreadcrumbs()
const attendanceRef = ref()

async function load() {
  loading.value = true
  try {
    const ev = await eventsApi.get(id.value)
    event.value = ev
    breadcrumbs.value = [{ label: 'Events', to: '/events' }, { label: ev?.title || 'Event' }]
  } catch { event.value = null }
  finally { loading.value = false }
}
onMounted(load)
onUnmounted(() => { breadcrumbs.value = [] })

// After inviting more people, tell the attendance component to reload its roster.
function onInviteClose() { attendanceRef.value?.reload?.() }

const whenLabel = computed(() => {
  const ev = event.value
  if (!ev?.startAt) return 'No date set'
  const s = new Date(ev.startAt)
  const d = s.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  if (ev.isAllDay) return `${d} · All day`
  const tOpts: any = { hour: 'numeric', minute: '2-digit' }
  let out = `${d} · ${s.toLocaleTimeString(undefined, tOpts)}`
  if (ev.endAt) out += ` – ${new Date(ev.endAt).toLocaleTimeString(undefined, tOpts)}`
  return out
})
const locationLabel = computed(() => {
  const ev = event.value
  if (!ev) return ''
  if (ev.locationType === 'ONLINE') return ev.meetingLink ? 'Online' : ''
  return ev.address || ''
})
const statusLabel = computed(() => {
  const s = String(event.value?.status || '')
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : ''
})
const statusSeverity = computed(() =>
  event.value?.status === 'PUBLISHED' ? 'success' : event.value?.status === 'CANCELLED' ? 'danger' : 'secondary')
</script>

<template>
  <div class="p-3 sm:p-6 max-w-5xl mx-auto space-y-4">
    <div v-if="loading" class="card p-8 text-center text-sm text-gray-400">Loading…</div>

    <template v-else-if="event">
      <!-- Details -->
      <div class="card p-4 sm:p-5">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h1 class="text-lg sm:text-2xl font-semibold text-gray-900 break-words">{{ event.title }}</h1>
            <div class="mt-1.5 space-y-1 text-sm text-gray-600">
              <div class="flex items-center gap-2"><i class="pi pi-calendar text-gray-400 text-xs" />{{ whenLabel }}</div>
              <div v-if="locationLabel" class="flex items-center gap-2"><i class="pi pi-map-marker text-gray-400 text-xs" />{{ locationLabel }}</div>
            </div>
          </div>
          <Tag :value="statusLabel" :severity="statusSeverity" />
        </div>
        <div class="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
          <NuxtLink :to="`/events/${event.id}`" class="text-sm text-primary hover:underline">Edit full event →</NuxtLink>
          <Button label="Invite" icon="pi pi-user-plus" size="small" outlined @click="inviteOpen = true" />
        </div>
      </div>

      <!-- Attendance + invitee roster — the shared component -->
      <div class="card p-0 overflow-hidden h-[70vh] flex flex-col">
        <EventAttendance ref="attendanceRef" :event-id="id" />
      </div>
    </template>

    <div v-else class="card p-8 text-center text-sm text-gray-400">Event not found.</div>

    <!-- Invite more people (reuses the standard invitee manager; reloads attendance on close) -->
    <Dialog v-model:visible="inviteOpen" modal header="Invite people" :style="{ width: '95vw', maxWidth: '720px' }" @hide="onInviteClose">
      <EventInviteeManager v-if="event" :event-id="event.id" :show-invite="false" />
    </Dialog>
  </div>
</template>
