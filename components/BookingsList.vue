<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-semibold text-surface-900">Bookings</h1>
        <p class="text-sm text-surface-500 mt-0.5">Manage bookable resource reservations.</p>
      </div>
      <div class="flex items-center gap-2">
        <Button icon="pi pi-link" label="Public links" size="small" severity="secondary" @click="sharePopover.toggle($event)" />
        <Button icon="pi pi-external-link" label="Public booking page" size="small" severity="secondary" @click="navigateTo(`/book?org=${orgId}`, { open: { target: '_blank' } })" />
        <Button label="New Booking" icon="pi pi-plus" size="small" @click="navigateTo('/bookings/new')" />
      </div>

      <Popover ref="sharePopover">
        <div class="w-96">
          <!-- Picker page — shows every active activity, then routes to
               the right flow (scheduler or wizard) based on the activity. -->
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Picker page</p>
          <div class="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-indigo-50 mb-4">
            <p class="text-sm font-semibold text-indigo-800 truncate">All activities</p>
            <div class="shrink-0 flex items-center gap-2">
              <a :href="`/book?org=${orgId}`" target="_blank"
                class="flex items-center gap-1 text-xs text-indigo-700 hover:underline font-medium">
                <i class="pi pi-external-link text-[10px]" />
                Open
              </a>
              <button class="flex items-center gap-1 text-xs text-indigo-700 hover:underline font-medium"
                @click="copyOrgLink">
                <i class="pi pi-copy text-[10px]" />
                Copy
              </button>
              <button class="flex items-center gap-1 text-xs text-indigo-700 hover:underline font-medium"
                @click="copyEmbedFor()">
                <i class="pi pi-code text-[10px]" />
                Embed
              </button>
            </div>
          </div>

          <!-- Direct activity links — skip the picker, drop the user
               straight into one activity's flow. Use these for "Book
               Tennis" buttons on the host site. -->
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Direct activity links</p>
          <p class="text-[11px] text-gray-400 mb-2">Skip the picker — the booker lands straight in this activity's flow.</p>
          <div v-if="!publicActivities.length" class="text-sm text-gray-400 py-2">
            No active activities with bookings enabled.
          </div>
          <div v-else class="space-y-1 max-h-64 overflow-y-auto">
            <div v-for="a in publicActivities" :key="a.id"
              class="flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-gray-50">
              <div class="min-w-0 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full shrink-0"
                  :style="{ background: a.color || '#1E2157' }" />
                <p class="text-sm font-semibold text-gray-800 truncate">{{ a.name }}</p>
              </div>
              <div class="shrink-0 flex items-center gap-2">
                <a :href="activityUrl(a.id)" target="_blank"
                  class="flex items-center gap-1 text-xs text-[#1E2157] hover:underline font-medium">
                  <i class="pi pi-external-link text-[10px]" />
                  Open
                </a>
                <button class="flex items-center gap-1 text-xs text-[#1E2157] hover:underline font-medium"
                  @click="copyActivityLink(a.id)">
                  <i class="pi pi-copy text-[10px]" />
                  Copy
                </button>
                <button class="flex items-center gap-1 text-xs text-[#1E2157] hover:underline font-medium"
                  @click="copyEmbedFor(a.id)">
                  <i class="pi pi-code text-[10px]" />
                  Embed
                </button>
              </div>
            </div>
          </div>
        </div>
      </Popover>
    </div>

    <!-- Date quick-filters -->
    <div class="flex items-center gap-1.5 mb-3 flex-wrap">
      <button v-for="opt in dateFilters" :key="opt.value"
        class="px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5"
        :class="dateFilter === opt.value
          ? 'bg-[#1E2157] text-white'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
        @click="dateFilter = opt.value">
        {{ opt.label }}
        <span v-if="dateFilter === opt.value" class="text-[10px] opacity-80">
          {{ countForFilter(opt.value) }}
        </span>
      </button>
    </div>

    <!-- Search + view toggle -->
    <div class="flex items-center gap-3 mb-4 flex-wrap">
      <IconField>
        <InputIcon class="pi pi-search" />
        <InputText v-model="search" placeholder="Search bookings…" size="small" class="w-64" />
      </IconField>

      <!-- View toggle on right -->
      <div class="ml-auto flex rounded-lg border border-gray-200 overflow-hidden">
        <button class="px-2.5 py-1.5 transition-colors text-xs font-medium flex items-center gap-1"
          :class="groupByDate ? 'bg-white text-gray-500 hover:bg-gray-50' : 'bg-[#1E2157] text-white'"
          @click="groupByDate = false" title="Flat list">
          <i class="pi pi-list text-xs" />
          List
        </button>
        <button class="px-2.5 py-1.5 transition-colors text-xs font-medium flex items-center gap-1 border-l border-gray-200"
          :class="groupByDate ? 'bg-[#1E2157] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'"
          @click="groupByDate = true" title="Group by date">
          <i class="pi pi-calendar text-xs" />
          By date
        </button>
      </div>

      <button v-if="hasActiveFilter"
        class="text-xs text-gray-500 hover:text-[#1E2157] font-medium flex items-center gap-1"
        @click="clearFilters">
        <i class="pi pi-times text-[10px]" />
        Clear filters
      </button>
    </div>

    <!-- Empty state -->
    <div v-if="!loading && !filtered.length" class="bg-white rounded-xl border border-gray-200 py-16 text-center">
      <i class="pi pi-book text-3xl text-gray-300 mb-3 block" />
      <p class="text-sm text-gray-500">{{ bookings.length ? 'No bookings match your filters.' : 'No bookings yet.' }}</p>
      <button v-if="hasActiveFilter" class="text-xs text-[#1E2157] hover:underline mt-2 font-medium" @click="clearFilters">
        Clear filters
      </button>
    </div>

    <!-- Single table — optionally grouped by date via subheader rows -->
    <div v-else :class="['card', { 'grouped-bookings': groupByDate }]">
      <DataTable
        :value="rowsForTable"
        :loading="loading"
        row-hover
        :striped-rows="!groupByDate"
        size="small"
        :row-group-mode="groupByDate ? 'subheader' : undefined"
        :group-rows-by="groupByDate ? 'dateGroup' : undefined"
        :sort-field="groupByDate ? 'dateGroup' : 'start_at'"
        :sort-order="1"
        :filters="dummyFilters"
        filter-display="row"
        @row-click="openBooking($event.data)"
      >
        <template #groupheader="{ data }">
          <div class="flex items-center gap-3 py-1">
            <span class="text-sm font-semibold text-gray-900">{{ data._groupTitle }}</span>
            <span v-if="data._groupBadge"
              class="text-[10px] font-medium px-2 py-0.5 rounded-full"
              :class="data._groupBadgeClass">
              {{ data._groupBadge }}
            </span>
            <span class="text-xs text-gray-400">{{ data._groupCount }} booking{{ data._groupCount !== 1 ? 's' : '' }}</span>
          </div>
        </template>

        <Column field="start_at" header="Start" sortable filter-field="start_at" :show-filter-menu="false"
          :style="groupByDate ? 'width:170px' : 'width:200px'">
          <template #filter>
            <DatePicker v-model="startDateFilter" placeholder="From" date-format="d M" show-button-bar
              size="small" class="w-full" />
          </template>
          <template #body="{ data }">
            <div v-if="data.start_at && groupByDate">
              <p class="text-sm text-gray-800">{{ formatTime(data.start_at) }}</p>
            </div>
            <div v-else-if="data.start_at" class="flex flex-col">
              <div class="flex items-center gap-1.5">
                <span class="text-sm text-gray-800 font-medium">{{ formatDateShort(data.start_at) }}</span>
                <span class="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                  :class="relativeBadgeClass(data.start_at)">
                  {{ relativeBadge(data.start_at) }}
                </span>
              </div>
              <span class="text-xs text-gray-500">{{ formatTime(data.start_at) }}</span>
            </div>
            <span v-else class="text-sm text-gray-400">—</span>
          </template>
        </Column>

        <Column field="end_at" header="End" sortable filter-field="end_at" :show-filter-menu="false"
          :style="groupByDate ? 'width:140px' : 'width:180px'">
          <template #filter>
            <DatePicker v-model="endDateFilter" placeholder="To" date-format="d M" show-button-bar
              size="small" class="w-full" />
          </template>
          <template #body="{ data }">
            <div v-if="data.end_at && groupByDate">
              <p class="text-sm text-gray-800">{{ formatTime(data.end_at) }}</p>
            </div>
            <div v-else-if="data.end_at" class="flex flex-col">
              <span class="text-sm text-gray-800">{{ formatDateShort(data.end_at) }}</span>
              <span class="text-xs text-gray-500">{{ formatTime(data.end_at) }}</span>
            </div>
            <span v-else class="text-sm text-gray-400">—</span>
          </template>
        </Column>

        <Column field="duration" header="Duration" sortable style="width:110px">
          <template #body="{ data }">
            <span class="text-sm text-gray-800">{{ durationLabel(data) || '—' }}</span>
          </template>
        </Column>

        <Column field="bookable.name" header="Bookable" sortable filter-field="bookable.name" :show-filter-menu="false">
          <template #filter>
            <Select v-model="bookableFilter"
              :options="[{ label: 'All', value: '' }, ...bookableFilterOptions]"
              option-label="label" option-value="value"
              placeholder="All" size="small" filter class="w-full" />
          </template>
          <template #body="{ data }">
            <span class="text-sm text-gray-800">{{ data.bookable?.name ?? '—' }}</span>
          </template>
        </Column>

        <Column field="bookable.type" header="Type" sortable filter-field="bookable.type" :show-filter-menu="false" style="width:160px">
          <template #filter>
            <Select v-model="typeFilter" :options="typeOptions"
              option-label="label" option-value="value"
              placeholder="All" size="small" class="w-full" />
          </template>
          <template #body="{ data }">
            <span v-if="data.bookable?.type" class="inline-flex items-center gap-1 text-sm text-gray-800">
              <i :class="`pi ${typeIcon(data.bookable.type)} text-[10px]`" />
              {{ typeLabel(data.bookable.type) }}
            </span>
            <span v-else class="text-sm text-gray-400">—</span>
          </template>
        </Column>

        <Column header="Event / Purpose" filter-field="purpose" :show-filter-menu="false">
          <template #filter>
            <InputText v-model="purposeFilter" placeholder="Filter…" size="small" class="w-full" />
          </template>
          <template #body="{ data }">
            <span class="text-sm text-gray-800">{{ data.event?.title ?? data.purpose ?? '—' }}</span>
          </template>
        </Column>

        <Column field="status" header="Status" sortable filter-field="status" :show-filter-menu="false" style="width:150px">
          <template #filter>
            <Select v-model="statusFilter" :options="statusOptions"
              option-label="label" option-value="value"
              placeholder="All" size="small" class="w-full" />
          </template>
          <template #body="{ data }">
            <Tag :value="data.status" :severity="statusSeverity(data.status)" />
          </template>
        </Column>

        <Column style="width:60px">
          <template #body="{ data }">
            <Button
              icon="pi pi-ellipsis-v"
              severity="secondary"
              text
              rounded
              size="small"
              @click.stop="openMenu($event, data)"
            />
          </template>
        </Column>
      </DataTable>
    </div>

    <Menu ref="rowMenu" :model="menuItems" :popup="true" />

    <!-- Create Dialog -->
    <Dialog v-model:visible="showCreate" header="New Booking" modal style="width: 480px">
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Bookable</label>
          <Select
            v-model="form.bookable_id"
            :options="bookables"
            option-label="name"
            option-value="id"
            placeholder="Select resource…"
            filter
            class="w-full"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Event (optional)</label>
          <Select
            v-model="form.event_id"
            :options="events"
            option-label="title"
            option-value="id"
            placeholder="Link to event…"
            filter
            show-clear
            class="w-full"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Purpose</label>
          <InputText v-model="form.purpose" placeholder="e.g. Training session" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Start</label>
            <DatePicker v-model="form.start_at" show-time hour-format="12" class="w-full" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">End</label>
            <DatePicker v-model="form.end_at" show-time hour-format="12" class="w-full" />
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showCreate = false" />
        <Button label="Create" :loading="creating" :disabled="!form.bookable_id" @click="handleCreate" />
      </template>
    </Dialog>

    <Toast />
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
const { orgId } = useOrg()

const db = useDb()
const toast = useToast()

const bookings = ref<any[]>([])
const bookables = ref<any[]>([])
const events = ref<any[]>([])
const loading = ref(true)
const search = ref('')
const statusFilter = ref('')
const modeFilter = ref('')
const bookableFilter = ref('')
const typeFilter = ref('')
const purposeFilter = ref('')
const startDateFilter = ref<Date | null>(null)
const endDateFilter = ref<Date | null>(null)
const dateFilter = ref<'all' | 'today' | 'week' | 'upcoming' | 'past'>('upcoming')

// Required to enable PrimeVue's `filter-display="row"` UI; we don't actually use
// PrimeVue's filtering — our own `applyFilters` handles it via the refs above.
const dummyFilters = ref({
  start_at: { value: null, matchMode: 'equals' },
  end_at: { value: null, matchMode: 'equals' },
  'bookable.name': { value: null, matchMode: 'equals' },
  'bookable.type': { value: null, matchMode: 'equals' },
  purpose: { value: null, matchMode: 'contains' },
  status: { value: null, matchMode: 'equals' },
})
const groupByDate = ref(true)
const showCreate = ref(false)
const creating = ref(false)
const rowMenu = ref()
const sharePopover = ref()
const menuItems = ref<any[]>([])

const dateFilters = [
  { label: 'All',        value: 'all'      as const },
  { label: 'Today',      value: 'today'    as const },
  { label: 'This week',  value: 'week'     as const },
  { label: 'Upcoming',   value: 'upcoming' as const },
  { label: 'Past',       value: 'past'     as const },
]

const publicBookables = computed(() => bookables.value.filter(b => b.is_public))

interface PublicActivity {
  id: string
  name: string
  color: string | null
  booking_flow: 'wizard' | 'scheduler'
}
const publicActivities = ref<PublicActivity[]>([])

function activityUrl(activityId: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/book?org=${orgId.value}&activityId=${activityId}`
}
function orgUrl(): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/book?org=${orgId.value}`
}
function embedSnippet(activityId?: string): string {
  // Embeds get the &embed=1 flag so /book switches to the full-width
  // layout — no max-width caps, no centred cards, fills the host
  // iframe edge-to-edge. The Open / Copy actions still use the
  // un-flagged URLs so a standalone page stays nicely centred.
  const base = activityId ? activityUrl(activityId) : orgUrl()
  const url = `${base}${base.includes('?') ? '&' : '?'}embed=1`
  return `<iframe src="${url}" width="100%" height="700" frameborder="0" style="border:none;border-radius:8px"></iframe>`
}

const embedCode = computed(() => embedSnippet())

const allModes = computed(() => {
  const seen = new Set<string>()
  const result: any[] = []
  for (const b of bookings.value) {
    if (b.mode?.id && !seen.has(b.mode.id)) {
      seen.add(b.mode.id)
      result.push(b.mode)
    }
  }
  return result.sort((a: any, b: any) => a.name.localeCompare(b.name))
})

const bookableFilterOptions = computed(() => {
  const used = new Set<string>()
  for (const b of bookings.value) if (b.bookable?.id) used.add(b.bookable.id)
  return bookables.value
    .filter(b => used.has(b.id))
    .map(b => ({ label: b.name, value: b.id }))
})

const form = ref<any>({ bookable_id: '', event_id: null, purpose: '', start_at: null, end_at: null })

const statusOptions = [
  { label: 'Status', value: '' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Cancelled', value: 'CANCELLED' },
]

const typeOptions = [
  { label: 'Type', value: '' },
  { label: 'Venue',  value: 'VENUE' },
  { label: 'Person', value: 'PERSON' },
  { label: 'Item',   value: 'ITEM' },
]

function typeIcon(t: string) {
  return { VENUE: 'pi-building', PERSON: 'pi-user', ITEM: 'pi-box' }[t] ?? 'pi-tag'
}
function typeLabel(t: string) {
  return { VENUE: 'Venue', PERSON: 'Person', ITEM: 'Item' }[t] ?? t
}

function statusSeverity(s: string) {
  return { CONFIRMED: 'success', PENDING: 'warn', CANCELLED: 'danger', COMPLETED: 'secondary' }[s] ?? 'secondary'
}

// ── Date helpers ────────────────────────────────────────────
function startOfDay(d: Date) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x
}
function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const now = ref(new Date())
let nowInterval: any
onMounted(() => {
  nowInterval = setInterval(() => { now.value = new Date() }, 60_000)
})
onUnmounted(() => { if (nowInterval) clearInterval(nowInterval) })

function diffDays(target: Date) {
  return Math.round((startOfDay(target).getTime() - startOfDay(now.value).getTime()) / 86_400_000)
}

function relativeBadge(d: string | Date) {
  const date = new Date(d)
  const diff = diffDays(date)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff > 0 && diff <= 7) return `in ${diff}d`
  if (diff < 0 && diff >= -7) return `${Math.abs(diff)}d ago`
  return ''
}

function relativeBadgeClass(d: string | Date) {
  const diff = diffDays(new Date(d))
  if (diff === 0) return 'bg-green-100 text-green-700'
  if (diff === 1) return 'bg-blue-100 text-blue-700'
  if (diff > 0 && diff <= 7) return 'bg-indigo-50 text-indigo-700'
  if (diff < 0) return 'bg-gray-100 text-gray-500'
  return 'bg-gray-100 text-gray-500'
}

function formatDateShort(d: string) {
  return new Date(d).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
}
function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
}
function formatGroupTitle(d: Date) {
  return d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })
}

function durationLabel(b: any) {
  if (!b.start_at || !b.end_at) return ''
  const mins = Math.round((new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) / 60_000)
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60), m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

// ── Filtering ────────────────────────────────────────────────
function inDateWindow(b: any, mode: typeof dateFilter.value): boolean {
  if (!b.start_at) return mode === 'all'
  const start = new Date(b.start_at)
  const end = b.end_at ? new Date(b.end_at) : start
  const today = startOfDay(now.value)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const weekAhead = new Date(today); weekAhead.setDate(today.getDate() + 7)
  switch (mode) {
    case 'all':      return true
    case 'today':    return start < tomorrow && end >= today
    case 'week':     return start < weekAhead && end >= today
    case 'upcoming': return end >= now.value
    case 'past':     return end < now.value
  }
}

function applyFilters(list: any[], opts: { skipDate?: boolean } = {}): any[] {
  const q = search.value.toLowerCase()
  return list.filter(b => {
    const matchSearch = !q ||
      (b.bookable?.name ?? '').toLowerCase().includes(q) ||
      (b.event?.title ?? '').toLowerCase().includes(q) ||
      (b.purpose ?? '').toLowerCase().includes(q)
    const matchStatus = !statusFilter.value || b.status === statusFilter.value
    const matchMode = !modeFilter.value || b.mode?.id === modeFilter.value
    const matchBookable = !bookableFilter.value || b.bookable?.id === bookableFilter.value
    const matchType = !typeFilter.value || b.bookable?.type === typeFilter.value
    const matchPurpose = !purposeFilter.value ||
      ((b.event?.title ?? '') + ' ' + (b.purpose ?? '')).toLowerCase().includes(purposeFilter.value.toLowerCase())
    const matchStart = !startDateFilter.value || (b.start_at && new Date(b.start_at) >= startOfDay(startDateFilter.value))
    const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x }
    const matchEnd = !endDateFilter.value || (b.end_at && new Date(b.end_at) <= endOfDay(endDateFilter.value))
    const matchDate = opts.skipDate || inDateWindow(b, dateFilter.value)
    return matchSearch && matchStatus && matchMode && matchBookable && matchType && matchPurpose && matchStart && matchEnd && matchDate
  })
}

const filtered = computed(() => applyFilters(bookings.value))

function countForFilter(value: typeof dateFilter.value) {
  // Count is based on all other filters except date
  const baseList = applyFilters(bookings.value, { skipDate: true })
  return baseList.filter(b => inDateWindow(b, value)).length
}

const hasActiveFilter = computed(() =>
  !!search.value || !!statusFilter.value || !!modeFilter.value ||
  !!bookableFilter.value || !!typeFilter.value || !!purposeFilter.value ||
  !!startDateFilter.value || !!endDateFilter.value ||
  dateFilter.value !== 'all'
)
function clearFilters() {
  search.value = ''
  statusFilter.value = ''
  modeFilter.value = ''
  bookableFilter.value = ''
  typeFilter.value = ''
  purposeFilter.value = ''
  startDateFilter.value = null
  endDateFilter.value = null
  dateFilter.value = 'all'
}

// ── Rows for the table (with date-group metadata when grouped) ──
function withDuration(b: any) {
  const mins = b.start_at && b.end_at
    ? Math.round((new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) / 60_000)
    : 0
  return { ...b, duration: mins }
}

const rowsForTable = computed(() => {
  if (!groupByDate.value) {
    return filtered.value
      .map(withDuration)
      .sort((a, b) => new Date(a.start_at || 0).getTime() - new Date(b.start_at || 0).getTime())
  }

  // Build groups and inject metadata onto each row so PrimeVue's #groupheader
  // (which only sees the first row of each group) can render it.
  const groups: Record<string, any[]> = {}
  for (const b of filtered.value) {
    const key = b.start_at ? dateKey(new Date(b.start_at)) : 'unscheduled'
    if (!groups[key]) groups[key] = []
    groups[key].push(b)
  }
  const result: any[] = []
  for (const k of Object.keys(groups).sort()) {
    const date = k === 'unscheduled' ? null : new Date(k)
    const diff = date ? diffDays(date) : null
    let badge = '', badgeClass = ''
    if (diff === 0)      { badge = 'Today';     badgeClass = 'bg-green-100 text-green-700' }
    else if (diff === 1) { badge = 'Tomorrow';  badgeClass = 'bg-blue-100 text-blue-700' }
    else if (diff === -1){ badge = 'Yesterday'; badgeClass = 'bg-gray-100 text-gray-500' }
    else if (diff !== null && diff > 0 && diff <= 7) { badge = `in ${diff} days`; badgeClass = 'bg-indigo-50 text-indigo-700' }
    else if (diff !== null && diff < 0)              { badge = `${Math.abs(diff)} days ago`; badgeClass = 'bg-gray-100 text-gray-500' }
    const title = date ? formatGroupTitle(date) : 'Unscheduled'
    const sorted = groups[k].slice().sort((a, b) => new Date(a.start_at || 0).getTime() - new Date(b.start_at || 0).getTime())
    for (const row of sorted) {
      result.push({
        ...withDuration(row),
        dateGroup: k,
        _groupTitle: title,
        _groupBadge: badge,
        _groupBadgeClass: badgeClass,
        _groupCount: sorted.length,
      })
    }
  }
  return result
})

// ── Data load ────────────────────────────────────────────────
async function load() {
  loading.value = true
  const [{ data: bookingData }, { data: bookableData }, { data: eventData }, { data: activityData }] = await Promise.all([
    db.from('bookings').select('*, bookable:bookables!bookable_id(id,name,type), event:events(id,title), mode:activity_modes(id,name,color)').order('start_at'),
    db.from('bookables').select('id,name,type,is_public').eq('org_id', orgId.value).neq('status', 'DELETED').order('name'),
    db.from('events').select('id,title').eq('org_id', orgId.value).neq('status', 'ARCHIVED').order('title'),
    (db.from as any)('activities')
      .select('id, name, color, booking_flow, status, bookings_enabled, sort_order')
      .eq('org_id', orgId.value)
      .eq('status', 'ACTIVE')
      .neq('bookings_enabled', false)
      .order('sort_order')
      .order('name'),
  ])
  bookings.value = bookingData ?? []
  bookables.value = bookableData ?? []
  events.value = eventData ?? []
  publicActivities.value = ((activityData ?? []) as PublicActivity[])
  loading.value = false
}

async function handleCreate() {
  if (!form.value.bookable_id) return
  creating.value = true
  const { error } = await db.from('bookings').insert({
    bookable_id: form.value.bookable_id,
    event_id: form.value.event_id || null,
    purpose: form.value.purpose || null,
    start_at: form.value.start_at?.toISOString(),
    end_at: form.value.end_at?.toISOString(),
    status: 'CONFIRMED',
  })
  if (!error) {
    toast.add({ severity: 'success', summary: 'Booking created', life: 3000 })
    showCreate.value = false
    form.value = { bookable_id: '', event_id: null, purpose: '', start_at: null, end_at: null }
    load()
  } else {
    toast.add({ severity: 'error', summary: 'Failed to create booking', life: 3000 })
  }
  creating.value = false
}

function openBooking(b: any) {
  if (b.bookable?.id) navigateTo(`/bookables/${b.bookable.id}?tab=bookings`)
}

function openMenu(event: Event, row: any) {
  menuItems.value = [
    {
      label: 'Open venue',
      icon: 'pi pi-external-link',
      command: () => openBooking(row),
    },
    { separator: true },
    {
      label: row.status === 'CONFIRMED' ? 'Cancel Booking' : 'Confirm Booking',
      icon: row.status === 'CONFIRMED' ? 'pi pi-times' : 'pi pi-check',
      command: async () => {
        const newStatus = row.status === 'CONFIRMED' ? 'CANCELLED' : 'CONFIRMED'
        await db.from('bookings').update({ status: newStatus }).eq('id', row.id)
        toast.add({ severity: 'success', summary: `Booking ${newStatus.toLowerCase()}`, life: 3000 })
        load()
      }
    },
    { separator: true },
    {
      label: 'Delete',
      icon: 'pi pi-trash',
      class: 'text-red-500',
      command: async () => {
        await db.from('bookings').delete().eq('id', row.id)
        toast.add({ severity: 'success', summary: 'Booking deleted', life: 3000 })
        load()
      }
    },
  ]
  rowMenu.value.toggle(event)
}

async function copyEmbedCode() {
  await navigator.clipboard.writeText(embedCode.value)
  toast.add({ severity: 'success', summary: 'Embed code copied!', life: 3000 })
  sharePopover.value.hide()
}

async function copyOrgLink() {
  const url = orgUrl()
  await navigator.clipboard.writeText(url)
  toast.add({ severity: 'success', summary: 'Link copied!', detail: url, life: 3000 })
  sharePopover.value.hide()
}

async function copyActivityLink(activityId: string) {
  const url = activityUrl(activityId)
  await navigator.clipboard.writeText(url)
  toast.add({ severity: 'success', summary: 'Link copied!', detail: url, life: 3000 })
  sharePopover.value.hide()
}

async function copyEmbedFor(activityId?: string) {
  await navigator.clipboard.writeText(embedSnippet(activityId))
  toast.add({
    severity: 'success',
    summary: activityId ? 'Activity embed copied!' : 'Picker embed copied!',
    life: 3000,
  })
  sharePopover.value.hide()
}

onMounted(load)
</script>

<style scoped>
/* Transparent group-header row */
:deep(.p-rowgroup-header),
:deep(.p-rowgroup-header-cell),
:deep(.p-rowgroup-headercell),
:deep(.p-datatable-row-group-header),
:deep(.p-datatable-row-group-header > td),
:deep(.p-datatable-row-group-header-cell),
:deep(tr.p-rowgroup-header),
:deep(tr.p-rowgroup-header > td) {
  background: transparent !important;
  background-color: transparent !important;
  border-top: 0 !important;
  border-bottom: 0 !important;
  box-shadow: none !important;
}
:deep(.p-rowgroup-header-cell),
:deep(.p-rowgroup-headercell),
:deep(.p-datatable-row-group-header > td),
:deep(tr.p-rowgroup-header > td) {
  padding-top: 1.25rem !important;
  padding-bottom: 0.5rem !important;
}

/* Rounded section per date group (only when grouped) */
.grouped-bookings :deep(.p-datatable-row-group-header + tr > td:first-child),
.grouped-bookings :deep(tr.p-rowgroup-header + tr > td:first-child) {
  border-top-left-radius: 8px;
}
.grouped-bookings :deep(.p-datatable-row-group-header + tr > td:last-child),
.grouped-bookings :deep(tr.p-rowgroup-header + tr > td:last-child) {
  border-top-right-radius: 8px;
}
/* Last row in each group: round bottom + remove bottom border */
.grouped-bookings :deep(tbody tr:has(+ .p-datatable-row-group-header) > td),
.grouped-bookings :deep(tbody tr:has(+ tr.p-rowgroup-header) > td),
.grouped-bookings :deep(tbody tr:last-child > td) {
  border-bottom: 0 !important;
}
.grouped-bookings :deep(tbody tr:has(+ .p-datatable-row-group-header) > td:first-child),
.grouped-bookings :deep(tbody tr:has(+ tr.p-rowgroup-header) > td:first-child),
.grouped-bookings :deep(tbody tr:last-child > td:first-child) {
  border-bottom-left-radius: 8px;
}
.grouped-bookings :deep(tbody tr:has(+ .p-datatable-row-group-header) > td:last-child),
.grouped-bookings :deep(tbody tr:has(+ tr.p-rowgroup-header) > td:last-child),
.grouped-bookings :deep(tbody tr:last-child > td:last-child) {
  border-bottom-right-radius: 8px;
}
</style>
