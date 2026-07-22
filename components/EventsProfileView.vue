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
    end_at: r.startAt,
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
  if (id) openEvent(id)
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
                class="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 cursor-pointer" @click="openEvent(r.eventId)">
                <td class="px-4 py-3 text-gray-700 whitespace-nowrap">{{ fmtDate(r.startAt) }}</td>
                <td class="px-2 py-3 text-gray-500 whitespace-nowrap">{{ fmtTime(r.startAt) }}</td>
                <td class="px-2 py-3 font-semibold text-gray-900">{{ r.title }}</td>
                <td class="px-2 py-3">
                  <span class="text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap" :class="PILLS[r.pill].cls">{{ PILLS[r.pill].label }}</span>
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
  </div>
</template>
