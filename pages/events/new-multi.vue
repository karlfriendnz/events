<template>
  <div class="flex flex-col" style="height: calc(100vh - 3.5rem)">
    <!-- Header -->
    <div class="bg-white border-b border-gray-200 px-6 py-3.5 flex items-center justify-between shrink-0">
      <div class="flex items-center gap-3">
        <NuxtLink to="/events" class="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1">
          <i class="pi pi-chevron-left text-xs" /> Events
        </NuxtLink>
        <span class="text-gray-300">/</span>
        <span class="text-sm font-medium text-gray-800">New Multi-Session Event</span>
      </div>
      <div class="flex items-center gap-2">
        <Button label="Cancel" severity="secondary" outlined size="small" @click="navigateTo('/events')" />
        <Button label="Create Event" icon="pi pi-check" size="small" :loading="saving" :disabled="!canCreate" @click="createEvent" style="background:#1E2157; border-color:#1E2157" />
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto bg-[#F5F8FA]">
      <div class="max-w-[860px] mx-auto px-6 py-8 space-y-6">

        <!-- Banner -->
        <div class="bg-green-50 border border-green-200 rounded-xl px-5 py-4 flex items-start gap-3">
          <i class="pi pi-clone text-green-600 text-lg mt-0.5 shrink-0" />
          <div>
            <p class="text-sm font-semibold text-green-800">Multi-Session Event</p>
            <p class="text-xs text-green-700 mt-0.5">Ideal for holiday programmes. Define your session templates below and we'll generate individual sessions for every day in the programme — all under one event with shared registration.</p>
          </div>
        </div>

        <!-- Event Details -->
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div class="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 class="text-sm font-semibold text-gray-700">Event Details</h2>
          </div>
          <div class="px-5 py-4 space-y-4">
            <div class="grid grid-cols-[160px_1fr] items-center gap-4">
              <label class="text-sm font-medium text-gray-700">Event Name <span class="text-red-400">*</span></label>
              <InputText v-model="form.title" placeholder="e.g. Easter Holiday Programme" class="w-full" autofocus />
            </div>
            <div class="grid grid-cols-[160px_1fr] items-center gap-4">
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
            <!-- Programme date range -->
            <div class="grid grid-cols-[160px_1fr] items-center gap-4">
              <label class="text-sm font-medium text-gray-700">Programme Dates <span class="text-red-400">*</span></label>
              <div class="flex items-center gap-3 flex-wrap">
                <DatePicker v-model="form.startDate" placeholder="Start date" dateFormat="dd/mm/yy" class="w-40" />
                <span class="text-sm text-gray-400">to</span>
                <DatePicker v-model="form.endDate" placeholder="End date" dateFormat="dd/mm/yy" class="w-40" :minDate="form.startDate ?? undefined" />
                <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none ml-1">
                  <Checkbox v-model="form.includeWeekends" :binary="true" />
                  Include weekends
                </label>
                <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none ml-1">
                  <Checkbox v-model="form.excludePublicHolidays" :binary="true" />
                  Exclude public holidays
                </label>
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
            <!-- Signup open / close -->
            <div class="grid grid-cols-[160px_1fr] items-center gap-4">
              <label class="text-sm font-medium text-gray-700">Signup Dates</label>
              <div class="flex items-center gap-3">
                <DatePicker v-model="form.regOpen" placeholder="Opens" dateFormat="dd/mm/yy" showTime hourFormat="12" class="w-48" />
                <span class="text-sm text-gray-400">to</span>
                <DatePicker v-model="form.regClose" placeholder="Closes" dateFormat="dd/mm/yy" showTime hourFormat="12" class="w-48" />
              </div>
            </div>
            <!-- Public calendar -->
            <div class="grid grid-cols-[160px_1fr] items-center gap-4">
              <label class="text-sm font-medium text-gray-700">Visibility</label>
              <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                <Checkbox v-model="form.isPublic" :binary="true" />
                Show on public calendar
              </label>
            </div>
          </div>
        </div>

        <!-- Session Templates -->
        <BulkSessionTemplates
          :modelValue="templates"
          :daysCount="sessionDays.length"
          @update:modelValue="v => { templates.splice(0, templates.length, ...v) }" />

        <!-- Preview summary -->
        <div v-if="canCreate" class="bg-[#1E2157]/5 border border-[#1E2157]/20 rounded-xl px-5 py-4">
          <p class="text-sm font-semibold text-[#1E2157] mb-2">Ready to create</p>
          <ul class="text-sm text-gray-600 space-y-1">
            <li><i class="pi pi-calendar text-[#1E2157] mr-2 text-xs" /><strong>{{ form.title }}</strong></li>
            <li><i class="pi pi-clock text-[#1E2157] mr-2 text-xs" />{{ sessionDays.length }} days · {{ templates.filter(t => t.name.trim()).length }} session template{{ templates.filter(t => t.name.trim()).length !== 1 ? 's' : '' }} per day</li>
            <li><i class="pi pi-list text-[#1E2157] mr-2 text-xs" /><strong>{{ totalSessions }}</strong> sessions will be created automatically</li>
          </ul>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { orgId } = useOrg()
import { ref, reactive, computed } from 'vue'

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
  regOpen: null as Date | null,
  regClose: null as Date | null,
  isPublic: true,
})

function makeTime(h: number, m = 0) {
  const d = new Date(); d.setHours(h, m, 0, 0); return d
}

const templates = reactive([
  { name: 'Morning',   cost: null as number | null, startTime: makeTime(9),  endTime: makeTime(12), limit: null as number | null },
  { name: 'Afternoon', cost: null as number | null, startTime: makeTime(13), endTime: makeTime(17), limit: null as number | null },
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
    if (!isHoliday && (form.includeWeekends || !isWeekend)) days.push(new Date(cur))
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

function buildDatetime(day: Date, timePicker: Date | null, fallbackHour = 0): string {
  const d = new Date(day)
  if (timePicker) {
    d.setHours(timePicker.getHours(), timePicker.getMinutes(), 0, 0)
  } else {
    d.setHours(fallbackHour, 0, 0, 0)
  }
  return d.toISOString()
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
      status: 'DRAFT',
      start_at: form.startDate!.toISOString(),
      end_at: form.endDate!.toISOString(),
      is_public: form.isPublic,
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
        is_public: form.isPublic,
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
          is_public: form.isPublic,
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
