<template>
  <div class="p-6 flex flex-col h-full">
    <!-- Header -->
    <div class="flex items-center justify-between mb-5">
      <div class="flex items-center gap-3">
        <SelectButton
          v-model="viewMode"
          :options="viewOptions"
          option-label="label"
          option-value="value"
          size="small"
        >
          <template #option="{ option }">
            <i :class="`pi ${option.icon} text-sm`" />
          </template>
        </SelectButton>
        <div class="flex items-center gap-1">
          <Button icon="pi pi-chevron-left" severity="secondary" text size="small" @click="prev" />
          <span class="text-sm font-semibold text-gray-800 min-w-36 text-center">{{ calendarTitle }}</span>
          <Button icon="pi pi-chevron-right" severity="secondary" text size="small" @click="next" />
          <Button label="Today" severity="secondary" outlined size="small" class="ml-1" @click="goToday" />
        </div>
      </div>
      <div class="flex items-center gap-2">
        <IconField>
          <InputIcon class="pi pi-search" />
          <InputText v-model="search" placeholder="Search events…" size="small" class="w-48" />
        </IconField>
        <Button
          icon="pi pi-sliders-h"
          severity="secondary"
          outlined
          size="small"
          v-tooltip.bottom="'Calendar Settings'"
          @click="openCalSettings"
        />
        <Button
          label="New Event"
          icon="pi pi-plus"
          size="small"
          @click="openEventTypeModal()"
          style="background:#1E2157; border-color:#1E2157"
        />
      </div>
    </div>

    <!-- Calendar Settings Dialog -->
    <Dialog v-model:visible="showCalSettings" header="Calendar Settings" modal style="width:460px">
      <div class="flex flex-col gap-5 py-1">

        <!-- New calendar / edit calendar -->
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <label class="text-sm font-semibold text-gray-700">{{ editingCalendarId ? 'Edit Category' : 'New Category' }}</label>
            <button
              v-if="editingCalendarId"
              class="text-xs text-red-500 hover:text-red-700 hover:underline"
              @click="deleteCalendar"
            >Delete</button>
          </div>
          <div class="flex gap-2">
            <InputText v-model="newCalendarName" placeholder="Calendar name" class="flex-1" />
          </div>
          <div class="flex items-center gap-1.5">
            <button
              v-for="c in categoryColorPalette"
              :key="c"
              class="w-6 h-6 rounded-full border-2 shrink-0 transition-transform hover:scale-110"
              :class="newCalendarColor === c ? 'border-gray-800 scale-110' : 'border-transparent'"
              :style="{ background: c }"
              @click="newCalendarColor = c"
            />
            <!-- Custom colour picker -->
            <label
              class="w-6 h-6 rounded-full border-2 shrink-0 flex items-center justify-center cursor-pointer hover:scale-110 transition-transform overflow-hidden"
              :class="!categoryColorPalette.includes(newCalendarColor) ? 'border-gray-800 scale-110' : 'border-dashed border-gray-400'"
              :style="!categoryColorPalette.includes(newCalendarColor) ? { background: newCalendarColor } : {}"
              title="Custom colour"
            >
              <input
                type="color"
                v-model="newCalendarColor"
                class="opacity-0 absolute w-px h-px"
              />
              <i v-if="categoryColorPalette.includes(newCalendarColor)" class="pi pi-palette text-gray-400" style="font-size:10px" />
            </label>
          </div>
        </div>

        <div class="border-t border-gray-100" />

        <!-- Color by -->
        <div class="flex flex-col gap-2">
          <label class="text-sm font-semibold text-gray-700">Colour events by</label>
          <SelectButton
            v-model="calSettings.colorBy"
            :options="colorByOptions"
            option-label="label"
            option-value="value"
            size="small"
          />
        </div>

        <!-- Default view -->
        <div class="flex flex-col gap-2">
          <label class="text-sm font-semibold text-gray-700">Default view</label>
          <SelectButton
            v-model="calSettings.defaultView"
            :options="[{ label: 'Month', value: 'dayGridMonth' }, { label: 'Week', value: 'timeGridWeek' }, { label: 'Day', value: 'timeGridDay' }]"
            option-label="label"
            option-value="value"
            size="small"
          />
        </div>

        <!-- Week start -->
        <div class="flex flex-col gap-2">
          <label class="text-sm font-semibold text-gray-700">Week starts on</label>
          <SelectButton
            v-model="calSettings.weekStart"
            :options="[{ label: 'Sunday', value: 0 }, { label: 'Monday', value: 1 }]"
            option-label="label"
            option-value="value"
            size="small"
          />
        </div>

        <!-- Show weekends -->
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-semibold text-gray-700">Show weekends</p>
            <p class="text-xs text-gray-500">Display Saturday and Sunday on the calendar</p>
          </div>
          <ToggleSwitch v-model="calSettings.showWeekends" />
        </div>

        <!-- Calendars / categories -->
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <label class="text-sm font-semibold text-gray-700">Event Categories</label>
            <button class="text-xs text-[#1E2157] hover:underline" @click="navigateTo('/settings/calendars')">Manage</button>
          </div>
          <div v-if="!namedCalendars.length" class="text-xs text-gray-400 py-2">
            No named calendars yet. <button class="text-[#1E2157] hover:underline" @click="navigateTo('/settings/calendars')">Create one</button>
          </div>
          <div class="flex flex-col gap-1.5">
            <div
              v-for="cal in namedCalendars"
              :key="cal.id"
              class="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50"
            >
              <Checkbox v-model="calSettings.visibleCategoryIds" :value="cal.id" :binary="false" />
              <span
                class="w-3 h-3 rounded-full shrink-0"
                :style="{ background: cal.color ?? '#94a3b8' }"
              />
              <span class="text-sm text-gray-700">{{ cal.name }}</span>
            </div>
          </div>
          <div class="border-t border-gray-100 pt-2 mt-1">
            <p class="text-xs text-gray-500 mb-1.5">Show events without a calendar</p>
            <div class="flex items-center gap-2">
              <Checkbox v-model="calSettings.showUncategorised" :binary="true" />
              <span class="text-sm text-gray-600">Uncategorised events</span>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Reset to defaults" severity="secondary" text @click="resetCalSettings" />
        <Button label="Apply" @click="applyCalSettings" style="background:#1E2157; border-color:#1E2157" />
      </template>
    </Dialog>

    <!-- Calendar view -->
    <div v-if="viewMode === 'calendar'" class="bg-white rounded-xl border border-gray-200 overflow-hidden flex-1" style="min-height:0">
      <FullCalendar ref="calendarRef" :options="calendarOptions" style="height:100%" />
    </div>

    <!-- Event hover tooltip -->
    <ClientOnly>
    <Teleport to="body">
      <div v-if="tooltip.visible" class="fixed z-50 pointer-events-none"
        :style="{ top: tooltip.y + 'px', left: tooltip.x + 'px' }">
        <div class="bg-white rounded-xl shadow-xl border border-gray-200 p-4 w-72">
          <!-- Category colour bar -->
          <div class="h-1 rounded-full mb-3" :style="{ background: tooltip.event?.category?.color ?? '#1E2157' }" />
          <p class="font-semibold text-gray-900 text-sm leading-snug mb-2">{{ tooltip.event?.title }}</p>
          <div class="space-y-1.5 text-xs text-gray-500">
            <div v-if="tooltip.event?.start_at" class="flex items-center gap-2">
              <i class="pi pi-calendar w-3.5 shrink-0" />
              <span>{{ formatDate(tooltip.event.start_at) }}<span v-if="tooltip.event.end_at && tooltip.event.start_at !== tooltip.event.end_at" class="text-gray-400"> – {{ formatDate(tooltip.event.end_at) }}</span></span>
              <span v-if="!tooltip.event.is_all_day" class="text-gray-400">{{ formatTime(tooltip.event.start_at) }}<span v-if="tooltip.event.end_at"> – {{ formatTime(tooltip.event.end_at) }}</span></span>
            </div>
            <div v-if="tooltip.event?.address || tooltip.event?.meeting_link" class="flex items-center gap-2">
              <i class="pi pi-map-marker w-3.5 shrink-0" />
              <span class="truncate">{{ tooltip.event.address || tooltip.event.meeting_link }}</span>
            </div>
            <div v-if="tooltip.event?.category" class="flex items-center gap-2">
              <i class="pi pi-tag w-3.5 shrink-0" />
              <span class="px-2 py-0.5 rounded-full text-white text-xs font-medium"
                :style="{ background: tooltip.event.category.color ?? '#1E2157' }">
                {{ tooltip.event.category.name }}
              </span>
            </div>
            <div v-if="tooltip.event?.description" class="flex items-start gap-2 pt-1 border-t border-gray-100">
              <i class="pi pi-align-left w-3.5 shrink-0 mt-0.5" />
              <span class="line-clamp-2 leading-relaxed">{{ tooltip.event.description }}</span>
            </div>
          </div>
          <div class="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between">
            <span class="text-xs px-2 py-0.5 rounded-full font-medium"
              :class="tooltip.event?.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'">
              {{ tooltip.event?.status }}
            </span>
            <span class="text-xs text-gray-400">Click to open</span>
          </div>
        </div>
      </div>
    </Teleport>
    </ClientOnly>

    <!-- List view -->
    <div v-if="viewMode !== 'calendar'" class="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <DataTable
        :value="filtered"
        :loading="loading"
        row-hover
        size="small"
        @row-click="e => navigateTo(`/events/${e.data.id}`)"
        class="cursor-pointer"
      >
        <template #empty>
          <div class="text-center py-12 text-gray-400">
            <i class="pi pi-calendar text-3xl mb-3 block" />
            <p>No events yet. Create your first event.</p>
          </div>
        </template>

        <Column field="title" header="Event">
          <template #body="{ data }">
            <div>
              <p class="font-medium text-gray-900">{{ data.title }}</p>
              <p v-if="data.category" class="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                <span class="w-2 h-2 rounded-full inline-block" :style="{ background: data.category?.color ?? '#94a3b8' }" />
                {{ data.category.name }}
              </p>
            </div>
          </template>
        </Column>

        <Column field="style" header="Style" style="width:160px">
          <template #body="{ data }">
            <Tag :value="STYLE_LABELS[data.style]" severity="secondary" />
          </template>
        </Column>

        <Column field="start_at" header="Date" style="width:200px">
          <template #body="{ data }">
            <span class="text-gray-600 text-sm">
              {{ data.start_at ? formatDate(data.start_at) : '—' }}<span v-if="data.end_at && data.start_at !== data.end_at" class="text-gray-400"> – {{ formatDate(data.end_at) }}</span>
            </span>
            <span v-if="data.start_at && !data.is_all_day" class="block text-xs text-gray-400">
              {{ formatTime(data.start_at) }}<span v-if="data.end_at"> – {{ formatTime(data.end_at) }}</span>
            </span>
          </template>
        </Column>

        <Column field="status" header="Status" style="width:110px">
          <template #body="{ data }">
            <Tag :value="data.status" :severity="statusSeverity(data.status)" />
          </template>
        </Column>

        <Column style="width:60px">
          <template #body="{ data }">
            <Button icon="pi pi-ellipsis-v" severity="secondary" text rounded size="small" @click.stop="openMenu($event, data)" />
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- Row menu -->
    <Menu ref="rowMenu" :model="menuItems" :popup="true" />

    <!-- Event type picker modal -->
    <Dialog v-model:visible="showEventTypeModal" header="Create new event" modal style="width:540px">
      <!-- AI builder -->
      <div class="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-4 mb-5 space-y-3">
        <div class="flex items-center gap-2">
          <i class="pi pi-sparkles text-indigo-500" />
          <span class="text-sm font-semibold text-indigo-800">Describe your event and AI will set it up</span>
        </div>
        <Textarea
          v-model="aiPrompt"
          placeholder="e.g. A committee meeting that repeats on the second Wednesday of the month at 6pm"
          rows="2"
          auto-resize
          class="w-full text-sm"
          :disabled="aiLoading"
        />
        <div class="flex items-center gap-3">
          <Button
            label="Generate Event"
            icon="pi pi-sparkles"
            size="small"
            :loading="aiLoading"
            :disabled="!aiPrompt.trim()"
            @click="createWithAi"
            style="background:#4F46E5; border-color:#4F46E5"
          />
          <span v-if="aiError" class="text-xs text-red-500">{{ aiError }}</span>
        </div>
      </div>

      <div class="flex items-center gap-3 mb-4">
        <div class="flex-1 h-px bg-gray-200" />
        <span class="text-xs text-gray-400 font-medium">or choose manually</span>
        <div class="flex-1 h-px bg-gray-200" />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div
          class="border-2 rounded-xl p-5 cursor-pointer hover:border-[#1E2157] hover:bg-[#F0F4FF] transition-colors group"
          @click="createBasicEvent"
        >
          <div class="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mb-3">
            <i class="pi pi-calendar text-[#1E2157] text-lg" />
          </div>
          <h3 class="font-semibold text-gray-900 mb-1">Basic Event</h3>
          <p class="text-xs text-gray-500 leading-relaxed">Simple single-page setup. Covers all essentials without the wizard steps.</p>
        </div>
        <div
          class="border-2 rounded-xl p-5 cursor-pointer hover:border-[#1E2157] hover:bg-[#F0F4FF] transition-colors group"
          @click="createAdvancedEvent"
        >
          <div class="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center mb-3">
            <i class="pi pi-list text-purple-700 text-lg" />
          </div>
          <h3 class="font-semibold text-gray-900 mb-1">Advanced Event</h3>
          <p class="text-xs text-gray-500 leading-relaxed">Full wizard with fees, forms, discounts, automation and more.</p>
        </div>
      </div>
    </Dialog>

    <Toast />
    <ConfirmDialog />
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'

const db = useDb()
const toast = useToast()
const confirm = useConfirm()
const route = useRoute()

const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000002'

const events = ref<any[]>([])
const separateSessions = ref<any[]>([])
const loading = ref(true)
const search = ref('')
const showCalSettings = useCalendarSettingsOpen()
const showEventTypeModal = ref(false)
const clickedDate = ref<string | null>(null)
const clickedEndDate = ref<string | null>(null)
const aiPrompt = ref('')
const aiLoading = ref(false)
const aiError = ref('')

async function createWithAi() {
  if (!aiPrompt.value.trim()) return
  aiLoading.value = true
  aiError.value = ''
  try {
    const result = await $fetch<any>('/api/ai-parse-event', {
      method: 'POST',
      body: { description: aiPrompt.value },
    })
    sessionStorage.setItem('ai_event_prefill', JSON.stringify(result))
    showEventTypeModal.value = false
    aiPrompt.value = ''
    const params = new URLSearchParams()
    if (clickedDate.value) params.set('date', clickedDate.value)
    if (clickedEndDate.value) params.set('endDate', clickedEndDate.value)
    params.set('prefill', '1')
    const q = `?${params}`
    navigateTo(`/events/new${q}`)
  } catch (e: any) {
    aiError.value = e?.data?.message ?? 'Something went wrong'
  } finally {
    aiLoading.value = false
  }
}
const viewMode = ref('calendar')
const calendarRef = ref()

function openEventTypeModal(date?: string, endDate?: string) {
  clickedDate.value = date ?? null
  clickedEndDate.value = endDate ?? null
  showEventTypeModal.value = true
}

function createBasicEvent() {
  showEventTypeModal.value = false
  const params = new URLSearchParams()
  if (clickedDate.value) params.set('date', clickedDate.value)
  if (clickedEndDate.value) params.set('endDate', clickedEndDate.value)
  const q = params.size ? `?${params}` : ''
  navigateTo(`/events/new${q}`)
}

function createAdvancedEvent() {
  showEventTypeModal.value = false
  const params = new URLSearchParams()
  if (clickedDate.value) params.set('date', clickedDate.value)
  if (clickedEndDate.value) params.set('endDate', clickedEndDate.value)
  const q = params.size ? `?${params}` : ''
  navigateTo(`/events/new${q}`)
}

// Calendar settings
const calSettings = reactive({
  colorBy: 'category',
  defaultView: 'dayGridMonth',
  weekStart: 1,
  showWeekends: true,
  visibleCategoryIds: [] as string[],
  showUncategorised: true,
})

const colorByOptions = [
  { label: 'Calendar', value: 'category' },
  { label: 'Status', value: 'status' },
  { label: 'Style', value: 'style' },
]

const namedCalendars = ref<any[]>([])

async function loadCalendars() {
  const { data } = await db.from('categories').select('id, name, color, icon').eq('org_id', DEFAULT_ORG_ID).order('name')
  namedCalendars.value = data ?? []
  // Default: all visible
  if (calSettings.visibleCategoryIds.length === 0 && data?.length) {
    calSettings.visibleCategoryIds = data.map((c: any) => c.id)
  }
}

function resetCalSettings() {
  calSettings.colorBy = 'category'
  calSettings.defaultView = 'dayGridMonth'
  calSettings.weekStart = 1
  calSettings.showWeekends = true
  calSettings.visibleCategoryIds = namedCalendars.value.map(c => c.id)
  calSettings.showUncategorised = true
}

async function applyCalSettings() {
  if (newCalendarName.value.trim()) {
    await createNewCalendar()
  }
  showCalSettings.value = false
  // Reload calendar with new settings
  const api = calendarRef.value?.getApi()
  if (api) {
    api.setOption('weekends', calSettings.showWeekends)
    api.setOption('firstDay', calSettings.weekStart)
    api.changeView(calSettings.defaultView)
  }
}

// New calendar creation / editing (inside cal settings dialog)
const categoryColorPalette = [
  '#1E2157', '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#6b7280',
]
const newCalendarName = ref('')
const newCalendarColor = ref('#1E2157')
const creatingCalendar = ref(false)
const editingCalendarId = ref<string | null>(null)

function openCalSettings() {
  const calId = route.query.calendar as string | undefined
  if (calId) {
    const cal = namedCalendars.value.find(c => c.id === calId)
    if (cal) {
      newCalendarName.value = cal.name
      newCalendarColor.value = cal.color ?? '#1E2157'
      editingCalendarId.value = cal.id
    }
  } else {
    newCalendarName.value = ''
    newCalendarColor.value = '#1E2157'
    editingCalendarId.value = null
  }
  showCalSettings.value = true
}

async function createNewCalendar() {
  if (!newCalendarName.value.trim()) return
  creatingCalendar.value = true
  const name = newCalendarName.value.trim()

  if (editingCalendarId.value) {
    // Rename / recolour existing calendar
    const { error } = await db.from('categories').update({
      name,
      color: newCalendarColor.value,
    }).eq('id', editingCalendarId.value)
    creatingCalendar.value = false
    if (error) {
      toast.add({ severity: 'error', summary: 'Failed to update calendar', detail: error.message, life: 3000 })
      return
    }
    toast.add({ severity: 'success', summary: `Calendar updated`, life: 2000 })
  } else {
    // Create new calendar
    const { error } = await db.from('categories').insert({
      org_id: DEFAULT_ORG_ID,
      name,
      color: newCalendarColor.value,
    })
    creatingCalendar.value = false
    if (error) {
      toast.add({ severity: 'error', summary: 'Failed to create calendar', detail: error.message, life: 3000 })
      return
    }
    toast.add({ severity: 'success', summary: `Calendar "${name}" created`, life: 2000 })
  }

  newCalendarName.value = ''
  newCalendarColor.value = '#1E2157'
  editingCalendarId.value = null
  await loadCalendars()
}

function deleteCalendar() {
  if (!editingCalendarId.value) return
  confirm.require({
    message: `Are you sure you want to delete "${newCalendarName.value}"? This cannot be undone.`,
    header: 'Delete Calendar',
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Cancel',
    acceptLabel: 'Delete',
    acceptClass: 'p-button-danger',
    accept: async () => {
      const { error } = await db.from('categories').delete().eq('id', editingCalendarId.value!)
      if (error) {
        toast.add({ severity: 'error', summary: 'Failed to delete calendar', detail: error.message, life: 3000 })
        return
      }
      toast.add({ severity: 'success', summary: 'Calendar deleted', life: 2000 })
      showCalSettings.value = false
      newCalendarName.value = ''
      newCalendarColor.value = '#1E2157'
      editingCalendarId.value = null
      await navigateTo('/events')
      await loadCalendars()
    },
  })
}

const rowMenu = ref()
const menuItems = ref<any[]>([])
let menuEvent: any = null

const viewOptions = [
  { label: 'Calendar', value: 'calendar', icon: 'pi-calendar' },
  { label: 'List', value: 'list', icon: 'pi-list' },
]

const STYLE_LABELS: Record<string, string> = {
  BASIC: 'Basic',
  ADVANCED: 'Advanced',
  MULTI_SESSION: 'Multi-Session',
  SPORTS_COMPETITION: 'Competition',
  HOLIDAY_PROGRAM: 'Camp / Program',
  ATTENDANCE: 'Attendance',
  COMPETITION: 'Competition',
}

const styleOptions = Object.entries(STYLE_LABELS).map(([value, label]) => ({ value, label }))

const EVENT_COLORS: Record<string, string> = {
  DRAFT: '#94a3b8',
  PUBLISHED: '#1E2157',
  CANCELLED: '#ef4444',
  ARCHIVED: '#d1d5db',
}

function statusSeverity(s: string) {
  return { DRAFT: 'secondary', PUBLISHED: 'success', CANCELLED: 'danger', ARCHIVED: 'warn' }[s] ?? 'secondary'
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })
}

const calendarTitle = ref('')

// Hover tooltip
const tooltip = reactive({ visible: false, x: 0, y: 0, event: null as any })
let tooltipTimer: ReturnType<typeof setTimeout> | null = null

function showTooltip(info: any) {
  if (tooltipTimer) clearTimeout(tooltipTimer)
  const rect = info.el.getBoundingClientRect()
  // Position to the right of the event pill, flip left if near edge
  let x = rect.right + 10
  let y = rect.top
  if (x + 290 > window.innerWidth) x = rect.left - 300
  if (y + 280 > window.innerHeight) y = window.innerHeight - 290
  tooltip.event = info.event.extendedProps
  tooltip.x = x
  tooltip.y = y
  tooltipTimer = setTimeout(() => { tooltip.visible = true }, 200)
}

function hideTooltip() {
  if (tooltipTimer) clearTimeout(tooltipTimer)
  tooltip.visible = false
}

function eventColor(e: any) {
  if (calSettings.colorBy === 'category') {
    return e.category?.color ?? '#1E2157'
  }
  if (calSettings.colorBy === 'style') {
    const styleColors: Record<string, string> = {
      BASIC: '#3B82F6', ADVANCED: '#8B5CF6', MULTI_SESSION: '#F59E0B',
      SPORTS_COMPETITION: '#EF4444', HOLIDAY_PROGRAM: '#10B981', ATTENDANCE: '#6B7280',
    }
    return styleColors[e.style] ?? '#1E2157'
  }
  return EVENT_COLORS[e.status] ?? '#1E2157'
}

const calendarEvents = computed(() => {
  const categoryFilter = (categoryId: string | null) => {
    if (namedCalendars.value.length === 0 || calSettings.visibleCategoryIds.length === 0) return true
    if (categoryId) return calSettings.visibleCategoryIds.includes(categoryId)
    return calSettings.showUncategorised
  }

  const eventItems = events.value
    .filter(e => categoryFilter(e.category_id))
    .map(e => ({
      id: e.id,
      title: e.title,
      start: e.start_at ?? new Date().toISOString(),
      end: e.end_at ?? undefined,
      allDay: e.is_all_day ?? false,
      backgroundColor: eventColor(e),
      borderColor: 'transparent',
      textColor: '#ffffff',
      extendedProps: e,
    }))

  const sessionItems = separateSessions.value
    .filter(s => categoryFilter(s.event?.category_id ?? null))
    .map(s => {
      const categoryColor = namedCalendars.value.find(c => c.id === s.event?.category_id)?.color ?? '#1E2157'
      const category = namedCalendars.value.find(c => c.id === s.event?.category_id) ?? null
      return {
        id: `session-${s.id}`,
        title: s.title || 'Untitled Session',
        start: s.start_at ?? new Date().toISOString(),
        end: s.end_at ?? undefined,
        allDay: s.is_all_day ?? false,
        backgroundColor: categoryColor,
        borderColor: 'transparent',
        textColor: '#ffffff',
        extendedProps: {
          ...s,
          _isSession: true,
          _eventId: s.event_id,
          category,
          status: `Session · ${s.event?.title ?? ''}`,
        },
      }
    })

  return [...eventItems, ...sessionItems]
})

const calendarOptions = ref({
  plugins: [dayGridPlugin, interactionPlugin],
  initialView: 'dayGridMonth',
  headerToolbar: false,
  events: [] as any[],
  height: '100%',
  selectable: true,
  selectMirror: true,
  select: (info: any) => {
    const startStr = info.startStr.split('T')[0]
    // FullCalendar end is exclusive — subtract 1 day using local date parts to avoid UTC shift
    const [y, m, d] = info.endStr.split('T')[0].split('-').map(Number)
    const end = new Date(y, m - 1, d)
    end.setDate(end.getDate() - 1)
    const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
    openEventTypeModal(startStr, startStr !== endStr ? endStr : undefined)
  },
  eventClick: (info: any) => {
    const props = info.event.extendedProps
    if (props._isSession) {
      navigateTo(`/events/${props._eventId}?tab=sessions`)
    } else {
      navigateTo(`/events/${info.event.id}`)
    }
  },
  datesSet: (info: any) => {
    const d = info.view.currentStart
    calendarTitle.value = d.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
  },
  eventDisplay: 'block',
  dayMaxEvents: 3,
  dayCellClassNames: 'hover:bg-gray-50 cursor-pointer',
  eventMouseEnter: (info: any) => showTooltip(info),
  eventMouseLeave: () => hideTooltip(),
})

function prev() {
  calendarRef.value?.getApi()?.prev()
}
function next() {
  calendarRef.value?.getApi()?.next()
}
function goToday() {
  calendarRef.value?.getApi()?.today()
}

const filtered = computed(() => events.value.filter(e =>
  e.title.toLowerCase().includes(search.value.toLowerCase())
))

async function load() {
  loading.value = true
  const [{ data, error }, { data: sessionData, error: sessionError }] = await Promise.all([
    db.from('events')
      .select('*, category:categories!category_id(id, name, color, icon)')
      .eq('org_id', DEFAULT_ORG_ID)
      .neq('status', 'ARCHIVED')
      .order('start_at', { ascending: true, nullsFirst: false }),
    db.from('sessions')
      .select('*, event:events!event_id(id, title, status, org_id, category_id)')
      .eq('show_as_separate_event', true)
      .is('parent_session_id', null)
      .not('start_at', 'is', null),
  ])
  if (error) console.error('events load error:', error)
  if (sessionError) console.error('sessions load error:', sessionError)
  events.value = data ?? []
  separateSessions.value = (sessionData ?? []).filter((s: any) => {
    const ev = s.event
    return ev && ev.status !== 'ARCHIVED' && ev.org_id === DEFAULT_ORG_ID
  })
  loading.value = false
}


function openMenu(event: Event, row: any) {
  menuEvent = row
  menuItems.value = [
    { label: 'View', icon: 'pi pi-eye', command: () => navigateTo(`/events/${menuEvent.id}`) },
    ...(row.status === 'DRAFT' ? [{ label: 'Publish', icon: 'pi pi-send', command: () => publishEvent(menuEvent.id) }] : []),
    { separator: true },
    { label: 'Archive', icon: 'pi pi-trash', class: 'text-red-500', command: () => archiveEvent(menuEvent.id) },
  ]
  rowMenu.value.toggle(event)
}

async function publishEvent(id: string) {
  await db.from('events').update({ status: 'PUBLISHED' }).eq('id', id)
  toast.add({ severity: 'success', summary: 'Event published', life: 3000 })
  load()
}

async function archiveEvent(id: string) {
  await db.from('events').update({ status: 'ARCHIVED' }).eq('id', id)
  toast.add({ severity: 'success', summary: 'Event archived', life: 3000 })
  load()
}

// Keep calendarOptions.events in sync with the filtered computed list
watch(calendarEvents, (evts) => {
  calendarOptions.value.events = evts
}, { immediate: true })

// Set initial calendar title
onMounted(async () => {
  await Promise.all([load(), loadCalendars()])
  calendarTitle.value = new Date().toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
})
</script>

<style>
.fc .fc-toolbar { display: none; }
.fc .fc-daygrid-day-top { padding: 6px 8px; }
.fc .fc-daygrid-day-number { font-size: 12px; color: #374151; font-weight: 500; }
.fc .fc-col-header-cell-cushion { font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; padding: 8px 0; }
.fc .fc-daygrid-event { border-radius: 4px; padding: 1px 6px; font-size: 12px; font-weight: 500; margin: 1px 4px; }
.fc .fc-day-today .fc-daygrid-day-frame { background: #f0f4ff; }
.fc .fc-day-today .fc-daygrid-day-number { color: #1E2157; font-weight: 700; }
.fc-theme-standard td, .fc-theme-standard th { border-color: #e5e7eb; }
.fc-theme-standard .fc-scrollgrid { border-color: transparent; }
</style>
