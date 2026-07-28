<!--
  ONE SESSION'S ATTENDANCE — the register for a single date of a multi-date event.

  Modelled on the quick event's "run the event" view (/events/view/:id): the thing
  you're running at the top, the roll underneath, and nothing else. The difference is
  scope — that page is the whole event, this is ONE date of it, which is what you
  actually hold in your hand at the door of a holiday programme on a Wednesday.

  Both ids are in the URL because there is no GET route for a single session: the
  sessions list is fetched for the event and the one we want picked out of it. If a
  by-id session endpoint ever lands, this page can drop the event id.
-->
<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import type { LocationEntry } from '~/composables/useLocation'
definePageMeta({ layout: 'default' })

const route = useRoute()
const eventId = computed(() => route.params.id as string)
const sessionId = computed(() => route.params.sessionId as string)
const events = useEventsApi()
const bookingsApi = useBookingsApi()   // venue names live on `bookables`, not the session
const { orgId } = useOrg()
const breadcrumbs = useBreadcrumbs()
void useToast()   // the roll's child components toast; the service must exist here

const loading = ref(true)
const event = ref<any>(null)
const session = ref<any>(null)
const booked = ref(0)

const dayLabel = (iso: string | null) => iso
  ? new Date(iso).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  : ''
const timeShort = (iso: string | null) => iso
  ? new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
  : ''

const whenLabel = computed(() => {
  const s = session.value
  if (!s?.startAt) return 'No date set'
  const t = timeShort(s.startAt)
  const end = s.endAt ? timeShort(s.endAt) : ''
  return `${dayLabel(s.startAt)}${t ? ` · ${t}` : ''}${end ? ` – ${end}` : ''}`
})

// Venue names live on the `bookables` row, not on the session: a session picked from
// the venue tree stores only `bookableId` and leaves `address` null. Reading `address`
// alone therefore showed NOTHING for every venue-based session.
const bookableNames = ref<Record<string, string>>({})

const venueLabel = computed(() => {
  const s = session.value
  if (!s?.locationType) return ''
  if (s.locationType === 'ONLINE') return 'Online'
  if (s.locationType === 'BOOKABLE') return s.bookableId ? (bookableNames.value[s.bookableId] || 'Venue') : ''
  return s.address || ''
})

const capacityLabel = computed(() => {
  const cap = session.value?.capacityMax
  return cap == null ? `${booked.value} booked` : `${booked.value} of ${cap} booked`
})

// ── Edit this date ──────────────────────────────────────────────────────────
// A programme's dates move: a venue changes, a session shifts an hour. Until now that
// meant leaving the roll for the Sessions tab of the event editor, so it's here — on
// the screen that shows the date — and deliberately limited to when and where. Fees,
// capacity and invitees stay in the editor; this is the "we're in the other hall
// today" fix you make on the morning.
const editing = ref(false)
const savingEdit = ref(false)
const edit = reactive({
  title: '',
  date: null as Date | null,
  start: null as Date | null,
  end: null as Date | null,
  locations: [] as LocationEntry[],
})

function startEdit() {
  const s: any = session.value
  edit.title = s?.title || ''
  edit.date = s?.startAt ? new Date(s.startAt) : null
  edit.start = s?.startAt ? new Date(s.startAt) : null
  edit.end = s?.endAt ? new Date(s.endAt) : null
  edit.locations = s?.locationType
    ? [{
        type: s.locationType,
        venue_name: '',
        address: s.address || '',
        meeting_link: s.meetingLink || '',
        bookable_ids: s.bookableId ? [s.bookableId] : [],
      }]
    : []
  editing.value = true
}

/** The chosen day carrying a chosen time — the pickers hold their own, unrelated days. */
function combine(day: Date | null, time: Date | null): string | null {
  if (!day || !time) return null
  const d = new Date(day)
  d.setHours(time.getHours(), time.getMinutes(), 0, 0)
  return d.toISOString()
}

async function saveEdit() {
  if (!edit.date || savingEdit.value) return
  savingEdit.value = true
  try {
    const loc = edit.locations[0]
    await events.updateSession(sessionId.value, {
      title: edit.title.trim() || 'Session',
      startAt: combine(edit.date, edit.start),
      endAt: combine(edit.date, edit.end),
      // locationType is a REQUIRED column (not nullable in the contract), so clearing
      // the location falls back to ADDRESS with empty fields — the same shape the quick
      // event writes — rather than sending null and failing validation.
      locationType: loc?.type ?? 'ADDRESS',
      // The flat columns are what the roll, the dates list and the calendar read.
      address: loc?.type === 'ADDRESS' ? ([loc.venue_name, loc.address].filter(Boolean).join(', ') || null) : null,
      meetingLink: loc?.type === 'ONLINE' ? (loc.meeting_link || null) : null,
      bookableId: loc?.type === 'BOOKABLE' ? (loc.bookable_ids?.[0] ?? null) : null,
    } as any)
    editing.value = false
    await load()
  } finally {
    savingEdit.value = false
  }
}

// ── Delete this date ────────────────────────────────────────────────────────
// Behind a confirm, because it takes the roll with it: a session is where attendance
// and registrations hang, so removing one is not the same as unticking a box. The
// dialog says how many are booked so the decision is made with that in view.
const confirmDelete = ref(false)
const deleting = ref(false)

async function removeSession() {
  if (deleting.value) return
  deleting.value = true
  try {
    await events.removeSession(sessionId.value)
    // Back to the list it came from — this page's subject no longer exists.
    await navigateTo(`/events/${eventId.value}?tab=dates`)
  } finally {
    deleting.value = false
  }
}

async function load() {
  loading.value = true
  const [ev, list] = await Promise.all([
    events.get(eventId.value).catch(() => null),
    events.sessions(eventId.value).catch(() => [] as any[]),
  ])
  event.value = ev
  session.value = (list as any[]).find(s => s.id === sessionId.value) ?? null
  // Booked = CONFIRMED registrations on THIS session, the same count the dates list shows.
  const rs = await events.registrationSessionsBySessions([sessionId.value]).catch(() => [] as any[])
  booked.value = (rs as any[]).filter(r => r.status === 'CONFIRMED').length
  // Only when the session actually points at a venue — no need to pull the club's whole
  // bookable list for a session with a typed address.
  if ((session.value as any)?.locationType === 'BOOKABLE' && orgId.value) {
    const all = await bookingsApi.bookables(orgId.value).catch(() => [] as any[])
    bookableNames.value = Object.fromEntries((all as any[]).map(b => [b.id, b.name]))
  }
  loading.value = false
}

// Breadcrumb: Events › the programme (back to its dates) › this date.
watchEffect(() => {
  breadcrumbs.value = [
    { label: 'Events', to: '/events' },
    { label: event.value?.title || 'Event', to: `/events/${eventId.value}?tab=dates` },
    { label: session.value?.title || 'Attendance' },
  ]
})
onUnmounted(() => { breadcrumbs.value = [] })

onMounted(load)
watch([eventId, sessionId], load)
</script>

<template>
  <!-- 1200px to match /events/view/:id — the roll carries Age / Gender / Phone /
       sign-in columns and anything narrower crowds them. -->
  <div class="p-3 sm:p-6 max-w-[1200px] mx-auto">
    <div v-if="loading" class="bg-white rounded-xl border border-gray-200 py-16 text-center text-sm text-gray-400">
      Loading…
    </div>

    <div v-else-if="!session" class="bg-white rounded-xl border border-gray-200 py-16 text-center text-sm text-gray-400">
      That date is no longer part of this event.
      <NuxtLink :to="`/events/${eventId}?tab=dates`" class="text-primary hover:underline">Back to the dates</NuxtLink>.
    </div>

    <template v-else>
      <!-- Details: WHAT you're taking the register for. Session name leads, because
           on the day "Afternoon" is the thing you're running; the event name is
           context and sits above it. -->
      <div class="card p-4 sm:p-5 mb-4">
        <!-- Header: what this is + the actions, on ONE line. While editing, the name
             moves down into the labelled form, so the left side is just the event link
             and the buttons sit level with it instead of floating above an input. -->
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="min-w-0 flex-1">
            <!-- Says where it goes, not just where you are — the breadcrumb above
                 already names the event, so a bare title here read as a label. -->
            <NuxtLink :to="`/events/${eventId}?tab=dates`"
              class="inline-flex items-center gap-1 w-fit text-xs text-gray-500 hover:text-primary hover:underline">
              <i class="pi pi-chevron-left text-[10px]" />Back to {{ event?.title || 'event' }}
            </NuxtLink>
            <h1 v-if="!editing"
              class="text-lg sm:text-2xl font-semibold text-gray-900 mt-0.5 cursor-text hover:text-primary transition-colors"
              title="Click to edit" @click="startEdit">{{ session.title || 'Session' }}</h1>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <span class="text-sm font-medium text-gray-700">{{ capacityLabel }}</span>
            <template v-if="editing">
              <!-- Destructive action sits apart from Save/Cancel, and as an icon: it is
                   not the thing you came here to do. -->
              <Button icon="pi pi-trash" text size="small" severity="danger" v-tooltip.top="'Delete this date'"
                @click="confirmDelete = true" />
              <Button label="Cancel" text size="small" severity="secondary" @click="editing = false" />
              <Button label="Save" icon="pi pi-check" size="small" :disabled="!edit.date" :loading="savingEdit"
                style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="saveEdit" />
            </template>
            <Button v-else label="Edit" icon="pi pi-pencil" text size="small" @click="startEdit" />
          </div>
        </div>

        <!-- READ: when + where on one quiet line, both click-to-edit. -->
        <div v-if="!editing" class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-gray-600">
          <span class="flex items-center gap-1.5 cursor-text hover:text-primary transition-colors"
            title="Click to edit" @click="startEdit">
            <i class="pi pi-calendar text-gray-400 text-xs" />{{ whenLabel }}
          </span>
          <span class="flex items-center gap-1.5 cursor-text hover:text-primary transition-colors"
            title="Click to edit" @click="startEdit">
            <i class="pi pi-map-marker text-gray-400 text-xs" />{{ venueLabel || 'Add a location' }}
          </span>
        </div>

        <!-- EDIT: the same facts as controls, in place on the card — no dialog, since a
             modal would cover the thing you're editing to show you a copy of it. Named
             labels rather than bare icons: a calendar glyph beside a date is decoration,
             but "Location" is the only thing that tells you what the venue tabs are for.
             One label column so Name / Date / Location line up down the left. -->
        <div v-else class="mt-3 space-y-3">
          <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <label class="field-label w-full sm:w-20 shrink-0">Name</label>
            <InputText v-model="edit.title" placeholder="e.g. Morning" class="w-full sm:max-w-sm" />
          </div>
          <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <label class="field-label w-full sm:w-20 shrink-0">Date</label>
            <div class="flex flex-wrap items-center gap-2">
              <DatePicker v-model="edit.date" :manual-input="false" show-icon date-format="dd/mm/yy"
                placeholder="Date" class="w-[190px]" />
              <TimeWheel v-model="edit.start" placeholder="Starts" class="w-[130px]" />
              <span class="text-sm text-gray-300">→</span>
              <TimeWheel v-model="edit.end" placeholder="Ends" class="w-[130px]" />
            </div>
          </div>
          <div class="flex flex-col sm:flex-row gap-1 sm:gap-3">
            <label class="field-label w-full sm:w-20 shrink-0 sm:pt-2">Location</label>
            <div class="flex-1 min-w-0">
              <LocationEditor v-model="edit.locations" :multi="false" />
            </div>
          </div>
        </div>
      </div>

      <!-- The roll for THIS session. Same component the quick event uses, pointed at
           one session rather than the whole event. -->
      <EventAttendance :event-id="eventId" :session-id="sessionId" single-session />

      <Dialog v-model:visible="confirmDelete" modal header="Delete this date?" :style="{ width: '95vw', maxWidth: '440px' }">
        <p class="text-sm text-gray-700">
          <span class="font-medium">{{ session.title || 'This session' }}</span>
          <span v-if="session.startAt"> on {{ dayLabel(session.startAt) }}</span>
          will be removed from this programme.
        </p>
        <!-- Say what goes with it. A session is where attendance and registrations hang,
             so "nobody booked" and "12 booked" are very different decisions. -->
        <p class="text-sm mt-2" :class="booked ? 'text-amber-700' : 'text-gray-500'">
          <template v-if="booked">
            {{ booked }} {{ booked === 1 ? 'person is' : 'people are' }} booked on it — their place and
            anything recorded on the roll go too. This can't be undone.
          </template>
          <template v-else>Nobody is booked on it. This can't be undone.</template>
        </p>
        <template #footer>
          <Button label="Cancel" text severity="secondary" @click="confirmDelete = false" />
          <Button label="Delete date" icon="pi pi-trash" severity="danger" :loading="deleting" @click="removeSession" />
        </template>
      </Dialog>

    </template>

    <Toast />
  </div>
</template>
