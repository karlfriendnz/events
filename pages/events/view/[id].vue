<!--
  Simple "run the event" view — the landing page for a Quick event. Three things,
  one page: the basic details, who's invited, and take attendance (mark present).
  For anything heavier (fees, forms, sessions) there's an "Edit full event →" link
  into the main /events/:id editor. Reads/writes only via the useEventsApi seam.
-->
<script setup lang="ts">
definePageMeta({ layout: 'default' })

const route = useRoute()
const eventsApi = useEventsApi()
const id = computed(() => route.params.id as string)

const event = ref<any>(null)
const invitees = ref<any[]>([])
const loading = ref(true)
const savingId = ref<string | null>(null)
const inviteOpen = ref(false)
const breadcrumbs = useBreadcrumbs()

async function load() {
  loading.value = true
  try {
    const [ev, inv] = await Promise.all([
      eventsApi.get(id.value),
      eventsApi.inviteesWithPerson(id.value),
    ])
    event.value = ev
    invitees.value = inv
    breadcrumbs.value = [{ label: 'Events', to: '/events' }, { label: ev?.title || 'Event' }]
  } catch { event.value = null }
  finally { loading.value = false }
}
onMounted(load)
onUnmounted(() => { breadcrumbs.value = [] })

const presentCount = computed(() => invitees.value.filter(i => i.attended).length)
const allPresent = computed(() => invitees.value.length > 0 && presentCount.value === invitees.value.length)

function personName(i: any) {
  const p = i.person
  const n = p ? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() : ''
  return n || 'Guest'
}
function initials(i: any) {
  const n = personName(i)
  return n.split(/\s+/).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase() || '?'
}
const PALETTE = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']
function avatarColor(i: any) {
  const key = String(i.person?.id || i.id || '')
  let h = 0
  for (let n = 0; n < key.length; n++) h = (h * 31 + key.charCodeAt(n)) >>> 0
  return PALETTE[h % PALETTE.length]
}
function rsvpLabel(i: any) {
  return i.status === 'CONFIRMED' ? 'Coming' : i.status === 'DECLINED' ? "Can't make it" : 'Invited'
}

async function toggleAttended(inv: any) {
  const prev = inv.attended
  inv.attended = !prev
  savingId.value = inv.id
  try { await eventsApi.updateInvitee(inv.id, { attended: inv.attended }) }
  catch { inv.attended = prev }
  finally { savingId.value = null }
}
async function markAll(val: boolean) {
  for (const inv of invitees.value) {
    if (!!inv.attended === val) continue
    inv.attended = val
    try { await eventsApi.updateInvitee(inv.id, { attended: val }) } catch { inv.attended = !val }
  }
}

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
  <div class="p-3 sm:p-6 max-w-3xl mx-auto space-y-4">
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
        <div class="mt-3 pt-3 border-t border-gray-100">
          <NuxtLink :to="`/events/${event.id}`" class="text-sm text-primary hover:underline">Edit full event →</NuxtLink>
        </div>
      </div>

      <!-- Attendance -->
      <div class="card p-4 sm:p-5">
        <div class="flex items-center justify-between gap-3 mb-3">
          <div>
            <h2 class="text-sm font-semibold text-gray-800">Attendance</h2>
            <p class="text-xs text-gray-500">{{ presentCount }} of {{ invitees.length }} present</p>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <Button v-if="invitees.length" :label="allPresent ? 'Clear' : 'All present'" size="small" text
              @click="markAll(!allPresent)" />
            <Button label="Invite" icon="pi pi-user-plus" size="small" outlined @click="inviteOpen = true" />
          </div>
        </div>

        <div v-if="!invitees.length" class="text-center py-8 text-sm text-gray-400">
          No one invited yet.
          <button class="text-primary hover:underline" @click="inviteOpen = true">Invite people</button>
        </div>

        <ul v-else class="divide-y divide-gray-100">
          <li v-for="inv in invitees" :key="inv.id" class="flex items-center gap-3 py-2.5">
            <span class="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
              :style="{ background: avatarColor(inv) }">{{ initials(inv) }}</span>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-gray-800 truncate">{{ personName(inv) }}</div>
              <div class="text-xs text-gray-400 truncate">{{ inv.person?.email || rsvpLabel(inv) }}</div>
            </div>
            <button type="button"
              class="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors min-w-[84px]"
              :class="inv.attended
                ? 'bg-emerald-500 border-emerald-500 text-white'
                : 'bg-white border-gray-200 text-gray-500 hover:border-emerald-400 hover:text-emerald-600'"
              :disabled="savingId === inv.id"
              @click="toggleAttended(inv)">
              <i class="pi text-[10px] mr-1" :class="inv.attended ? 'pi-check' : 'pi-circle'" />{{ inv.attended ? 'Present' : 'Mark' }}
            </button>
          </li>
        </ul>
      </div>
    </template>

    <div v-else class="card p-8 text-center text-sm text-gray-400">Event not found.</div>

    <!-- Invite more people (reuses the standard invitee manager; reloads on close) -->
    <Dialog v-model:visible="inviteOpen" modal header="Invite people" :style="{ width: '95vw', maxWidth: '720px' }" @hide="load">
      <EventInviteeManager v-if="event" :event-id="event.id" :show-invite="false" />
    </Dialog>
  </div>
</template>
