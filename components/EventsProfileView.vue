<!--
  Events profile view — a member-facing "my events" screen: a searchable, status-
  tagged list of the person's events on the LEFT, a calendar of the same events on
  the RIGHT. Status comes from the person's invitee rows (useEventsApi.inviteesForPerson):
  CONFIRMED→Attending, attended→Attended, DECLINED→Not attending, else Pending.
  ("Interested" from the design has no backing data yet, so it isn't shown.)

  Person resolution: `personId` prop → `?person=` query → the logged-in user by email
  (mirrors useScopedRoles). Reuses <BookingsCalendar> read-only for the calendar.
-->
<script setup lang="ts">
const props = defineProps<{ personId?: string }>()

const { orgId } = useOrg()
const eventsApi = useEventsApi()
const { findByEmail } = usePeopleApi()
const user = useSupabaseUser()
const route = useRoute()

const loading = ref(true)
const personId = ref<string | null>(props.personId ?? (route.query.person as string) ?? null)
const rows = ref<any[]>([])
const search = ref('')
const tab = ref<'upcoming' | 'past'>('upcoming')

// ── Status → pill. Only states the invitee data actually supports. ──
type PillKey = 'attended' | 'attending' | 'declined' | 'pending'
const PILLS: Record<PillKey, { label: string; cls: string }> = {
  attended: { label: 'Attended', cls: 'bg-emerald-500 text-white' },
  attending: { label: 'Attending', cls: 'border border-emerald-500 text-emerald-600 bg-white' },
  declined: { label: 'Not attending', cls: 'bg-red-500 text-white' },
  pending: { label: 'Pending', cls: 'bg-gray-200 text-gray-500' },
}
function pillFor(inv: any): PillKey {
  if (inv.attended) return 'attended'
  const s = String(inv.status || '').toUpperCase()
  if (s === 'CONFIRMED') return 'attending'
  if (s === 'DECLINED') return 'declined'
  return 'pending'
}
// Calendar dot/bar colour per status.
const STATUS_COLOR: Record<PillKey, string> = {
  attended: '#10b981', attending: '#34d399', declined: '#ef4444', pending: '#94a3b8',
}

// ── Answering the invitation, from the list ────────────────────────────────
// A "Pending" row is a question nobody could answer here: the yes/no lived only on
// the emailed RSVP link, so a member looking straight at their own event had no way
// to accept it. Same endpoint the email link posts to (the (event, person) pair IS
// the credential), so both routes write one status and raise one invoice.
// Answered in a DIALOG rather than straight off the row: it commits the member to
// turning up and, on a charged event, raises a real invoice against them — too much
// to hang on one mis-click in a list. The dialog restates what they're answering.
const rsvpOpen = ref(false)
const rsvpRow = ref<any>(null)
// The event as the invitation describes it — banner, description, what it costs.
// The list row only carries a title and a date, and "are you going?" answered off
// those two is answered blind. Loaded from the SAME endpoint that records the
// answer (called with no `response`, which is its load mode).
const rsvpDetail = ref<any>(null)
const rsvpLoading = ref(false)
async function openRsvp(row: any) {
  rsvpRow.value = row
  rsvpError.value = null
  rsvpDetail.value = null
  rsvpOpen.value = true
  rsvpLoading.value = true
  try {
    const res: any = await $fetch('/api/public-rsvp', {
      method: 'POST',
      body: { eventId: row.eventId, personId: personId.value },
    })
    rsvpDetail.value = res?.event ?? null
  } catch {
    // Non-fatal: they can still answer off the title and date rather than being
    // blocked by a detail fetch.
    rsvpDetail.value = null
  } finally {
    rsvpLoading.value = false
  }
}
const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`

// A form on the event means yes/no isn't the whole story — accepting has to carry on
// into the registration rather than stopping at a status change.
const rsvpHasForm = computed(() => !!rsvpDetail.value?.form_id)

// Where it is. `locations` is a json array (migration 004) and an entry may carry an
// address, a venue name, or only a bookable — so fall back through them rather than
// showing an empty line.
const rsvpLocation = computed(() => {
  const d = rsvpDetail.value
  if (!d) return '—'
  if (d.address) return d.address
  const first = Array.isArray(d.locations) ? d.locations[0] : null
  return first?.venue_name || first?.address || (first ? 'Venue' : '—')
})

// Hero date badge — weekday / day / month, split so each can be styled. Local time,
// like every other date on this screen (the stored instant is UTC).
function datePart(iso: string | null, part: 'weekday' | 'day' | 'month') {
  if (!iso) return ''
  const d = new Date(iso)
  if (part === 'day') return String(d.getDate())
  return d.toLocaleDateString('en-NZ', { [part]: 'short' } as any).toUpperCase()
}

const answering = ref<string | null>(null)
async function respond(row: any, response: 'yes' | 'no') {
  if (answering.value) return
  answering.value = row.inviteeId
  try {
    const res: any = await $fetch('/api/public-rsvp', {
      method: 'POST',
      body: { eventId: row.eventId, personId: personId.value, response },
    })
    // Update in place rather than reloading: the calendar reads the same rows, so the
    // pill and the event's colour move together.
    const status = String(res?.status || '').toUpperCase()
    row.pill = status === 'CONFIRMED' ? 'attending' : status === 'DECLINED' ? 'declined' : 'pending'
    row.color = STATUS_COLOR[row.pill as PillKey]
    rsvpOpen.value = false

    // ACCEPTED an event that has a registration form: carry straight on to it,
    // already identified, so they don't say yes and then land on a blank form being
    // asked who they are. Declining never goes to the form — there is nothing to
    // register for.
    if (status === 'CONFIRMED' && rsvpHasForm.value) {
      const to = `/r/event/${row.eventId}?person=${encodeURIComponent(personId.value ?? '')}`
      // _top when embedded: the form is a full page, not something to open inside
      // the profile's frame.
      if (import.meta.client && window.parent !== window) window.open(to, '_top')
      else await navigateTo(to)
    }
  } catch (e: any) {
    // Surfaced, not swallowed — "nothing happened" is the worst possible answer to
    // a click on Accept.
    rsvpError.value = e?.data?.message || e?.message || 'Could not save your answer.'
  } finally {
    answering.value = null
  }
}
const rsvpError = ref<string | null>(null)

// ── Date / time formatting to match the design ("11th Jul 25", "5:20pm"). ──
function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
function fmtDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${ordinal(d.getDate())} ${d.toLocaleDateString('en-AU', { month: 'short' })} ${String(d.getFullYear()).slice(2)}`
}
function fmtTime(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s/g, '').toLowerCase()
}

async function load() {
  loading.value = true
  // Resolve the person if not given.
  if (!personId.value && user.value?.email && orgId.value) {
    const p = await findByEmail(orgId.value, user.value.email).catch(() => null)
    personId.value = p?.id ?? null
  }
  if (!personId.value) { rows.value = []; loading.value = false; return }
  const invs = await eventsApi.inviteesForPerson(personId.value).catch(() => [])
  rows.value = (invs ?? []).map((inv: any) => {
    const key = pillFor(inv)
    return {
      inviteeId: inv.id,
      eventId: inv.eventId,
      title: inv.eventTitle,
      startAt: inv.eventStartAt,
      endAt: inv.eventEndAt ?? null,
      pill: key,
      isPast: !!inv.eventStartAt && new Date(inv.eventStartAt) < new Date(),
      color: STATUS_COLOR[key],
    }
  })
  loading.value = false
}
watch([orgId, () => props.personId], load, { immediate: true })

// ── List: search + upcoming/past ──
const listRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  return rows.value
    .filter(r => (tab.value === 'past' ? r.isPast : !r.isPast))
    .filter(r => !q || (r.title || '').toLowerCase().includes(q))
    .sort((a, b) => {
      const ta = a.startAt ? new Date(a.startAt).getTime() : 0
      const tb = b.startAt ? new Date(b.startAt).getTime() : 0
      return tab.value === 'past' ? tb - ta : ta - tb
    })
})

function openEvent(eventId: string) { navigateTo(`/events/${eventId}`) }

// ── Calendar (reuses <BookingsCalendar>) ──
const calDate = ref(new Date())
type CalView = 'year' | 'month' | 'week' | 'day'
const calViewChoice = ref<CalView>('month')
// BookingsCalendar has no "year" view — fall back to month (noted).
const bookingsCalView = computed(() => (calViewChoice.value === 'year' ? 'month' : calViewChoice.value))

const calEvents = computed(() =>
  rows.value.filter(r => r.startAt).map(r => ({
    id: r.eventId,
    start_at: r.startAt,
    // The event's REAL end. This used to be r.startAt, which gave every event zero
    // duration — the week and day grids size a block from end − start, so each one
    // collapsed to a hairline on its start line instead of spanning its hour.
    // An event with no end recorded falls back to an hour so it still reads as a block.
    end_at: r.endAt ?? new Date(new Date(r.startAt).getTime() + 60 * 60 * 1000).toISOString(),
    is_all_day: false,
    status: 'CONFIRMED',
    notes: r.title,
    color: r.color,
    event: { id: r.eventId, title: r.title },
    contact_name: null,
    activity_mode: null,
    is_shared: false,
    shared_from: null,
    extendedProps: { id: r.eventId },
  })),
)
function onCalendarEventClick(b: any) {
  const id = b?.event?.id || b?.id
  if (!id) return
  // The same dialog the list opens. This used to navigate to /events/:id — the
  // ADMIN event page, which is not where a member looking at their own calendar
  // should land. Their question about their own event is "am I going?".
  const row = rows.value.find((r: any) => r.eventId === id)
  if (row) openRsvp(row)
  else openEvent(id)
}
function calPrev() {
  const d = new Date(calDate.value)
  if (bookingsCalView.value === 'day') d.setDate(d.getDate() - 1)
  else if (bookingsCalView.value === 'week') d.setDate(d.getDate() - 7)
  else d.setMonth(d.getMonth() - 1)
  calDate.value = d
}
function calNext() {
  const d = new Date(calDate.value)
  if (bookingsCalView.value === 'day') d.setDate(d.getDate() + 1)
  else if (bookingsCalView.value === 'week') d.setDate(d.getDate() + 7)
  else d.setMonth(d.getMonth() + 1)
  calDate.value = d
}
function calToday() { calDate.value = new Date() }
const calLabel = computed(() => calDate.value.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' }))

const VIEWS: { key: CalView; label: string }[] = [
  { key: 'year', label: 'Year' }, { key: 'month', label: 'Month' },
  { key: 'week', label: 'Week' }, { key: 'day', label: 'Day' },
]
</script>

<template>
  <div class="p-3 sm:p-6">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">

      <!-- ── LEFT: searchable, status-tagged list ── -->
      <div class="space-y-3">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold text-gray-800 shrink-0">Search</span>
          <span class="relative flex-1 min-w-0">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
            <InputText v-model="search" placeholder="Search subject, or content of the email" class="w-full !pl-8" size="small" />
          </span>
          <Button label="Advanced Search" size="small" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
        </div>

        <div class="flex items-center gap-2">
          <div class="inline-flex rounded-lg overflow-hidden border border-gray-200">
            <button type="button" class="px-4 py-1.5 text-sm font-medium transition-colors"
              :class="tab === 'upcoming' ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'"
              @click="tab = 'upcoming'">Upcoming</button>
            <button type="button" class="px-4 py-1.5 text-sm font-medium transition-colors"
              :class="tab === 'past' ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'"
              @click="tab = 'past'">Past Events</button>
          </div>
          <Button label="More" size="small" outlined class="ml-auto" />
        </div>

        <div class="card p-0 overflow-hidden">
          <div v-if="loading" class="py-12 text-center text-sm text-gray-400">Loading…</div>
          <div v-else-if="!listRows.length" class="py-12 text-center text-sm text-gray-400">
            <i class="pi pi-calendar text-2xl text-gray-300 mb-2 block" />
            No {{ tab === 'past' ? 'past' : 'upcoming' }} events.
          </div>
          <table v-else class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-100 text-left text-xs font-semibold text-gray-500">
                <th class="px-4 py-2.5">Date</th>
                <th class="px-2 py-2.5">Time</th>
                <th class="px-2 py-2.5">Name</th>
                <th class="px-2 py-2.5">Status</th>
                <th class="px-2 py-2.5 w-8"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in listRows" :key="r.inviteeId"
                class="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 cursor-pointer" @click="openRsvp(r)">
                <td class="px-4 py-3 text-gray-700 whitespace-nowrap">{{ fmtDate(r.startAt) }}</td>
                <td class="px-2 py-3 text-gray-500 whitespace-nowrap">{{ fmtTime(r.startAt) }}</td>
                <td class="px-2 py-3 font-semibold text-gray-900">{{ r.title }}</td>
                <td class="px-2 py-3">
                  <!-- Pending is a question, so it gets answered here. @click.stop —
                       the row itself opens the event, and answering is not opening. -->
                  <button v-if="r.pill === 'pending' && !r.isPast" type="button"
                    class="text-xs font-semibold px-3 py-1 rounded-full border border-emerald-500 text-emerald-600 bg-white hover:bg-emerald-50 transition-colors"
                    @click.stop="openRsvp(r)">
                    Respond
                  </button>
                  <span v-else class="text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap" :class="PILLS[r.pill].cls">{{ PILLS[r.pill].label }}</span>
                </td>
                <td class="px-2 py-3 text-gray-300"><i class="pi pi-chevron-right text-xs" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ── RIGHT: calendar of the same events ── -->
      <div class="card p-3 sm:p-4 flex flex-col min-h-[520px]">
        <div class="flex flex-wrap items-center gap-2 mb-3">
          <div class="flex items-center gap-1">
            <button type="button" class="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center justify-center" @click="calPrev"><i class="pi pi-chevron-left text-xs" /></button>
            <button type="button" class="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center justify-center" @click="calNext"><i class="pi pi-chevron-right text-xs" /></button>
          </div>
          <Button label="Today" size="small" outlined @click="calToday" />
          <span class="text-lg font-semibold text-gray-800 ml-1">{{ calLabel }}</span>
          <div class="inline-flex rounded-lg overflow-hidden border border-gray-200 ml-auto">
            <button v-for="v in VIEWS" :key="v.key" type="button" class="px-3 py-1.5 text-xs font-medium transition-colors"
              :class="calViewChoice === v.key ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'"
              @click="calViewChoice = v.key">{{ v.label }}</button>
          </div>
        </div>
        <div class="flex-1 min-h-0 border border-gray-100 rounded-lg overflow-hidden">
          <BookingsCalendar :cal-date="calDate" :cal-view="bookingsCalView" :custom-events="calEvents"
            @booking-click="onCalendarEventClick" />
        </div>
      </div>

    </div>

    <!-- Answering an invitation. Restates WHAT is being answered, because from a list
         "Accept" alone is just a word next to a date. -->
    <Dialog v-model:visible="rsvpOpen" modal :draggable="false" :show-header="false"
      :style="{ width: '95vw', maxWidth: '800px' }"
      :pt="{ content: { class: '!p-0 !rounded-xl overflow-hidden' } }">
      <div v-if="rsvpRow">

        <!-- HERO — banner with the title sitting on it. Replaces the dialog's own
             header bar (show-header=false), so the image runs edge to edge. -->
        <div class="relative h-48 lg:h-[280px] bg-gradient-to-br from-[#1E2157] to-[#2494D2]">
          <img v-if="rsvpDetail?.banner_url" :src="rsvpDetail.banner_url" alt=""
            class="absolute inset-0 w-full h-full object-cover" />
          <!-- Scrim: the title sits ON the image, so it needs its own contrast rather
               than depending on whatever the club uploaded. -->
          <div class="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 to-transparent" />

          <button type="button" aria-label="Close"
            class="absolute top-3 right-3 w-8 h-8 rounded-lg bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors"
            @click="rsvpOpen = false">
            <i class="pi pi-times text-sm" />
          </button>

          <h3 class="absolute left-8 bottom-6 pr-8 text-3xl font-bold text-white drop-shadow">
            {{ rsvpRow.title }}
          </h3>
        </div>

        <div class="p-8 space-y-6">

          <!-- WHEN / COST / LOCATION, across the top. The three things anyone needs
               before they can answer "are you going?". -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <p class="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <i class="pi pi-calendar text-gray-400 text-xs" />When:
              </p>
              <p class="text-sm text-gray-600 mt-1">
                {{ fmtDate(rsvpRow.startAt) }} · {{ fmtTime(rsvpRow.startAt) }}
              </p>
            </div>
            <div>
              <p class="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <i class="pi pi-dollar text-gray-400 text-xs" />Cost:
              </p>
              <!-- The price is stated BEFORE the button: accepting a charged event
                   raises a real invoice against them. -->
              <p class="text-sm text-gray-600 mt-1">
                {{ rsvpDetail?.fee_total ? money(rsvpDetail.fee_total) : 'Free' }}
              </p>
            </div>
            <div>
              <p class="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <i class="pi pi-map-marker text-gray-400 text-xs" />Location:
              </p>
              <p class="text-sm text-gray-600 mt-1">{{ rsvpLocation }}</p>
            </div>
          </div>

          <div v-if="rsvpLoading" class="text-sm text-gray-400">Loading details…</div>

          <!-- Staff-authored rich text. `.fm-rich` (assets/css/main.css) restores the
               list/heading styling Tailwind's preflight strips. -->
          <div v-if="rsvpDetail?.description" class="fm-rich text-sm text-gray-700 leading-relaxed"
            v-html="rsvpDetail.description" />

          <div class="pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-2.5">
              <span class="text-sm font-semibold text-gray-800">You are:</span>
              <span class="text-sm font-semibold px-3.5 py-1.5 rounded-lg" :class="PILLS[rsvpRow.pill].cls">
                {{ PILLS[rsvpRow.pill].label }}
              </span>
            </div>
            <p v-if="rsvpRow.isPast" class="text-sm text-gray-500">This event has already been.</p>
            <p v-else class="text-sm text-gray-600">
              <template v-if="rsvpHasForm">
                {{ rsvpRow.pill === 'pending' ? 'Accept to complete your registration.' : 'Changed your mind?' }}
              </template>
              <template v-else>
                {{ rsvpRow.pill === 'pending' ? 'Are you going?' : 'Changed your mind?' }}
              </template>
            </p>
          </div>

          <p v-if="rsvpError" class="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {{ rsvpError }}
          </p>
        </div>
      </div>
      <!-- Big buttons: this is the decision the whole dialog exists for, so the
           actions are full-size and the accept carries the weight. -->
      <template #footer>
        <div class="flex flex-wrap items-center gap-3 w-full">
          <Button label="Close" severity="secondary" text
            class="!text-base !px-5 !py-3"
            :disabled="!!answering" @click="rsvpOpen = false" />
          <div class="flex-1" />
          <template v-if="!rsvpRow?.isPast">
            <Button v-if="rsvpRow?.pill !== 'declined'" label="Can't make it" severity="secondary" outlined
              class="!text-base !px-6 !py-3 !font-semibold"
              :loading="answering === rsvpRow?.inviteeId" @click="respond(rsvpRow, 'no')" />
            <Button v-if="rsvpRow?.pill !== 'attending'"
              :label="rsvpHasForm ? 'Accept & register' : 'Accept'"
              :icon="rsvpHasForm ? 'pi pi-arrow-right' : 'pi pi-check'"
              :icon-pos="rsvpHasForm ? 'right' : 'left'"
              class="!text-base !px-7 !py-3 !font-semibold"
              style="background:#10b981;border-color:#10b981"
              :loading="answering === rsvpRow?.inviteeId" @click="respond(rsvpRow, 'yes')" />
          </template>
        </div>
      </template>
    </Dialog>
  </div>
</template>
