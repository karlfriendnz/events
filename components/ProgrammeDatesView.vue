<template>
  <div class="space-y-4">
    <!-- Count left, the two ways to add right — above the table, so they don't scroll
         sideways with it. NEW DATE = another day; NEW SESSION = a second slot on a day
         you already run (Morning then Afternoon). Same row, seeded differently, because
         the tedious part is retyping the times either way. -->
    <div v-if="!loading" class="flex flex-wrap items-center justify-between gap-3">
      <p v-if="sessions.length" class="text-xs sm:text-sm text-gray-500">
        {{ sessions.length }} date{{ sessions.length !== 1 ? 's' : '' }} ·
        <span class="font-medium text-gray-700">{{ totals.booked }}</span> booked{{ totals.capacity ? ` of ${totals.capacity}` : '' }}
      </p>
      <span v-else />
      <div class="flex items-center gap-2 shrink-0">
        <Button label="New session" icon="pi pi-plus" size="small" outlined :disabled="!sessions.length"
          @click="openAdd('session')" />
        <Button label="New date" icon="pi pi-calendar-plus" size="small"
          style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="openAdd('date')" />
      </div>
    </div>

    <div v-if="loading" class="bg-white rounded-xl border border-gray-200 py-16 text-center text-sm text-gray-400">Loading dates…</div>
    <div v-else-if="!sessions.length" class="bg-white rounded-xl border border-gray-200 py-16 text-center text-sm text-gray-400">
      This programme has no dates yet.
      <button type="button" class="text-primary hover:underline" @click="openAdd('date')">Add the first one</button>.
    </div>

    <!-- Dates list, grouped by week. The horizontal scrollbar belongs to the CARD, not
         to an inner box: with `overflow-hidden` on the card and the scroller inside it,
         the bar was drawn part-way up the card instead of along its bottom edge. -->
    <div v-else class="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      <div>
        <table class="w-full text-sm border-collapse min-w-[560px]">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <!-- Date and Session are SEPARATE columns. Sharing one cell meant the
                   title started at a different x on rows where the date was suppressed,
                   so "Morning" and "Afternoon" never lined up down the page. -->
              <th class="px-4 py-2.5 whitespace-nowrap">Date</th>
              <th class="px-4 py-2.5">Session</th>
              <th class="px-4 py-2.5 whitespace-nowrap">Starts</th>
              <th class="px-4 py-2.5 whitespace-nowrap">Ends</th>
              <th v-if="hasVenues" class="px-4 py-2.5 hidden md:table-cell">Location</th>
              <th class="px-4 py-2.5 whitespace-nowrap">Booked / Limit</th>
              <th class="px-4 py-2.5 w-[22%] hidden sm:table-cell"></th>
            </tr>
          </thead>

          <!-- Add a date IN the table, as a row at the TOP — not a modal or a slide-out.
               A new date is another line on this list, so it's edited in the shape it
               will take, with each control under the column it belongs to. At the top
               because a programme has twenty dates and the foot of the list is a scroll
               away from the button that opens it. -->
          <tbody>
            <tr v-if="addOpen" class="border-b border-gray-200 bg-primary/[0.03]">
              <td class="px-4 py-2">
                <DatePicker v-model="draft.date" :manual-input="false" show-icon date-format="dd/mm/yy"
                  placeholder="Date" class="w-[168px]" />
              </td>
              <td class="px-4 py-2">
                <InputText v-model="draft.title" placeholder="Session name" class="w-full min-w-[130px]" />
              </td>
              <td class="px-4 py-2"><TimeWheel v-model="draft.start" placeholder="Starts" class="w-[118px]" /></td>
              <td class="px-4 py-2"><TimeWheel v-model="draft.end" placeholder="Ends" class="w-[118px]" /></td>
              <td v-if="hasVenues" class="px-4 py-2 hidden md:table-cell text-gray-400 text-xs">Set it after adding</td>
              <td class="px-4 py-2">
                <InputNumber v-model="draft.capacity" :min="1" placeholder="No limit" class="w-20"
                  :input-class="'w-20'" :use-grouping="false" />
              </td>
              <td class="px-4 py-2 hidden sm:table-cell">
                <div class="flex items-center justify-end gap-1.5">
                  <Button label="Cancel" text size="small" severity="secondary" @click="addOpen = false" />
                  <Button label="Add" icon="pi pi-check" size="small" :disabled="!canAdd" :loading="saving"
                    style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="addDate" />
                </div>
              </td>
            </tr>
          </tbody>

          <template v-for="wk in weeks" :key="wk.key">
            <tbody>
              <!-- The whole row opens that session's roll. A date on this list is a
                   thing you're about to take attendance for, so the row IS the link. -->
              <tr v-for="row in wk.rows" :key="row.s.id" :class="rowClass(row)"
                class="border-b border-gray-100 cursor-pointer hover:bg-primary/5 transition-colors"
                :title="`Take attendance for ${row.s.title || 'this session'}`"
                @click="openAttendance(row.s)">
                <!-- Blank, not repeated, on the second session of a day: the day is
                     read once and the eye runs down the sessions beside it. -->
                <td class="px-4 py-3 whitespace-nowrap text-gray-500">{{ row.samePrevDay ? '' : dayLabel(row.s.start_at) }}</td>
                <td class="px-4 py-3 text-gray-800 hover:underline">{{ row.s.title || 'Session' }}</td>
                <td class="px-4 py-3 whitespace-nowrap text-gray-500 tabular-nums">{{ timeShort(row.s.start_at) }}</td>
                <td class="px-4 py-3 whitespace-nowrap text-gray-500 tabular-nums">{{ timeShort(row.s.end_at) || '—' }}</td>
                <td v-if="hasVenues" class="px-4 py-3 hidden md:table-cell text-gray-500">{{ venueLabel(row.s) || '—' }}</td>
                <td class="px-4 py-3 whitespace-nowrap tabular-nums" :class="cellClass(row)">
                  <span class="font-medium">{{ row.booked }}</span> / {{ row.cap === null ? '∞' : row.cap }}
                </td>
                <td class="px-4 py-3 hidden sm:table-cell">
                  <div class="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div class="h-full rounded-full" :class="barColor(row.booked, row.cap)" :style="{ width: barWidth(row) }" />
                  </div>
                </td>
              </tr>
              <!-- weekly total -->
              <tr class="bg-gray-50/70 border-b border-gray-200 text-gray-500 italic">
                <!-- Date + Session + Starts + Ends (+ Location) — keep in step with the header. -->
                <td class="px-4 py-2 text-right" :colspan="hasVenues ? 5 : 4">Week total</td>
                <td class="px-4 py-2 whitespace-nowrap tabular-nums">
                  <span class="font-medium text-gray-700">{{ wk.booked }}</span> / {{ wk.capacity || '∞' }}
                </td>
                <td class="px-4 py-2 hidden sm:table-cell" />
              </tr>
            </tbody>
          </template>

        </table>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
interface Row { s: any; booked: number; cap: number | null; samePrevDay: boolean; past: boolean; today: boolean }

const props = defineProps<{ eventId: string }>()
const events = useEventsApi()
const bookingsApi = useBookingsApi()   // venue names live on `bookables`, not the session
const { orgId } = useOrg()

const loading = ref(true)
const sessions = ref<any[]>([])
const bookedBySession = ref<Record<string, number>>({})
// How many people are invited to the event — the stand-in limit for any session that
// has no capacity of its own (see capFor).
const inviteeCount = ref(0)

/**
 * EVERY day key here is LOCAL, and that is the whole point.
 *
 * These keys used to be built with `toISOString().slice(0,10)` — i.e. UTC — while the
 * labels beside them were rendered with `toLocaleDateString`. In NZ (UTC+12) a 9:00 am
 * session is 21:00 the PREVIOUS day in UTC, so a morning and an afternoon session on
 * the same day got different keys, and a morning session shared a key with the previous
 * afternoon. That produced exactly two symptoms: the date printed twice on one day
 * (the two sessions never matched), and the morning row indented under the day before
 * (it matched the wrong one). One mismatch, two bugs.
 */
const localKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const dayKey = (iso: string | null) => iso ? localKey(new Date(iso)) : ''
const dayLabel = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : ''
const timeShort = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }) : ''
const todayKey = localKey(new Date())

function weekKey(iso: string) {
  const d = new Date(iso); d.setHours(0, 0, 0, 0)
  const day = (d.getDay() + 6) % 7   // Monday-first
  d.setDate(d.getDate() - day)
  // Local again: the Monday was computed in local time, so keying it in UTC would
  // shift the week boundary and split a week across two groups.
  return localKey(d)
}

/**
 * Open this session's own attendance page — details of the date at the top, the roll
 * underneath, nothing else. Not the advanced editor's attendance tab: taking a
 * register is a different job from configuring an event, and on the day you want the
 * ONE date you clicked, not the whole twenty-date programme to navigate again.
 */
function openAttendance(s: any) {
  navigateTo(`/events/attendance/${props.eventId}/${s.id}`)
}

// Venue names live on the `bookables` row: a session picked from the venue tree stores
// only `bookable_id` and leaves `address` null. Reading `address` alone showed nothing
// for those — and since `hasVenues` is derived from this, it hid the whole column.
const bookableNames = ref<Record<string, string>>({})
function venueLabel(s: any) {
  if (!s.location_type) return ''
  if (s.location_type === 'ONLINE') return 'Online'
  if (s.location_type === 'BOOKABLE') return s.bookable_id ? (bookableNames.value[s.bookable_id] || 'Venue') : ''
  return s.address || ''
}
const hasVenues = computed(() => sessions.value.some(s => venueLabel(s)))

function bookedFor(s: any) { return bookedBySession.value[s.id] ?? 0 }
/**
 * The limit a session is measured against.
 *
 * An explicit `capacity_max` wins. Without one this used to read ∞, which is true of
 * the room but useless on the day: what you actually want to know is "how many of the
 * people invited to this programme turned up", so the invitee count stands in. Still ∞
 * when nobody has been invited yet — a limit of 0 would read as "full".
 */
function capFor(s: any) { return s.capacity_max ?? (inviteeCount.value || null) }

const weeks = computed(() => {
  const ordered = [...sessions.value].sort((a, b) => (a.start_at || '').localeCompare(b.start_at || ''))
  const byWeek: Record<string, any[]> = {}
  for (const s of ordered) { const k = weekKey(s.start_at); (byWeek[k] ||= []).push(s) }
  return Object.keys(byWeek).sort().map(key => {
    let booked = 0, capacity = 0, anyCap = false, prevDay = ''
    const rows: Row[] = byWeek[key].map(s => {
      const b = bookedFor(s), cap = capFor(s), dk = dayKey(s.start_at)
      booked += b
      if (cap != null) { capacity += cap; anyCap = true }
      const row: Row = { s, booked: b, cap, samePrevDay: dk === prevDay, past: dk < todayKey, today: dk === todayKey }
      prevDay = dk
      return row
    })
    return { key, rows, booked, capacity: anyCap ? capacity : 0 }
  })
})

const totals = computed(() => {
  // capFor, not raw capacity_max — otherwise the header total ignores the invitee-count
  // fallback the rows use and the two disagree on the same screen.
  let capacity = 0, booked = 0, anyCap = false
  for (const s of sessions.value) {
    booked += bookedFor(s)
    const cap = capFor(s)
    if (cap != null) { capacity += cap; anyCap = true }
  }
  return { capacity: anyCap ? capacity : 0, booked }
})

function rowClass(r: Row) {
  if (r.today) return 'bg-green-50/60'
  if (r.past) return 'text-gray-400 bg-gray-50/40'
  return ''
}
function cellClass(r: Row) {
  if (r.cap === null) return 'text-gray-500'
  if (r.booked >= r.cap) return 'text-red-600'
  if (r.cap > 0 && (r.cap - r.booked) / r.cap <= 0.1) return 'text-amber-600'
  return 'text-gray-700'
}
function barColor(booked: number, cap: number | null) {
  if (cap === null || cap === 0) return 'bg-gray-300'
  const ratio = booked / cap
  if (ratio >= 1) return 'bg-red-500'
  if (ratio >= 0.9) return 'bg-amber-500'
  return 'bg-green-500'
}
function barWidth(r: Row) {
  if (!r.cap) return r.booked ? '100%' : '0%'
  return Math.min(100, (r.booked / r.cap) * 100) + '%'
}

// ── Add a date ──────────────────────────────────────────────────────────────
// A programme gains dates after it's created (an extra week, a catch-up day), and
// the only way to add one was the Sessions tab — a different screen from the one
// listing them. The times default to the LAST session's, since a new date on a
// programme is nearly always "same again, another day".
const addOpen = ref(false)
const saving = ref(false)
const draft = reactive({ title: '', date: null as Date | null, start: null as Date | null, end: null as Date | null, capacity: null as number | null })

/**
 * Open the add row, seeded for what you're adding.
 *
 *  'date'    — another DAY. Defaults to the day after the last one, repeating the last
 *              session's name and times: a programme is usually the same thing again.
 *  'session' — another SLOT on the last day already running. Keeps that date and starts
 *              where the previous session ended, since Morning is followed by Afternoon
 *              and the times are the tedious part.
 */
function openAdd(mode: 'date' | 'session' = 'date') {
  const last = [...sessions.value].sort((a, b) => (a.start_at || '').localeCompare(b.start_at || '')).pop()
  const base = last?.start_at ? new Date(last.start_at) : new Date()
  const day = new Date(base)
  if (mode === 'date') day.setDate(day.getDate() + 1)

  draft.date = day
  draft.capacity = last?.capacity_max ?? null

  if (mode === 'session' && last?.end_at) {
    // Start where the last one finished; a blank name so it isn't a second "Morning".
    const start = new Date(last.end_at)
    const end = new Date(start)
    const mins = last.start_at ? (new Date(last.end_at).getTime() - new Date(last.start_at).getTime()) / 60000 : 60
    end.setMinutes(end.getMinutes() + mins)
    draft.title = ''
    draft.start = start
    draft.end = end
  } else {
    draft.title = last?.title || 'Session'
    draft.start = last?.start_at ? new Date(last.start_at) : null
    draft.end = last?.end_at ? new Date(last.end_at) : null
  }
  addOpen.value = true
}

/** Combine the chosen day with a chosen time into one Date (times carry their own day). */
function withTime(day: Date, time: Date | null): string | null {
  if (!time) return null
  const d = new Date(day)
  d.setHours(time.getHours(), time.getMinutes(), 0, 0)
  return d.toISOString()
}

const canAdd = computed(() => !!draft.date && !!draft.title.trim())

async function addDate() {
  if (!canAdd.value || saving.value) return
  saving.value = true
  try {
    await events.createSession({
      eventId: props.eventId,
      title: draft.title.trim(),
      startAt: withTime(draft.date!, draft.start),
      endAt: withTime(draft.date!, draft.end),
      capacityMax: draft.capacity ?? null,
    } as any)
    addOpen.value = false
    await load()
  } finally {
    saving.value = false
  }
}

async function load() {
  loading.value = true
  // Seam returns camelCase; map back to the snake_case shape this template reads.
  const sess = await events.sessions(props.eventId)
  sessions.value = sess.map(s => ({
    ...s,
    start_at: s.startAt,
    end_at: s.endAt,
    capacity_max: s.capacityMax,
    location_type: s.locationType,
    meeting_link: s.meetingLink,
    bookable_id: s.bookableId,      // the venue a session points at (see venueLabel)
    is_master: s.isMaster,
    sort_order: s.sortOrder,
  }))
  // Names for any venue-based sessions. Skipped entirely when none use one.
  if (orgId.value && sessions.value.some((s: any) => s.location_type === 'BOOKABLE')) {
    const all = await bookingsApi.bookables(orgId.value).catch(() => [] as any[])
    bookableNames.value = Object.fromEntries((all as any[]).map(b => [b.id, b.name]))
  }
  inviteeCount.value = (await events.invitees(props.eventId).catch(() => [] as any[])).length
  const ids = sessions.value.map((s: any) => s.id)
  if (ids.length) {
    const rs = await events.registrationSessionsBySessions(ids)
    const m: Record<string, number> = {}
    for (const r of rs) if (r.status === 'CONFIRMED') m[r.sessionId] = (m[r.sessionId] ?? 0) + 1
    bookedBySession.value = m
  }
  loading.value = false
}
watch(() => props.eventId, load)
onMounted(load)
</script>
