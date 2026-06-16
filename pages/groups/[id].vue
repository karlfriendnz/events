<template>
  <div class="w-full px-4 py-4">
    <NuxtLink to="/groups"
      class="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-700 mb-4">
      <i class="pi pi-arrow-left text-[10px]" /> Groups
    </NuxtLink>

    <div v-if="loading" class="text-sm text-gray-400 py-8 text-center">Loading…</div>
    <div v-else-if="!group" class="text-sm text-gray-400 py-8 text-center">Group not found.</div>
    <template v-else>
      <div class="mb-5 flex items-center gap-3">
        <span class="w-3 h-3 rounded-full shrink-0" :style="{ background: group.color || '#94a3b8' }" />
        <h1 class="text-xl font-semibold text-surface-900">{{ group.name }}</h1>
        <div class="ml-auto flex items-center gap-2">
          <span v-if="trainingEventCount" class="text-xs text-gray-500">
            <i class="pi pi-calendar text-[10px] mr-1" />{{ trainingEventCount }} training event{{ trainingEventCount === 1 ? '' : 's' }} linked
          </span>
          <span v-if="createBlockedReason && missingTrainingEvents.length" class="text-xs text-gray-400">{{ createBlockedReason }}</span>
          <button v-if="missingTrainingEvents.length" type="button"
            class="text-xs font-semibold text-white px-3 py-1.5 rounded inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            :class="!createBlockedReason ? 'bg-[#1976d2] hover:bg-[#125ea8]' : 'bg-gray-400'"
            :disabled="creatingEvent || !!createBlockedReason"
            @click="createAttendanceEvent">
            <i class="pi pi-plus text-[10px]" />
            {{ creatingEvent ? 'Creating…' : createButtonLabel }}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <!-- Left column: INFO + COACHES -->
        <div class="md:col-span-1 flex flex-col gap-4">
          <!-- Disciplines (NSO mapping) -->
          <div v-if="group?.id" class="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div class="bg-[#1976d2] text-white text-xs font-bold tracking-widest text-center py-2">DISCIPLINES</div>
            <div class="p-4">
              <DisciplineLinker entity-type="group" :entity-id="group.id" />
            </div>
          </div>
          <!-- INFO -->
          <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div class="bg-[#1976d2] text-white text-xs font-bold tracking-widest text-center py-2">INFO</div>
            <div class="p-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <!-- Left half: labelled fields -->
              <div>
                <dl class="text-sm">
                  <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
                    <dt class="text-right font-semibold text-gray-700">Code:</dt>
                    <dd class="text-gray-700">{{ group.code || group.name }}</dd>
                    <dt class="text-right font-semibold text-gray-700">Head:</dt>
                    <dd class="text-gray-700">{{ headCoach || '—' }}</dd>
                    <dt class="text-right font-semibold text-gray-700">Age Range:</dt>
                    <dd class="text-gray-700">{{ group.age_range || '—' }}</dd>
                    <dt class="text-right font-semibold text-gray-700">Members:</dt>
                    <dd class="text-gray-700">{{ members.length }}<span v-if="group.capacity">/{{ group.capacity }}</span></dd>
                    <dt class="text-right font-semibold text-gray-700">Current Term:</dt>
                    <dd class="text-gray-700">{{ group.current_term || '—' }}</dd>
                    <dt class="text-right font-semibold text-gray-700">Term Fee:</dt>
                    <dd class="text-gray-700">{{ group.term_fee != null ? `$${Number(group.term_fee).toFixed(2)}` : '—' }}</dd>
                  </div>
                </dl>
              </div>
              <!-- Right half: Session Times -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <p class="font-bold text-gray-800">Session Times</p>
                  <button type="button"
                    class="text-xs font-semibold text-[#1976d2] hover:underline inline-flex items-center gap-1"
                    @click="openScheduleEditor">
                    <i class="pi pi-pencil text-[10px]" /> Edit
                  </button>
                </div>
                <div v-if="!schedules.length" class="text-sm text-gray-400">—</div>
                <div v-for="s in schedules" :key="s.id" class="text-sm text-gray-700 flex items-center gap-2">
                  <span class="flex-1 min-w-0">{{ formatSchedule(s) }}</span>
                  <NuxtLink v-if="trainingEventByScheduleId[s.id]"
                    :to="`/events/${trainingEventByScheduleId[s.id].id}`"
                    class="text-[11px] font-semibold text-[#1976d2] hover:underline shrink-0 inline-flex items-center gap-0.5"
                    :title="`Open ${trainingEventByScheduleId[s.id].title}`">
                    Open <i class="pi pi-arrow-right text-[9px]" />
                  </NuxtLink>
                </div>
              </div>
            </div>
          </div>

          <!-- COACHES -->
          <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div class="bg-[#1976d2] text-white text-xs font-bold tracking-widest text-center py-2 relative">
              COACHES
              <i class="pi pi-envelope text-white/90 absolute right-3 top-1/2 -translate-y-1/2 text-sm" />
            </div>
            <div class="p-4">
              <div v-if="!coaches.length" class="text-sm text-gray-400 py-6 text-center">No coaches assigned.</div>
              <div v-else class="grid grid-cols-2 gap-3">
                <div v-for="(c, i) in coaches" :key="c.id"
                  class="rounded-md border border-gray-200 px-3 py-2.5"
                  :class="i === 0 ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'">
                  <p class="text-sm font-bold text-gray-900 truncate">{{ c.name }}</p>
                  <p class="text-xs text-gray-500 italic truncate">{{ c.role }}</p>
                  <p v-if="c.phone" class="text-xs text-[#1976d2] mt-1.5 inline-flex items-center gap-1">
                    <i class="pi pi-phone text-[10px]" /> {{ c.phone }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right column: MEMBERS -->
        <div class="md:col-span-2">
          <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div class="bg-[#1976d2] text-white text-xs font-bold tracking-widest text-center py-2 relative">
              MEMBERS
              <i class="pi pi-envelope text-white/90 absolute right-3 top-1/2 -translate-y-1/2 text-sm" />
            </div>
            <div v-if="!members.length" class="p-8 text-center text-sm text-gray-400">
              No members in this group yet.
            </div>
            <table v-else class="w-full text-sm">
              <thead>
                <tr class="text-left text-xs font-bold text-gray-700 border-b border-gray-200">
                  <th class="px-4 py-2.5">Name</th>
                  <th class="px-4 py-2.5">Phone</th>
                  <th class="px-4 py-2.5">Email</th>
                  <th class="px-4 py-2.5 w-8" />
                </tr>
              </thead>
              <tbody>
                <tr v-for="m in members" :key="m.id" class="border-b border-gray-100 hover:bg-gray-50">
                  <td class="px-4 py-2.5">
                    <a href="#" class="text-[#1976d2] hover:underline" @click.prevent>{{ m.name }}</a>
                  </td>
                  <td class="px-4 py-2.5 text-gray-700">{{ m.phone || '' }}</td>
                  <td class="px-4 py-2.5 text-gray-700">{{ m.email || '' }}</td>
                  <td class="px-4 py-2.5 text-right">
                    <button type="button"
                      class="text-red-500 hover:text-red-700"
                      :title="`Remove ${m.name} from ${group.name}`"
                      @click="removeMember(m)">
                      <i class="pi pi-times-circle text-base" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>

    <Dialog v-model:visible="editorOpen" modal :style="{ width: '720px' }" header="Edit session times">
      <div v-if="!draftSchedules.length" class="text-sm text-gray-400 py-2">
        No sessions yet — add the days and times this group trains.
      </div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="text-left text-xs font-bold text-gray-700 border-b border-gray-200">
            <th class="py-2 pr-3">Day</th>
            <th class="py-2 pr-3">Start</th>
            <th class="py-2 pr-3">End</th>
            <th class="py-2 pr-3">Location</th>
            <th class="py-2 w-8" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in draftSchedules" :key="i" class="border-b border-gray-100">
            <td class="py-2 pr-3">
              <select v-model.number="row.day_of_week"
                class="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white w-full"
                style="-webkit-appearance:auto;appearance:auto;">
                <option v-for="(d, idx) in dayNames" :key="idx" :value="idx">{{ d }}</option>
              </select>
            </td>
            <td class="py-2 pr-3">
              <input v-model="row.start_time" type="time"
                class="border border-gray-300 rounded px-2 py-1.5 text-sm w-full" />
            </td>
            <td class="py-2 pr-3">
              <input v-model="row.end_time" type="time"
                class="border border-gray-300 rounded px-2 py-1.5 text-sm w-full" />
            </td>
            <td class="py-2 pr-3">
              <button type="button"
                class="w-full text-left border border-gray-300 rounded px-2 py-1.5 text-sm bg-white hover:bg-gray-50 inline-flex items-center justify-between gap-2"
                @click="openLocationPicker(i)">
                <span :class="locationLabel(row.location) ? 'text-gray-800 truncate' : 'text-gray-400'">
                  {{ locationLabel(row.location) || 'Choose location…' }}
                </span>
                <i class="pi pi-pencil text-[10px] text-gray-400 shrink-0" />
              </button>
            </td>
            <td class="py-2 text-right">
              <button type="button"
                class="text-red-500 hover:text-red-700"
                :title="'Remove session'"
                @click="draftSchedules.splice(i, 1)">
                <i class="pi pi-times-circle text-base" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <button type="button"
        class="mt-4 text-xs font-semibold text-[#1976d2] hover:underline inline-flex items-center gap-1"
        @click="addDraftSchedule">
        <i class="pi pi-plus text-[10px]" /> Add session
      </button>

      <template #footer>
        <button type="button"
          class="px-3 py-1.5 text-sm font-semibold text-gray-700 hover:text-gray-900"
          :disabled="savingSchedules"
          @click="editorOpen = false">Cancel</button>
        <button type="button"
          class="px-3 py-1.5 text-sm font-semibold text-white rounded"
          style="background:#1976d2"
          :disabled="savingSchedules"
          @click="saveSchedules">{{ savingSchedules ? 'Saving…' : 'Save' }}</button>
      </template>
    </Dialog>

    <Dialog v-model:visible="locationPickerOpen" modal :style="{ width: '640px' }" header="Choose location">
      <LocationEditor v-if="locationDraft" :model-value="[locationDraft]" :multi="false"
        @update:model-value="locs => locationDraft = locs[0]" />
      <template #footer>
        <button type="button"
          class="px-3 py-1.5 text-sm font-semibold text-gray-700 hover:text-gray-900"
          @click="locationPickerOpen = false">Cancel</button>
        <button type="button"
          class="px-3 py-1.5 text-sm font-semibold text-white rounded"
          style="background:#1976d2"
          @click="applyLocationPicker">Done</button>
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const db = useDb()
const { orgId } = useOrg()

interface Group {
  id: string
  name: string
  color: string | null
  code?: string | null
  age_range?: string | null
  current_term?: string | null
  term_fee?: number | null
  capacity?: number | null
}
interface Member { id: string; name: string; email: string | null; phone: string | null }
interface Coach { id: string; name: string; role: string; phone: string | null }
import type { LocationEntry } from '~/composables/useLocation'
interface Schedule {
  id: string
  day_of_week: number
  start_time: string
  end_time: string
  location: LocationEntry
  sort_order: number
}

const group = ref<Group | null>(null)
const members = ref<Member[]>([])
const coaches = ref<Coach[]>([])
const schedules = ref<Schedule[]>([])
const bookableNameById = ref<Record<string, string>>({})
const trainingEventByScheduleId = ref<Record<string, { id: string; title: string }>>({})
const seasonStart = ref<string | null>(null)
const seasonEnd = ref<string | null>(null)
const loading = ref(true)
const creatingEvent = ref(false)

const missingTrainingEvents = computed(() =>
  schedules.value.filter(s => !trainingEventByScheduleId.value[s.id])
)
const trainingEventCount = computed(() => Object.keys(trainingEventByScheduleId.value).length)

const createBlockedReason = computed(() => {
  if (!schedules.value.length) return 'Add session times first'
  if (!seasonStart.value || !seasonEnd.value) return 'Set the season in Settings → General'
  if (!missingTrainingEvents.value.length) return 'All training events created'
  return ''
})

const createButtonLabel = computed(() => {
  const total = schedules.value.length
  const missing = missingTrainingEvents.value.length
  if (!total) return 'Create training events'
  if (missing === total) return `Create ${total} training event${total === 1 ? '' : 's'}`
  return `Create ${missing} missing training event${missing === 1 ? '' : 's'}`
})

const editorOpen = ref(false)
const draftSchedules = ref<Schedule[]>([])
const savingSchedules = ref(false)

const locationPickerOpen = ref(false)
const locationPickerIndex = ref<number | null>(null)
const locationDraft = ref<LocationEntry | null>(null)

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const dayShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const headCoach = computed(() => coaches.value[0]?.name ?? '')

async function load() {
  if (!orgId.value) return
  const id = route.params.id as string
  loading.value = true

  // Group
  const { data: g } = await (db.from as any)('member_groups')
    .select('id, name, color')
    .eq('id', id)
    .eq('org_id', orgId.value)
    .maybeSingle()
  group.value = g ?? null

  if (!g) { members.value = []; loading.value = false; return }

  // Members
  const { data: rows } = await (db.from as any)('member_group_memberships')
    .select('person:persons!inner(id, first_name, last_name, email, phone)')
    .eq('group_id', id)
  members.value = (rows ?? [])
    .map((r: any) => r.person)
    .filter(Boolean)
    .map((p: any) => ({
      id: p.id,
      name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || '—',
      email: p.email ?? null,
      phone: p.phone ?? null,
    }))
    .sort((a: Member, b: Member) => a.name.localeCompare(b.name))

  // Coaches — no schema yet, show empty for prototype
  coaches.value = []

  // Training events for this group (one event per schedule row).
  await loadTrainingEvents()

  // Weekly training schedules for this group.
  const { data: scheds } = await (db.from as any)('member_group_schedules')
    .select('id, day_of_week, start_time, end_time, location, sort_order')
    .eq('group_id', id)
    .order('day_of_week')
    .order('start_time')
  schedules.value = (scheds ?? []).map((s: any) => ({
    ...s,
    location: normalizeLocation(s.location),
  })) as Schedule[]

  // Bookable names for the read-only summary line in the panel.
  const { data: bkbls } = await (db.from as any)('bookables')
    .select('id, name')
    .eq('org_id', orgId.value)
    .eq('type', 'VENUE')
  bookableNameById.value = Object.fromEntries((bkbls ?? []).map((b: any) => [b.id, b.name]))

  // Org-level season range (set in /settings General tab).
  const { data: orgRow } = await (db.from as any)('organisations')
    .select('season_start, season_end')
    .eq('id', orgId.value)
    .maybeSingle()
  seasonStart.value = orgRow?.season_start ?? null
  seasonEnd.value = orgRow?.season_end ?? null

  loading.value = false
}

async function loadTrainingEvents() {
  if (!group.value) return
  // Each schedule row maps to its master event via member_group_schedule_id;
  // child events inherit member_group_id but leave that column null, so this
  // query naturally returns one master per schedule.
  const { data: evs } = await (db.from as any)('events')
    .select('id, title, member_group_schedule_id')
    .eq('member_group_id', group.value.id)
    .not('member_group_schedule_id', 'is', null)
  const map: Record<string, { id: string; title: string }> = {}
  for (const e of evs ?? []) {
    if (e.member_group_schedule_id) map[e.member_group_schedule_id] = { id: e.id, title: e.title }
  }
  trainingEventByScheduleId.value = map
}

function emptyLocation(): LocationEntry {
  return { type: 'BOOKABLE', venue_name: '', address: '', meeting_link: '', bookable_ids: [] }
}

function normalizeLocation(raw: any): LocationEntry {
  const base = emptyLocation()
  if (!raw || typeof raw !== 'object') return base
  return {
    type: raw.type ?? 'BOOKABLE',
    venue_name: raw.venue_name ?? '',
    address: raw.address ?? '',
    meeting_link: raw.meeting_link ?? '',
    bookable_ids: Array.isArray(raw.bookable_ids) ? raw.bookable_ids : [],
  }
}

function formatTime(hhmm: string): string {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setHours(h ?? 0, m ?? 0, 0, 0)
  return d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function locationLabel(loc: LocationEntry): string {
  if (loc.type === 'ADDRESS') {
    return [loc.venue_name, loc.address].filter(Boolean).join(', ')
  }
  if (loc.type === 'ONLINE') return loc.meeting_link || 'Online'
  if (loc.type === 'BOOKABLE') {
    const names = loc.bookable_ids
      .map(id => bookableNameById.value[id])
      .filter(Boolean)
    return names.join(', ')
  }
  return ''
}

function formatSchedule(s: Schedule): string {
  const base = `${dayShort[s.day_of_week]} ${formatTime(s.start_time)} – ${formatTime(s.end_time)}`
  const label = locationLabel(s.location)
  return label ? `${base} · ${label}` : base
}

function openScheduleEditor() {
  draftSchedules.value = schedules.value.map(s => ({
    ...s,
    location: { ...s.location, bookable_ids: [...s.location.bookable_ids] },
  }))
  editorOpen.value = true
}

function openLocationPicker(index: number) {
  locationPickerIndex.value = index
  const loc = draftSchedules.value[index]?.location ?? emptyLocation()
  locationDraft.value = { ...loc, bookable_ids: [...loc.bookable_ids] }
  locationPickerOpen.value = true
}

function applyLocationPicker() {
  if (locationPickerIndex.value !== null && locationDraft.value) {
    draftSchedules.value[locationPickerIndex.value].location = locationDraft.value
  }
  locationPickerOpen.value = false
  locationPickerIndex.value = null
  locationDraft.value = null
}

function addDraftSchedule() {
  draftSchedules.value.push({
    id: `new-${Date.now()}-${Math.random()}`,
    day_of_week: 1,
    start_time: '15:00',
    end_time: '17:00',
    location: emptyLocation(),
    sort_order: draftSchedules.value.length,
  })
}

async function saveSchedules() {
  if (!group.value || !orgId.value) return
  savingSchedules.value = true
  const gid = group.value.id
  const draft = draftSchedules.value.filter(r => r.start_time && r.end_time)
  const existing = draft.filter(r => !r.id.startsWith('new-'))
  const fresh = draft.filter(r => r.id.startsWith('new-'))

  // Delete rows the user removed from the draft. Existing rows are
  // updated in place so that events linked via
  // member_group_schedule_id stay attached.
  const keepIds = existing.map(r => r.id)
  let delQ: any = (db.from as any)('member_group_schedules').delete().eq('group_id', gid)
  if (keepIds.length) delQ = delQ.not('id', 'in', `(${keepIds.join(',')})`)
  await delQ

  for (let i = 0; i < existing.length; i++) {
    const r = existing[i]
    await (db.from as any)('member_group_schedules').update({
      day_of_week: r.day_of_week,
      start_time: r.start_time,
      end_time: r.end_time,
      location: r.location,
      sort_order: i,
    }).eq('id', r.id)
  }

  if (fresh.length) {
    await (db.from as any)('member_group_schedules').insert(
      fresh.map((r, i) => ({
        org_id: orgId.value,
        group_id: gid,
        day_of_week: r.day_of_week,
        start_time: r.start_time,
        end_time: r.end_time,
        location: r.location,
        sort_order: existing.length + i,
      }))
    )
  }

  const { data: scheds } = await (db.from as any)('member_group_schedules')
    .select('id, day_of_week, start_time, end_time, location, sort_order')
    .eq('group_id', gid)
    .order('day_of_week')
    .order('start_time')
  schedules.value = (scheds ?? []).map((s: any) => ({
    ...s,
    location: normalizeLocation(s.location),
  })) as Schedule[]
  await loadTrainingEvents()
  savingSchedules.value = false
  editorOpen.value = false
}

async function removeMember(m: Member) {
  if (!group.value) return
  const ok = window.confirm(`Remove ${m.name} from ${group.value.name}?`)
  if (!ok) return
  await (db.from as any)('member_group_memberships')
    .delete()
    .eq('group_id', group.value.id)
    .eq('person_id', m.id)
  members.value = members.value.filter(x => x.id !== m.id)
}

async function createAttendanceEvent() {
  if (!group.value || !orgId.value) return
  if (createBlockedReason.value) return
  if (!seasonStart.value || !seasonEnd.value) return
  creatingEvent.value = true
  try {
    const { expandRrule, dateKey } = await import('~/composables/useRecurrence')
    // Re-fetch existing event links right before iterating so a stale
    // local cache (e.g. a previous click that already created events
    // but the watcher hasn't repainted) can't double-create.
    await loadTrainingEvents()
    const toCreate = schedules.value.filter(s => !trainingEventByScheduleId.value[s.id])

    const untilStr = `${seasonEnd.value.replace(/-/g, '')}T235959Z`
    const [ey, em, ed] = seasonEnd.value.split('-').map(Number)
    const seasonEndDate = new Date(ey, (em ?? 1) - 1, ed ?? 1, 23, 59, 59)
    const byDayCodes = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

    for (const sched of toCreate) {
      const firstDate = findFirstOccurrence(sched.day_of_week)
      if (!firstDate || firstDate > seasonEndDate) continue

      const [sh, smin] = sched.start_time.split(':').map(Number)
      const [eh, emin] = sched.end_time.split(':').map(Number)
      const masterStart = new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate(), sh ?? 0, smin ?? 0)
      const masterEnd = new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate(), eh ?? 0, emin ?? 0)
      const duration = masterEnd.getTime() - masterStart.getTime()

      const rrule = `FREQ=WEEKLY;BYDAY=${byDayCodes[sched.day_of_week]};UNTIL=${untilStr}`
      const dayName = dayNames[sched.day_of_week]

      const sharedFields = {
        org_id: orgId.value,
        title: `${group.value.name} — ${dayName} Training`,
        style: 'BASIC',
        member_group_id: group.value.id,
        member_group_schedule_id: sched.id,
        location_type: sched.location.type,
        bookable_id: sched.location.type === 'BOOKABLE' ? (sched.location.bookable_ids[0] ?? null) : null,
        address: sched.location.type === 'ADDRESS'
          ? [sched.location.venue_name, sched.location.address].filter(Boolean).join(', ') || null
          : null,
        meeting_link: sched.location.type === 'ONLINE' ? (sched.location.meeting_link || null) : null,
        status: 'DRAFT',
      }

      const { data: master } = await (db.from as any)('events').insert({
        ...sharedFields,
        start_at: masterStart.toISOString(),
        end_at: masterEnd.toISOString(),
        recurrence_rule: rrule,
      }).select('id').single()
      if (!master) continue

      // Materialize child events (one per subsequent weekly occurrence
      // inside the season). The master itself already represents the
      // first occurrence so we skip its dateKey.
      const occurrences = expandRrule(rrule, masterStart, seasonEndDate, 200)
      const masterKey = dateKey(masterStart)
      // Children inherit member_group_id (so reporting + the attendance
      // landing still find them) but the schedule-id pointer stays on
      // the master alone — that keeps the "1 schedule = 1 master" model
      // clean.
      const { member_group_schedule_id: _omit, ...childShared } = sharedFields
      const childRows = occurrences
        .filter(d => dateKey(d) !== masterKey)
        .map(d => {
          const childStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), sh ?? 0, smin ?? 0)
          const childEnd = new Date(childStart.getTime() + duration)
          return {
            ...childShared,
            recurrence_parent_id: master.id,
            recurrence_rule: null,
            start_at: childStart.toISOString(),
            end_at: childEnd.toISOString(),
          }
        })
      const eventIds: string[] = [master.id]
      if (childRows.length) {
        const { data: insertedChildren } = await (db.from as any)('events').insert(childRows).select('id')
        for (const c of insertedChildren ?? []) eventIds.push(c.id)
      }

      // Invite every group member to every event in the series, so the
      // attendance tab on each occurrence is preloaded with the roster.
      const memberPersonIds = members.value.map(m => m.id)
      if (memberPersonIds.length && eventIds.length) {
        const inviteeRows: any[] = []
        for (const eid of eventIds) {
          for (const pid of memberPersonIds) {
            inviteeRows.push({ event_id: eid, person_id: pid, status: 'INVITED' })
          }
        }
        await (db.from as any)('invitees').insert(inviteeRows)
      }
    }

    await loadTrainingEvents()
  } finally {
    creatingEvent.value = false
  }
}

function findFirstOccurrence(dow: number): Date | null {
  if (!seasonStart.value) return null
  const [sy, sm, sd] = seasonStart.value.split('-').map(Number)
  const d = new Date(sy, (sm ?? 1) - 1, sd ?? 1)
  while (d.getDay() !== dow) d.setDate(d.getDate() + 1)
  return d
}

watch(orgId, load, { immediate: true })
watch(() => route.params.id, () => { if (orgId.value) load() })
</script>
