<template>
  <WizardShell
    v-model="step"
    :steps="WIZARD_STEPS"
    :title="wizardTitle"
    :can-next="canNext"
    :saving="saving"
    finish-label="Create programme"
    @finish="createEvent"
    @close="navigateTo('/events')">

    <!-- ── Live summary rail ── -->
    <template #summary>
      <div class="p-5 space-y-4">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Programme</p>
          <p class="text-lg font-semibold mt-1" :class="form.title.trim() ? 'text-gray-900' : 'text-gray-400'">
            {{ form.title.trim() || 'Untitled programme' }}
          </p>
        </div>

        <div class="border-t border-gray-100 pt-3 space-y-3">
          <div class="flex items-start gap-2">
            <i class="pi pi-calendar text-xs mt-1 shrink-0" :class="form.startDate ? 'text-primary' : 'text-gray-300'" />
            <div class="min-w-0">
              <p class="text-sm" :class="form.startDate ? 'text-gray-800' : 'text-gray-400'">{{ summaryWhen }}</p>
              <p v-if="form.exdates.length" class="text-xs text-red-500 mt-0.5">{{ form.exdates.length }} date{{ form.exdates.length !== 1 ? 's' : '' }} skipped</p>
            </div>
          </div>
          <div class="flex items-start gap-2">
            <i class="pi pi-clock text-xs mt-1 shrink-0" :class="sessionDays.length ? 'text-primary' : 'text-gray-300'" />
            <p class="text-sm" :class="sessionDays.length ? 'text-gray-800' : 'text-gray-400'">
              {{ sessionDays.length ? `${sessionDays.length} day${sessionDays.length !== 1 ? 's' : ''} in the programme` : 'No days yet' }}
            </p>
          </div>
          <div class="flex items-start gap-2">
            <i class="pi pi-user-plus text-xs mt-1 shrink-0" :class="form.regOpen ? 'text-primary' : 'text-gray-300'" />
            <p class="text-sm" :class="form.regOpen ? 'text-gray-800' : 'text-gray-400'">{{ summarySignup }}</p>
          </div>
        </div>

        <div class="border-t border-gray-100 pt-3">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Sessions per day</p>
          <div v-if="namedTemplates.length" class="space-y-1.5">
            <div v-for="t in namedTemplates" :key="t.name" class="flex items-center justify-between gap-2 text-sm">
              <span class="text-gray-800 truncate">{{ t.name }}</span>
              <span class="text-xs text-gray-400 shrink-0">{{ fmtTimeShort(t.startTime) }}–{{ fmtTimeShort(t.endTime) }}</span>
            </div>
            <div class="flex items-center justify-between gap-2 text-xs font-semibold text-gray-800 mt-1 pt-2 border-t border-gray-100">
              <span>Total sessions</span><span>{{ totalSessions }}</span>
            </div>
          </div>
          <p v-else class="text-sm text-gray-400">No session templates yet</p>
        </div>
      </div>
    </template>

    <!-- ── Step 1 · Event details ── -->
    <div v-show="step === 0" class="space-y-6">

        <!-- Event Details -->
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div class="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 class="text-sm font-semibold text-gray-700">Event Details</h2>
          </div>
          <div class="px-5 py-4 space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-[160px_1fr] sm:items-center gap-1.5 sm:gap-4">
              <label class="text-sm font-medium text-gray-700">Event Name <span class="text-red-400">*</span></label>
              <InputText v-model="form.title" placeholder="e.g. Easter Holiday Programme" class="w-full" autofocus />
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-[160px_1fr] sm:items-center gap-1.5 sm:gap-4">
              <label class="text-sm font-medium text-gray-700">Age Limit</label>
              <div class="flex items-center gap-2">
                <InputNumber v-model="form.ageMin" :min="0" :max="120" placeholder="Min" class="w-24" inputClass="w-24" />
                <span class="text-sm text-gray-400">to</span>
                <InputNumber v-model="form.ageMax" :min="0" :max="120" placeholder="Max" class="w-24" inputClass="w-24" />
                <span class="text-sm text-gray-500">years</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Dates -->
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div class="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 class="text-sm font-semibold text-gray-700">Dates</h2>
          </div>
          <div class="px-5 py-4 space-y-4">
            <!-- Programme date range — same layout as the event wizard's date rows -->
            <DateTimeEditor
              v-model:startDate="form.startDate"
              v-model:endDate="form.endDate"
              :start-time="null"
              :end-time="null"
              :show-time="false"
              :show-all-day="false"
              :show-repeat="false"
              label="Programme dates"
              required
              label-width="w-[160px]"
              row-padding="px-0 py-2" />
            <!-- Weekends / public holidays: their own rows below the dates -->
            <div class="grid grid-cols-1 sm:grid-cols-[160px_1fr] sm:items-center gap-1.5 sm:gap-4">
              <label class="text-sm font-medium text-gray-700">Weekends</label>
              <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                <Checkbox v-model="form.includeWeekends" :binary="true" />
                Include weekends
              </label>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-[160px_1fr] sm:items-center gap-1.5 sm:gap-4">
              <label class="text-sm font-medium text-gray-700">Public holidays</label>
              <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                <Checkbox v-model="form.excludePublicHolidays" :binary="true" />
                Exclude public holidays
              </label>
            </div>
            <!-- Skip specific dates — same design as the event wizard (RecurrenceExclusions) -->
            <div class="grid grid-cols-1 sm:grid-cols-[160px_1fr] sm:items-start gap-1.5 sm:gap-4">
              <label class="text-sm font-medium text-gray-700 sm:pt-2">Skip dates</label>
              <div class="min-w-0 space-y-2">
                <button type="button"
                  class="inline-flex items-center gap-2 h-9 px-3 rounded-lg border text-sm transition-colors disabled:opacity-50"
                  :class="form.exdates.length ? 'border-primary/40 bg-primary/5 text-primary' : 'border-gray-300 text-gray-600 hover:border-gray-400'"
                  :disabled="!form.startDate || !form.endDate"
                  @click="skipDatesOpen = true">
                  <i class="pi pi-calendar-times text-xs" />
                  {{ form.exdates.length ? `${form.exdates.length} skipped` : 'Skip dates' }}
                </button>
                <div v-if="form.exdates.length" class="flex flex-wrap items-center gap-1">
                  <span class="text-[11px] text-gray-500 mr-1">Skipped:</span>
                  <span v-for="key in sortedExdates" :key="key"
                    class="inline-flex items-center gap-1 text-[11px] bg-gray-100 text-gray-600 rounded-full pl-2 pr-1 py-0.5">
                    {{ formatSkipDate(key) }}
                    <button type="button" class="hover:text-red-500" @click="form.exdates = form.exdates.filter(k => k !== key)"><i class="pi pi-times text-[9px]" /></button>
                  </span>
                  <button type="button" class="text-[11px] text-gray-400 hover:text-gray-700 ml-1" @click="form.exdates = []">Clear all</button>
                </div>
              </div>
            </div>
            <!-- Day count preview -->
            <div v-if="sessionDays.length > 0" class="grid grid-cols-[160px_1fr] items-center gap-4">
              <div />
              <p class="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <i class="pi pi-calendar-clock mr-1.5" />
                <strong>{{ sessionDays.length }}</strong> day{{ sessionDays.length !== 1 ? 's' : '' }} in programme
                <span v-if="!form.includeWeekends" class="text-green-600"> (weekdays only)</span>
                <span v-if="form.excludePublicHolidays" class="text-green-600"> (excl. public holidays)</span>
              </p>
            </div>
            <!-- Signup open / close — same layout as the wizard's sign-up window -->
            <DateTimeEditor
              v-model:startDate="regOpenDate"
              v-model:startTime="regOpenTime"
              v-model:endDate="regCloseDate"
              v-model:endTime="regCloseTime"
              :show-all-day="false"
              :show-repeat="false"
              label="Signup dates"
              start-label="Opens"
              end-label="Closes"
              label-width="w-[160px]"
              row-padding="px-0 py-2" />
          </div>
        </div>
    </div>

    <!-- ── Step 2 · Session details ── -->
    <div v-show="step === 1" class="space-y-6">

        <!-- Session Templates — each carries its own location (per daily session) -->
        <BulkSessionTemplates
          :modelValue="templates"
          :daysCount="sessionDays.length"
          show-location
          @update:modelValue="v => { templates.splice(0, templates.length, ...v) }" />
    </div>

    <!-- Skip-dates calendar (opened from the Programme dates on step 1; teleports) -->
    <Dialog v-model:visible="skipDatesOpen" modal header="Skip dates" :style="{ width: '95vw', maxWidth: '480px' }" :pt="{ content: { class: 'p-4' } }">
      <RecurrenceExclusions
        :model-value="form.exdates"
        :rrule="dailyRule"
        :base-date="form.startDate"
        :range-end="form.endDate"
        @update:model-value="(v: string[]) => form.exdates = v" />
      <template #footer>
        <Button label="Done" size="small" @click="skipDatesOpen = false" style="background:var(--brand-primary); border-color:var(--brand-primary)" />
      </template>
    </Dialog>
  </WizardShell>
</template>

<script setup lang="ts">
const { orgId } = useOrg()
import { ref, reactive, computed } from 'vue'

import type { LocationEntry } from '~/composables/useLocation'

const db = useDb()
const route = useRoute()
const toast = useToast()

const saving = ref(false)

// Parse optional date from calendar click
function parseDateParam(p: string | null) {
  if (!p) return null
  const d = new Date(p)
  return isNaN(d.getTime()) ? null : d
}

const NZ_PUBLIC_HOLIDAYS_2025_2026 = [
  '2025-04-18','2025-04-19','2025-04-20','2025-04-21','2025-04-25',
  '2025-06-02','2025-10-27','2025-12-25','2025-12-26',
  '2026-01-01','2026-01-02','2026-02-06','2026-04-03','2026-04-04',
  '2026-04-05','2026-04-06','2026-04-27','2026-06-01','2026-10-26',
  '2026-12-25','2026-12-26',
]

const form = reactive({
  title: (route.query.name as string) ?? '',
  ageMin: null as number | null,
  ageMax: null as number | null,
  startDate: parseDateParam(route.query.date as string ?? null),
  endDate: parseDateParam(route.query.endDate as string ?? null),
  includeWeekends: true,
  excludePublicHolidays: false,
  exdates: [] as string[],           // YYYY-MM-DD, same model as the wizard's Skip-dates
  regOpen: null as Date | null,
  regClose: null as Date | null,
})

// Local Y-M-D so a skipped date matches the loop day regardless of timezone.
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const excludedYmd = computed(() => new Set(form.exdates))
// A daily rule across the range so <RecurrenceExclusions> treats every programme
// day as a skippable occurrence (the calendar the event wizard uses).
const dailyRule = 'FREQ=DAILY'
const skipDatesOpen = ref(false)
const sortedExdates = computed(() => [...form.exdates].sort())
// A skipped-date chip reads "24th Jul 2026" (ordinal day + short month + year).
function ordinalDay(n: number) {
  const v = n % 100
  const suffix = v >= 11 && v <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')
  return `${n}${suffix}`
}
function formatSkipDate(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return `${ordinalDay(d)} ${new Date(y, m - 1, d).toLocaleDateString('en-AU', { month: 'short' })} ${y}`
}

// <DateTimeEditor> models date + time separately; the sign-up window is stored
// as two single date-times. Split on read, merge on write (same as the wizard).
function withDate(base: Date | null, d: Date | null): Date | null {
  if (!d) return null
  const out = base ? new Date(base) : new Date(d)
  out.setFullYear(d.getFullYear(), d.getMonth(), d.getDate())
  if (!base) out.setHours(0, 0, 0, 0)
  return out
}
function withTime(base: Date | null, t: Date | null): Date | null {
  if (!t) return null
  const out = base ? new Date(base) : new Date()
  out.setHours(t.getHours(), t.getMinutes(), 0, 0)
  return out
}
function combineDT(date: Date | null, time: Date | null): Date | null {
  if (!date) return null
  const out = new Date(date)
  if (time) out.setHours(time.getHours(), time.getMinutes(), 0, 0)
  else out.setHours(0, 0, 0, 0)
  return out
}
const regOpenDate = computed({ get: () => form.regOpen, set: (v: Date | null) => { form.regOpen = withDate(form.regOpen, v) } })
const regOpenTime = computed({ get: () => form.regOpen, set: (v: Date | null) => { form.regOpen = withTime(form.regOpen, v) } })
const regCloseDate = computed({ get: () => form.regClose, set: (v: Date | null) => { form.regClose = withDate(form.regClose, v) } })
const regCloseTime = computed({ get: () => form.regClose, set: (v: Date | null) => { form.regClose = withTime(form.regClose, v) } })

function makeTime(h: number, m = 0) {
  const d = new Date(); d.setHours(h, m, 0, 0); return d
}
function emptyLoc(): LocationEntry {
  return { type: 'ADDRESS', venue_name: '', address: '', meeting_link: '', bookable_ids: [] }
}

const templates = reactive([
  { name: 'Morning',   cost: null as number | null, startTime: makeTime(9),  endTime: makeTime(12), limit: null as number | null, location: [emptyLoc()] as LocationEntry[] },
  { name: 'Afternoon', cost: null as number | null, startTime: makeTime(13), endTime: makeTime(17), limit: null as number | null, location: [emptyLoc()] as LocationEntry[] },
])

// Compute all days in the programme range
const sessionDays = computed(() => {
  if (!form.startDate || !form.endDate) return []
  const days: Date[] = []
  const cur = new Date(form.startDate)
  cur.setHours(0, 0, 0, 0)
  const end = new Date(form.endDate)
  end.setHours(23, 59, 59, 999)
  while (cur <= end) {
    const dow = cur.getDay()
    const iso = cur.toISOString().slice(0, 10)
    const isWeekend = dow === 0 || dow === 6
    const isHoliday = form.excludePublicHolidays && NZ_PUBLIC_HOLIDAYS_2025_2026.includes(iso)
    const isExcluded = excludedYmd.value.has(ymd(cur))
    if (!isExcluded && !isHoliday && (form.includeWeekends || !isWeekend)) days.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return days
})

const namedTemplates = computed(() => templates.filter(t => t.name.trim()))

const totalSessions = computed(() => sessionDays.value.length * namedTemplates.value.length)

const canCreate = computed(() =>
  form.title.trim() !== '' &&
  form.startDate !== null &&
  form.endDate !== null &&
  sessionDays.value.length > 0 &&
  namedTemplates.value.length > 0
)

// ── Wizard chrome (shared <WizardShell>) — Event details → Session details ──
const step = ref(0)
const WIZARD_STEPS = [
  { key: 'details', label: 'Event details' },
  { key: 'sessions', label: 'Session details' },
]
const wizardTitle = computed(() => form.title.trim() || 'New programme')
// Step 1 needs a name + a valid programme range to advance; the final step's
// Create is gated on canCreate (also needs generated days + a named template).
const canNext = computed(() => step.value === 0
  ? (!!form.title.trim() && !!form.startDate && !!form.endDate)
  : canCreate.value)

// ── Live summary rail (right side of the wizard) ──
const fmtDay = (d: Date | null, withYear = false) =>
  d ? d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) }) : '—'
const fmtTimeShort = (d: Date | null) =>
  d ? d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }) : ''
const summaryWhen = computed(() => {
  if (!form.startDate) return 'Set the programme dates'
  return `${fmtDay(form.startDate)} – ${fmtDay(form.endDate, true)}`
})
const summarySignup = computed(() => {
  if (!form.regOpen && !form.regClose) return 'Sign-up window not set'
  return `Sign-ups ${fmtDay(form.regOpen)} → ${fmtDay(form.regClose)}`
})

function buildDatetime(day: Date, timePicker: Date | null, fallbackHour = 0): string {
  const d = new Date(day)
  if (timePicker) {
    d.setHours(timePicker.getHours(), timePicker.getMinutes(), 0, 0)
  } else {
    d.setHours(fallbackHour, 0, 0, 0)
  }
  return d.toISOString()
}

// A session's location (a single LocationEntry) → the flat session location
// columns. Sessions have no locations jsonb, so we store the flat trio.
function locationCols(l?: LocationEntry) {
  return {
    location_type: (l?.type ?? 'ADDRESS') as 'ADDRESS' | 'ONLINE' | 'BOOKABLE',
    address: l?.type === 'ADDRESS' ? (l.address || null) : null,
    meeting_link: l?.type === 'ONLINE' ? (l.meeting_link || null) : null,
  }
}

async function createEvent() {
  if (!canCreate.value) return
  saving.value = true
  try {
    // 1. Create the event
    const { data: evt, error: evtErr } = await db.from('events').insert({
      org_id: orgId.value,
      title: form.title.trim(),
      style: 'ADVANCED',
      created_via: 'multi',
      status: 'DRAFT',
      start_at: combineDT(form.startDate, null)!.toISOString(),
      end_at: combineDT(form.endDate, null)!.toISOString(),
      is_public: true,
      is_programme: route.query.programme === '1',
      // Event-level location = the first session's location (each session carries its own).
      locations: namedTemplates.value[0]?.location ?? [emptyLoc()],
      ...locationCols(namedTemplates.value[0]?.location?.[0]),
    }).select('id').single()

    if (evtErr || !evt?.id) throw evtErr ?? new Error('Failed to create event')

    // 2. For each template, insert the first day as the master session, then
    //    bulk-insert the remaining days linked to that master.
    const days = sessionDays.value
    let sortOrder = 0

    for (const tpl of namedTemplates.value) {
      if (days.length === 0) continue

      // Insert day-1 as master
      const { data: master, error: masterErr } = await db.from('sessions').insert({
        event_id: evt.id,
        title: tpl.name.trim(),
        start_at: buildDatetime(days[0], tpl.startTime, 9),
        end_at: buildDatetime(days[0], tpl.endTime, 17),
        capacity_max: tpl.limit ?? null,
        is_required: false,
        is_public: true,
        ...locationCols(tpl.location?.[0]),
        display_on_form: true,
        is_master: true,
        master_id: null,
        sort_order: sortOrder++,
      }).select('id').single()

      if (masterErr || !master?.id) throw masterErr ?? new Error('Failed to create master session')

      // Bulk-insert remaining days linked to master
      if (days.length > 1) {
        const linked = days.slice(1).map(day => ({
          event_id: evt.id,
          title: tpl.name.trim(),
          start_at: buildDatetime(day, tpl.startTime, 9),
          end_at: buildDatetime(day, tpl.endTime, 17),
          capacity_max: tpl.limit ?? null,
          is_required: false,
          is_public: true,
          ...locationCols(tpl.location?.[0]),
          display_on_form: true,
          is_master: false,
          master_id: master.id,
          sort_order: sortOrder++,
        }))
        const { error: linkedErr } = await db.from('sessions').insert(linked)
        if (linkedErr) throw linkedErr
      }
    }

    toast.add({ severity: 'success', summary: 'Event created', detail: `${days.length * namedTemplates.value.length} sessions generated`, life: 4000 })
    await navigateTo(`/events/${evt.id}`)
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e?.message ?? 'Something went wrong', life: 5000 })
  } finally {
    saving.value = false
  }
}
</script>
