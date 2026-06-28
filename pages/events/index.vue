<template>
  <div class="p-3 sm:p-6 flex flex-col h-full">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-5">
      <div class="flex items-center gap-2 sm:gap-3 min-w-0">
        <!-- View selector is desktop-only; mobile is forced to the agenda list view -->
        <Select
          :model-value="calSettings.defaultView"
          :options="calViews"
          option-label="label"
          option-value="value"
          size="small"
          class="hidden md:block w-32"
          @update:model-value="setCalView" />
        <div class="hidden md:flex items-center gap-1 min-w-0">
          <Button icon="pi pi-chevron-left" severity="secondary" text size="small" @click="prev" />
          <span class="text-sm font-semibold text-gray-800 sm:min-w-36 text-center truncate">{{ calendarTitle }}</span>
          <Button icon="pi pi-chevron-right" severity="secondary" text size="small" @click="next" />
          <Button label="Today" severity="secondary" outlined size="small" class="ml-1 shrink-0" @click="goToday" />
        </div>
        <span class="md:hidden text-base font-semibold text-gray-900">Events</span>
      </div>
      <div class="flex items-center gap-2">
        <IconField class="flex-1 sm:flex-none">
          <InputIcon class="pi pi-search" />
          <InputText v-model="search" placeholder="Search events…" size="small" class="w-full sm:w-48" />
        </IconField>
        <Button
          icon="pi pi-sliders-h"
          severity="secondary"
          outlined
          size="small"
          class="hidden md:inline-flex"
          v-tooltip.bottom="'Calendar Settings'"
          @click="openCalSettings"
        />
        <Button
          :label="isNarrow ? undefined : 'New Event'"
          icon="pi pi-plus"
          size="small"
          class="shrink-0"
          @click="openEventTypeModal()"
          style="background:var(--brand-primary); border-color:var(--brand-primary)"
        />
      </div>
    </div>

    <!-- Calendar Settings Dialog -->
    <Dialog v-model:visible="showCalSettings" :header="activeCalendar ? `Calendar Settings — ${activeCalendar.name}` : 'Calendar Settings'" modal :style="{ width: '95vw', maxWidth: '460px' }">
      <div class="flex flex-col gap-5 py-1">

        <!-- New calendar / edit calendar -->
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <label class="text-sm font-semibold text-gray-700">
              {{ editingCalendarId ? `Edit "${newCalendarName || 'calendar'}"` : 'New Calendar' }}
            </label>
            <button
              v-if="editingCalendarId"
              class="text-xs text-red-500 hover:text-red-700 hover:underline"
              @click="deleteCalendar"
            >Delete</button>
          </div>
          <InputText v-model="newCalendarName" placeholder="Calendar name" class="w-full" />
          <MultiSelect
            v-model="newCalendarCategoryIds"
            :options="allCategories"
            option-label="name"
            option-value="id"
            placeholder="Assign categories…"
            display="chip"
            class="w-full"
          >
            <template #option="{ option }">
              <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full shrink-0" :style="{ background: option.color ?? '#94a3b8' }" />
                <span>{{ option.name }}</span>
              </div>
            </template>
          </MultiSelect>
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
            :options="[{ label: 'Month', value: 'dayGridMonth' }, { label: 'Week', value: 'timeGridWeek' }, { label: 'Day', value: 'timeGridDay' }, { label: 'List', value: 'listWeek' }]"
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

        <!-- Venue filter -->
        <div class="flex flex-col gap-2">
          <label class="text-sm font-semibold text-gray-700">Filter by venue</label>
          <MultiSelect
            v-model="calSettings.visibleBookableIds"
            :options="allBookables"
            option-label="name"
            option-value="id"
            placeholder="All venues"
            display="chip"
            filter
            class="w-full" />
          <p class="text-xs text-gray-500">Leave empty to show all venues.</p>
        </div>

        <!-- Category filter -->
        <div class="flex flex-col gap-2">
          <label class="text-sm font-semibold text-gray-700">Filter by category</label>
          <MultiSelect
            v-model="calSettings.visibleCategoryIds"
            :options="allCategories"
            option-label="name"
            option-value="id"
            placeholder="All categories"
            display="chip"
            filter
            class="w-full">
            <template #option="{ option }">
              <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full shrink-0" :style="{ background: option.color ?? '#94a3b8' }" />
                <span>{{ option.name }}</span>
              </div>
            </template>
          </MultiSelect>
          <p class="text-xs text-gray-500">Leave empty to show all categories.</p>
        </div>

      </div>
      <template #footer>
        <Button label="Reset to defaults" severity="secondary" text @click="resetCalSettings" />
        <Button label="Apply" @click="applyCalSettings" style="background:var(--brand-primary); border-color:var(--brand-primary)" />
      </template>
    </Dialog>

    <!-- Move-recurring dialog -->
    <Dialog v-model:visible="dropDialog.open" modal header="Move recurring event" :style="{ width: '95vw', maxWidth: '480px' }">
      <div class="flex flex-col gap-3 py-2">
        <p class="text-sm text-gray-700">This event is part of a recurring series. What do you want to move?</p>
        <label class="flex items-start gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors"
          :class="dropDialog.scope === 'this' ? 'border-primary bg-[#EFF6FF]' : 'border-gray-200 hover:bg-gray-50'">
          <RadioButton v-model="dropDialog.scope" value="this" />
          <div>
            <p class="text-sm font-medium text-gray-800">Just this event</p>
            <p class="text-xs text-gray-500">Only this single occurrence is moved.</p>
          </div>
        </label>
        <label class="flex items-start gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors"
          :class="dropDialog.scope === 'following' ? 'border-primary bg-[#EFF6FF]' : 'border-gray-200 hover:bg-gray-50'">
          <RadioButton v-model="dropDialog.scope" value="following" />
          <div>
            <p class="text-sm font-medium text-gray-800">This and all following</p>
            <p class="text-xs text-gray-500">Move this event and every occurrence after it by the same offset.</p>
          </div>
        </label>
        <label class="flex items-start gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors"
          :class="dropDialog.scope === 'all' ? 'border-primary bg-[#EFF6FF]' : 'border-gray-200 hover:bg-gray-50'">
          <RadioButton v-model="dropDialog.scope" value="all" />
          <div>
            <p class="text-sm font-medium text-gray-800">All events in the series</p>
            <p class="text-xs text-gray-500">Shift every occurrence (including past ones) by the same offset.</p>
          </div>
        </label>
        <div v-if="dropDialog.pending?.conflicts?.length"
          class="flex items-start gap-2 mt-1 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
          <i class="pi pi-exclamation-triangle text-amber-500 text-xs mt-0.5" />
          <div class="text-xs text-amber-700">
            Heads up — there's already an event in this series on the new date: <strong>{{ dropDialog.pending.conflicts.join(', ') }}</strong>.
            Moving "this" only will create a duplicate.
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text size="small" @click="dropDialog.open = false; dropDialog.pending = null" />
        <Button label="Move" icon="pi pi-arrow-right" size="small" @click="performDropMove" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
      </template>
    </Dialog>

    <!-- Mobile: upcoming-events list (the calendar grid is desktop-only) -->
    <div class="md:hidden flex-1 overflow-y-auto -mx-1 px-1" style="min-height:0">
      <div v-if="!mobileEventsList.length" class="card p-10 text-center text-gray-400">
        <i class="pi pi-calendar text-3xl mb-3 block" />
        <p>No upcoming events.</p>
        <button class="text-primary hover:underline mt-2 text-sm" @click="openEventTypeModal()">Create one →</button>
      </div>
      <div v-else class="space-y-2">
        <button v-for="ev in mobileEventsList" :key="ev.id" type="button"
          class="card w-full p-3 flex items-center gap-3 text-left active:bg-gray-50 transition-colors"
          @click="onCalendarEventClick(ev)">
          <div class="w-12 h-12 shrink-0 rounded-xl flex flex-col items-center justify-center text-white" :style="{ background: ev.color || 'var(--brand-primary)' }">
            <span class="text-[9px] uppercase leading-none">{{ evDow(ev.start_at) }}</span>
            <span class="text-lg font-bold leading-tight">{{ new Date(ev.start_at).getDate() }}</span>
          </div>
          <div class="min-w-0 flex-1">
            <p class="font-medium text-gray-800 truncate">{{ ev.notes }}</p>
            <p class="text-xs text-gray-500 truncate">{{ evWhen(ev.start_at) }}</p>
          </div>
          <i class="pi pi-chevron-right text-gray-300 text-xs shrink-0" />
        </button>
      </div>
    </div>

    <!-- Calendar view (desktop) -->
    <div class="hidden md:flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden flex-1" style="min-height:0">
      <BookingsCalendar
        :cal-date="calDate"
        :cal-view="bookingsCalView"
        :custom-events="bookingsCalEvents"
        @booking-click="onCalendarEventClick"
        @booking-drop="onCalendarEventDrop"
        @booking-hover="onCalendarEventHover"
        @booking-leave="hideTooltip"
        @slot-click="onCalendarSlotClick"
      />
    </div>

    <!-- Event hover tooltip -->
    <ClientOnly>
    <Teleport to="body">
      <div v-if="tooltip.visible" class="fixed z-50 pointer-events-none"
        :style="{ top: tooltip.y + 'px', left: tooltip.x + 'px' }">
        <div class="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden w-72">
          <!-- Banner image -->
          <div v-if="tooltip.event?.banner_url" class="h-32 overflow-hidden">
            <img :src="tooltip.event.banner_url" class="w-full h-full object-cover" />
          </div>
          <!-- Category colour bar (only when no banner) -->
          <div v-else class="h-1 rounded-full mx-4 mt-4" :style="{ background: tooltip.event?.category?.color ?? '#1E2157' }" />
          <div class="p-4">
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
      </div>
    </Teleport>
    </ClientOnly>

    <!-- Row menu -->
    <Menu ref="rowMenu" :model="menuItems" :popup="true" />

    <!-- Event name modal (step 1) -->
    <Dialog v-model:visible="showEventNameModal" header="New event" modal :style="{ width: '95vw', maxWidth: '420px' }" @keydown.enter.prevent="submitEventName">
      <div class="space-y-4 pt-1">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Event name</label>
          <InputText
            ref="eventNameInput"
            v-model="newEventName"
            placeholder="e.g. Saturday Training"
            class="w-full"
            autofocus
            @keydown.enter="submitEventName"
          />
        </div>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" size="small" severity="secondary" text @click="showEventNameModal = false" />
          <Button label="Next" icon="pi pi-arrow-right" icon-pos="right" size="small" :disabled="!newEventName.trim()" @click="submitEventName" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
        </div>
      </div>
    </Dialog>

    <!-- Event type picker modal -->
    <Dialog v-model:visible="showEventTypeModal" header="Create new event" modal :style="{ width: '95vw', maxWidth: '680px' }">

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          class="border-2 rounded-xl p-5 cursor-pointer hover:border-primary hover:bg-[#F0F4FF] transition-colors group"
          @click="createBasicEvent"
        >
          <div class="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mb-3">
            <i class="pi pi-calendar text-primary text-lg" />
          </div>
          <h3 class="font-semibold text-gray-900 mb-1">Invite Only</h3>
          <p class="text-xs text-gray-500 leading-relaxed">Simple single-page setup. Covers all essentials without the wizard steps.</p>
        </div>
        <div
          class="border-2 rounded-xl p-5 cursor-pointer hover:border-primary hover:bg-[#F0F4FF] transition-colors group"
          @click="createMultiSessionEvent"
        >
          <div class="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center mb-3">
            <i class="pi pi-clone text-green-700 text-lg" />
          </div>
          <h3 class="font-semibold text-gray-900 mb-1">Multi Session</h3>
          <p class="text-xs text-gray-500 leading-relaxed">Ideal for holiday programmes. Multiple sessions under one event with shared registration.</p>
        </div>
        <div
          class="border-2 rounded-xl p-5 cursor-pointer hover:border-primary hover:bg-[#F0F4FF] transition-colors group"
          @click="createAdvancedEvent"
        >
          <div class="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center mb-3">
            <i class="pi pi-list text-purple-700 text-lg" />
          </div>
          <h3 class="font-semibold text-gray-900 mb-1">Advanced Event</h3>
          <p class="text-xs text-gray-500 leading-relaxed">Full wizard with fees, forms, discounts, automation and more.</p>
        </div>
      </div>

      <div class="flex items-center gap-2 mt-5 pt-4 border-t border-gray-100">
        <Checkbox v-model="useWizard" :binary="true" inputId="use-wizard" />
        <label for="use-wizard" class="text-sm text-gray-600 cursor-pointer select-none">
          Use step-by-step wizard
        </label>
        <span class="text-xs text-gray-400 ml-1">(guides you through one section at a time)</span>
      </div>
    </Dialog>

    <!-- Demo Data Prompt -->
    <Dialog v-model:visible="showDemoPrompt" header="Welcome to FriendlyManager!" modal :closable="false" :style="{ width: '95vw', maxWidth: '460px' }">
      <div class="py-2 space-y-4">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <i class="pi pi-sparkles text-primary" />
          </div>
          <div>
            <p class="text-sm font-medium text-gray-800 mb-1">Your calendar is empty.</p>
            <p class="text-sm text-gray-500">Would you like to load some sample events and categories so you can explore the app, or start with a blank slate?</p>
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Start Fresh" severity="secondary" text :loading="installingDemo" @click="dismissDemoPrompt" />
        <Button label="Install Demo Data" icon="pi pi-download" :loading="installingDemo" @click="installDemoData" style="background:var(--brand-primary); border-color:var(--brand-primary)" />
      </template>
    </Dialog>

    <Toast />
    <ConfirmDialog />
  </div>
</template>

<script setup lang="ts">
const { orgId } = useOrg()
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'

const db = useDb()
const toast = useToast()
const confirm = useConfirm()
const route = useRoute()


const events = ref<any[]>([])
const separateSessions = ref<any[]>([])
const loading = ref(true)
const search = ref('')
const showCalSettings = useCalendarSettingsOpen()
const showEventNameModal = ref(false)
const showEventTypeModal = ref(false)
const useWizard = ref(true)
const newEventName = ref('')
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
  newEventName.value = ''
  showEventNameModal.value = true
}

function submitEventName() {
  if (!newEventName.value.trim()) return
  showEventNameModal.value = false
  showEventTypeModal.value = true
}

function createBasicEvent() {
  showEventTypeModal.value = false
  const params = new URLSearchParams()
  if (clickedDate.value) params.set('date', clickedDate.value)
  if (clickedEndDate.value) params.set('endDate', clickedEndDate.value)
  if (newEventName.value.trim()) params.set('name', newEventName.value.trim())
  if (useWizard.value) params.set('wizard', '1')
  const q = params.size ? `?${params}` : ''
  navigateTo(`/events/new-basic${q}`)
}

function createMultiSessionEvent() {
  showEventTypeModal.value = false
  const params = new URLSearchParams()
  if (clickedDate.value) params.set('date', clickedDate.value)
  if (clickedEndDate.value) params.set('endDate', clickedEndDate.value)
  if (newEventName.value.trim()) params.set('name', newEventName.value.trim())
  const q = params.size ? `?${params}` : ''
  navigateTo(`/events/new-multi${q}`)
}

function createAdvancedEvent() {
  showEventTypeModal.value = false
  const params = new URLSearchParams()
  if (clickedDate.value) params.set('date', clickedDate.value)
  if (clickedEndDate.value) params.set('endDate', clickedEndDate.value)
  if (newEventName.value.trim()) params.set('name', newEventName.value.trim())
  const q = params.size ? `?${params}` : ''
  navigateTo(useWizard.value ? `/events/new-advanced${q}` : `/events/new${q}`)
}

// Calendar settings
const calSettings = reactive({
  colorBy: 'category',
  defaultView: 'dayGridMonth',
  weekStart: 1,
  showWeekends: true,
  visibleCategoryIds: [] as string[],
  showUncategorised: true,
  visibleBookableIds: [] as string[], // empty = all venues
})

const colorByOptions = [
  { label: 'Calendar', value: 'category' },
  { label: 'Status', value: 'status' },
  { label: 'Style', value: 'style' },
]

const namedCalendars = ref<any[]>([])
const allCategories = ref<any[]>([])
const allBookables = ref<any[]>([])
const categoriesById = computed(() => Object.fromEntries(allCategories.value.map((c: any) => [c.id, c])))

const activeCalendar = computed(() => {
  const calId = route.query.calendar as string | undefined
  if (!calId) return null
  return namedCalendars.value.find(c => c.id === calId) ?? null
})

// Categories shown in the sidebar filter — scoped to active calendar if one is selected
const sidebarCategories = computed(() => {
  if (activeCalendar.value?.categoryIds?.length) {
    return allCategories.value.filter((c: any) => activeCalendar.value!.categoryIds.includes(c.id))
  }
  return allCategories.value
})

async function loadCalendars() {
  const [{ data: cals }, { data: cats }, { data: books }] = await Promise.all([
    (db.from as any)('calendars')
      .select('id, name, sort_order, calendar_categories(category_id)')
      .eq('org_id', orgId.value)
      .order('sort_order'),
    db.from('categories')
      .select('id, name, color, icon')
      .eq('org_id', orgId.value)
      .order('name'),
    (db.from as any)('bookables')
      .select('id, name, type')
      .eq('org_id', orgId.value)
      .eq('type', 'VENUE')
      .neq('status', 'ARCHIVED')
      .neq('status', 'DELETED')
      .order('name'),
  ])
  allCategories.value = cats ?? []
  allBookables.value = books ?? []
  namedCalendars.value = (cals ?? []).map((c: any) => ({
    ...c,
    categoryIds: c.calendar_categories?.map((cc: any) => cc.category_id) ?? [],
  }))
  // Apply the active calendar's categories (or all categories if none selected)
  applyActiveCalendarFilter()
}

const CAL_PREFS_KEY = 'fm_cal_prefs_v1'

function saveCalPrefs() {
  const calId = (route.query.calendar as string) ?? 'all'
  const all = JSON.parse(localStorage.getItem(CAL_PREFS_KEY) ?? '{}')
  all[calId] = {
    colorBy: calSettings.colorBy,
    defaultView: calSettings.defaultView,
    weekStart: calSettings.weekStart,
    showWeekends: calSettings.showWeekends,
    showUncategorised: calSettings.showUncategorised,
    visibleCategoryIds: [...calSettings.visibleCategoryIds],
    visibleBookableIds: [...calSettings.visibleBookableIds],
  }
  localStorage.setItem(CAL_PREFS_KEY, JSON.stringify(all))
}

function restoreCalPrefs(calId: string | undefined) {
  const key = calId ?? 'all'
  const all = JSON.parse(localStorage.getItem(CAL_PREFS_KEY) ?? '{}')
  const saved = all[key]
  if (saved) {
    calSettings.colorBy = saved.colorBy ?? 'category'
    calSettings.defaultView = saved.defaultView ?? 'dayGridMonth'
    calSettings.weekStart = saved.weekStart ?? 1
    calSettings.showWeekends = saved.showWeekends ?? true
    calSettings.showUncategorised = saved.showUncategorised ?? true
    // Restore venue filter (drop any stale IDs that no longer exist)
    if (saved.visibleBookableIds?.length) {
      calSettings.visibleBookableIds = saved.visibleBookableIds.filter((id: string) =>
        allBookables.value.some((b: any) => b.id === id),
      )
    } else {
      calSettings.visibleBookableIds = []
    }
    if (saved.visibleCategoryIds?.length) {
      // Drop any stale category IDs that no longer exist (e.g. after a DB reset).
      // If none remain valid, fall through to defaults.
      const valid = saved.visibleCategoryIds.filter((id: string) =>
        allCategories.value.some((c: any) => c.id === id),
      )
      if (valid.length) {
        calSettings.visibleCategoryIds = valid
        return true
      }
    }
  }
  return false
}

function applyActiveCalendarFilter() {
  const calId = route.query.calendar as string | undefined
  // Restore saved prefs first (covers view settings + category visibility)
  const hadSaved = restoreCalPrefs(calId)
  if (!hadSaved) {
    // First visit — default to the calendar's assigned categories
    if (calId) {
      const cal = namedCalendars.value.find(c => c.id === calId)
      if (cal?.categoryIds?.length) {
        calSettings.visibleCategoryIds = [...cal.categoryIds]
      } else {
        calSettings.visibleCategoryIds = allCategories.value.map((c: any) => c.id)
      }
    } else {
      calSettings.visibleCategoryIds = allCategories.value.map((c: any) => c.id)
    }
  }
}

// Re-apply when user clicks a different calendar in the sidebar
watch(() => route.query.calendar, applyActiveCalendarFilter)

function resetCalSettings() {
  calSettings.colorBy = 'category'
  calSettings.defaultView = 'dayGridMonth'
  calSettings.weekStart = 1
  calSettings.showWeekends = true
  calSettings.visibleCategoryIds = allCategories.value.map(c => c.id)
  calSettings.showUncategorised = true
  // Clear saved prefs for this calendar so defaults are used next time
  const calId = (route.query.calendar as string) ?? 'all'
  const all = JSON.parse(localStorage.getItem(CAL_PREFS_KEY) ?? '{}')
  delete all[calId]
  localStorage.setItem(CAL_PREFS_KEY, JSON.stringify(all))
}

async function applyCalSettings() {
  if (newCalendarName.value.trim()) {
    await createNewCalendar()
  }
  saveCalPrefs()
  showCalSettings.value = false
  // The view, weekStart, showWeekends are reactive props on BookingsCalendar,
  // so calSettings updates flow through automatically.
}

// New calendar creation / editing (inside cal settings dialog)
const newCalendarName = ref('')
const newCalendarCategoryIds = ref<string[]>([])
const creatingCalendar = ref(false)
const editingCalendarId = ref<string | null>(null)

function openCalSettings() {
  const calId = route.query.calendar as string | undefined
  if (calId) {
    const cal = namedCalendars.value.find(c => c.id === calId)
    if (cal) {
      newCalendarName.value = cal.name
      newCalendarCategoryIds.value = [...(cal.categoryIds ?? [])]
      editingCalendarId.value = cal.id
    }
  } else {
    newCalendarName.value = ''
    newCalendarCategoryIds.value = []
    editingCalendarId.value = null
  }
  showCalSettings.value = true
}

function selectCalendarForEdit(cal: any) {
  newCalendarName.value = cal.name
  newCalendarCategoryIds.value = [...(cal.categoryIds ?? [])]
  editingCalendarId.value = cal.id
}

async function createNewCalendar() {
  if (!newCalendarName.value.trim()) return
  creatingCalendar.value = true
  const name = newCalendarName.value.trim()

  if (editingCalendarId.value) {
    const { error } = await (db.from as any)('calendars').update({ name }).eq('id', editingCalendarId.value)
    if (error) {
      creatingCalendar.value = false
      toast.add({ severity: 'error', summary: 'Failed to update calendar', detail: error.message, life: 3000 })
      return
    }
    await (db.from as any)('calendar_categories').delete().eq('calendar_id', editingCalendarId.value)
    if (newCalendarCategoryIds.value.length) {
      await (db.from as any)('calendar_categories').insert(
        newCalendarCategoryIds.value.map(cid => ({ calendar_id: editingCalendarId.value, category_id: cid }))
      )
    }
    toast.add({ severity: 'success', summary: 'Calendar updated', life: 2000 })
  } else {
    const { data, error } = await (db.from as any)('calendars').insert({
      org_id: orgId.value,
      name,
    }).select('id').single()
    if (error) {
      creatingCalendar.value = false
      toast.add({ severity: 'error', summary: 'Failed to create calendar', detail: error.message, life: 3000 })
      return
    }
    if (data && newCalendarCategoryIds.value.length) {
      await (db.from as any)('calendar_categories').insert(
        newCalendarCategoryIds.value.map(cid => ({ calendar_id: (data as any).id, category_id: cid }))
      )
    }
    toast.add({ severity: 'success', summary: `Calendar "${name}" created`, life: 2000 })
  }

  creatingCalendar.value = false
  newCalendarName.value = ''
  newCalendarCategoryIds.value = []
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
      const { error } = await (db.from as any)('calendars').delete().eq('id', editingCalendarId.value!)
      if (error) {
        toast.add({ severity: 'error', summary: 'Failed to delete calendar', detail: error.message, life: 3000 })
        return
      }
      toast.add({ severity: 'success', summary: 'Calendar deleted', life: 2000 })
      showCalSettings.value = false
      newCalendarName.value = ''
      newCalendarCategoryIds.value = []
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

const calViews = [
  { label: 'Day',   value: 'timeGridDay' },
  { label: 'Week',  value: 'timeGridWeek' },
  { label: 'Month', value: 'dayGridMonth' },
  { label: 'List',  value: 'listWeek' },
]

// Map FullCalendar view names → BookingsCalendar's view set
const VIEW_MAP: Record<string, 'day' | 'week' | 'month' | 'list'> = {
  timeGridDay: 'day',
  timeGridWeek: 'week',
  dayGridMonth: 'month',
  listWeek: 'list',
}

const calDate = ref(new Date())
// On a phone the month/week grids are unusable — force the agenda (list) view.
const isNarrow = ref(false)
function updateNarrow() { if (import.meta.client) isNarrow.value = window.innerWidth < 768 }
onMounted(updateNarrow)
if (import.meta.client) {
  window.addEventListener('resize', updateNarrow)
  onBeforeUnmount(() => window.removeEventListener('resize', updateNarrow))
}
const bookingsCalView = computed<'day' | 'week' | 'month' | 'list'>(() =>
  VIEW_MAP[calSettings.defaultView] ?? 'month',
)
// Mobile shows a purpose-built upcoming-events list instead of the calendar grid.
const mobileEventsList = computed(() => {
  const start = new Date(); start.setHours(0, 0, 0, 0)
  return (bookingsCalEvents.value as any[])
    .filter(e => e.start_at && new Date(e.start_at) >= start)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
})
function evDow(iso: any) { return new Date(iso).toLocaleDateString(undefined, { weekday: 'short' }) }
function evWhen(iso: any) { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' · ' + new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) }

// Map our events into the shape BookingsCalendar expects
const bookingsCalEvents = computed(() => {
  return (calendarEvents.value as any[]).map((e: any) => ({
    id: e.id,
    start_at: e.start,
    end_at: e.end,
    is_all_day: e.allDay ?? false,
    status: 'CONFIRMED',
    notes: e.title,
    color: e.backgroundColor,
    event: { id: e.extendedProps?.id, title: e.title },
    contact_name: null,
    activity_mode: null,
    extendedProps: e.extendedProps,
  }))
})

function onCalendarEventClick(item: any) {
  const ext = item.extendedProps
  if (ext?._isSession) {
    navigateTo(`/events/${ext._eventId}?tab=sessions`)
  } else if (ext?.id) {
    navigateTo(`/events/${ext.id}`)
  }
}

function onCalendarSlotClick(date: Date, endDate?: Date) {
  // Format as YYYY-MM-DD using local components (no timezone shift).
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const startStr = fmt(date)
  const endStr = endDate ? fmt(endDate) : undefined
  openEventTypeModal(startStr, endStr && endStr !== startStr ? endStr : undefined)
}

// ── Drag-and-drop event move ───────────────────────────────
const dropDialog = reactive({
  open: false,
  scope: 'this' as 'this' | 'following' | 'all',
  pending: null as null | { eventRow: any; newStart: Date; newEnd: Date; conflicts: string[] },
})

async function detectConflicts(targetEventId: string, parentId: string | null, newStart: Date) {
  if (!parentId) return []
  const dayKey = newStart.toISOString().slice(0, 10)
  const { data: siblings } = await db.from('events')
    .select('id, title, start_at')
    .or(`id.eq.${parentId},recurrence_parent_id.eq.${parentId}`)
    .neq('id', targetEventId)
  return (siblings ?? [])
    .filter((s: any) => s.start_at?.slice(0, 10) === dayKey)
    .map((s: any) => s.title || 'Untitled')
}

async function onCalendarEventDrop(item: any, newStart: Date, newEnd: Date) {
  const ext = item.extendedProps
  if (ext?._isSession) {
    toast.add({ severity: 'warn', summary: 'Sessions cannot be moved here', detail: 'Open the event to edit individual sessions.', life: 4000 })
    return
  }
  const eventId = ext?.id ?? item.id
  if (!eventId) return

  const { data: eventRow } = await db.from('events').select('id, title, start_at, end_at, recurrence_parent_id').eq('id', eventId).single()
  if (!eventRow) return

  const parentId = eventRow.recurrence_parent_id ?? eventId
  const conflicts = await detectConflicts(eventId, eventRow.recurrence_parent_id ? parentId : null, newStart)

  // Check if this event is part of a series (has parent OR has children)
  const { count: childCount } = await (db.from as any)('events')
    .select('id', { count: 'exact', head: true })
    .eq('recurrence_parent_id', eventId)
  const inSeries = !!eventRow.recurrence_parent_id || (childCount ?? 0) > 0

  if (inSeries) {
    dropDialog.scope = 'this'
    dropDialog.pending = { eventRow, newStart, newEnd, conflicts }
    dropDialog.open = true
  } else {
    if (conflicts.length) {
      toast.add({ severity: 'warn', summary: 'Conflict', detail: `Already an event on this date: ${conflicts.join(', ')}`, life: 5000 })
    }
    await applyDateMove(eventRow, newStart, newEnd)
  }
}

async function applyDateMove(eventRow: any, newStart: Date, newEnd: Date) {
  await db.from('events').update({
    start_at: newStart.toISOString(),
    end_at: newEnd.toISOString(),
  }).eq('id', eventRow.id)
  await load()
}

async function performDropMove() {
  if (!dropDialog.pending) return
  const { eventRow, newStart, newEnd, conflicts } = dropDialog.pending
  const oldStart = new Date(eventRow.start_at)
  const oldEnd = new Date(eventRow.end_at ?? eventRow.start_at)
  const dayDelta = Math.round((newStart.getTime() - oldStart.getTime()) / 86_400_000)
  const parentId = eventRow.recurrence_parent_id ?? eventRow.id

  if (dropDialog.scope === 'this') {
    if (conflicts.length) {
      toast.add({ severity: 'warn', summary: 'Conflict', detail: `Already an event on this date: ${conflicts.join(', ')}`, life: 5000 })
    }
    await applyDateMove(eventRow, newStart, newEnd)
  } else {
    // Get all related events (the parent + every child)
    const { data: family } = await db.from('events')
      .select('id, start_at, end_at')
      .or(`id.eq.${parentId},recurrence_parent_id.eq.${parentId}`)
    const targets = (family ?? []).filter((e: any) => {
      if (dropDialog.scope === 'all') return true
      // 'following' = events at or after the dragged event's original start
      return e.start_at >= eventRow.start_at
    })
    for (const t of targets) {
      const ts = new Date(t.start_at); ts.setDate(ts.getDate() + dayDelta)
      const te = new Date(t.end_at ?? t.start_at); te.setDate(te.getDate() + dayDelta)
      await db.from('events').update({
        start_at: ts.toISOString(),
        end_at: te.toISOString(),
      }).eq('id', t.id)
    }
  }

  dropDialog.open = false
  dropDialog.pending = null
  await load()
  toast.add({ severity: 'success', summary: 'Event moved', life: 2500 })
}

function updateCalendarTitle() {
  const v = bookingsCalView.value
  if (v === 'day') {
    calendarTitle.value = calDate.value.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  } else if (v === 'week') {
    const monday = new Date(calDate.value); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
    calendarTitle.value = `${monday.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} – ${sunday.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`
  } else {
    calendarTitle.value = calDate.value.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
  }
}
watch([calDate, bookingsCalView], updateCalendarTitle, { immediate: true })

function setCalView(view: string) {
  calSettings.defaultView = view
  saveCalPrefs()
}

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

// Hover handler for BookingsCalendar event bars/blocks
function onCalendarEventHover(item: any, ev: MouseEvent) {
  if (tooltipTimer) clearTimeout(tooltipTimer)
  const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect()
  let x = rect.right + 10
  let y = rect.top
  if (x + 290 > window.innerWidth) x = rect.left - 300
  if (y + 280 > window.innerHeight) y = window.innerHeight - 290
  tooltip.event = item.extendedProps ?? item
  tooltip.x = x
  tooltip.y = y
  tooltipTimer = setTimeout(() => { tooltip.visible = true }, 200)
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
    // Empty selection = show everything (same as the venue filter).
    if (!calSettings.visibleCategoryIds.length) return true
    if (categoryId) return calSettings.visibleCategoryIds.includes(categoryId)
    return calSettings.showUncategorised
  }

  const venueFilter = (e: any) => {
    if (!calSettings.visibleBookableIds.length) return true
    const ids: string[] = []
    if (e.bookable_id) ids.push(e.bookable_id)
    for (const loc of e.locations ?? []) {
      if (loc?.bookable_ids?.length) ids.push(...loc.bookable_ids)
    }
    return ids.some((id: string) => calSettings.visibleBookableIds.includes(id))
  }

  const q = search.value.trim().toLowerCase()

  const eventItems = events.value
    .filter(e => categoryFilter(e.category_id))
    .filter(venueFilter)
    .map(e => {
      const matches = !q || e.title.toLowerCase().includes(q)
      return {
        id: e.id,
        title: e.title,
        start: e.start_at ?? new Date().toISOString(),
        end: e.end_at ?? undefined,
        allDay: e.is_all_day ?? false,
        backgroundColor: eventColor(e),
        borderColor: 'transparent',
        textColor: '#ffffff',
        classNames: q && !matches ? ['fc-event-dimmed'] : [],
        extendedProps: e,
      }
    })

  const sessionItems = separateSessions.value
    .filter(s => categoryFilter(s.event?.category_id ?? null))
    .map(s => {
      const categoryColor = categoriesById.value[s.event?.category_id]?.color ?? '#1E2157'
      const category = categoriesById.value[s.event?.category_id] ?? null
      const matches = !q || (s.title || '').toLowerCase().includes(q) || (s.event?.title || '').toLowerCase().includes(q)
      return {
        id: `session-${s.id}`,
        title: s.title || 'Untitled Session',
        start: s.start_at ?? new Date().toISOString(),
        end: s.end_at ?? undefined,
        allDay: s.is_all_day ?? false,
        backgroundColor: categoryColor,
        borderColor: 'transparent',
        textColor: '#ffffff',
        classNames: q && !matches ? ['fc-event-dimmed'] : [],
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
  plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
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
      navigateTo(`/events/${props._eventId}?tab=sessions&sessionId=${props.id}`)
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
  const v = bookingsCalView.value
  const d = new Date(calDate.value)
  if (v === 'day') d.setDate(d.getDate() - 1)
  else if (v === 'week') d.setDate(d.getDate() - 7)
  else d.setMonth(d.getMonth() - 1)
  calDate.value = d
}
function next() {
  const v = bookingsCalView.value
  const d = new Date(calDate.value)
  if (v === 'day') d.setDate(d.getDate() + 1)
  else if (v === 'week') d.setDate(d.getDate() + 7)
  else d.setMonth(d.getMonth() + 1)
  calDate.value = d
}
function goToday() {
  calDate.value = new Date()
}

let wheelTimer: ReturnType<typeof setTimeout> | null = null
let wheelAccum = 0
function handleCalendarWheel(e: WheelEvent) {
  const api = calendarRef.value?.getApi()
  if (!api) return
  const view = api.view.type
  if (view !== 'dayGridMonth') return
  wheelAccum += e.deltaY
  if (wheelTimer) clearTimeout(wheelTimer)
  wheelTimer = setTimeout(() => {
    if (Math.abs(wheelAccum) >= 50) {
      if (wheelAccum > 0) api.incrementDate({ weeks: 1 })
      else api.incrementDate({ weeks: -1 })
    }
    wheelAccum = 0
    wheelTimer = null
  }, 50)
}

const filtered = computed(() => events.value.filter(e =>
  e.title.toLowerCase().includes(search.value.toLowerCase())
))

async function load() {
  loading.value = true
  const [{ data, error }, { data: sessionData, error: sessionError }] = await Promise.all([
    db.from('events')
      .select('*, category:categories!category_id(id, name, color, icon)')
      .eq('org_id', orgId.value)
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
    return ev && ev.status !== 'ARCHIVED' && ev.org_id === orgId.value
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

// ---- Demo data prompt ----
const DEMO_PROMPTED_KEY = 'fm_demo_data_prompted_v1'
const showDemoPrompt = ref(false)
const installingDemo = ref(false)

function dismissDemoPrompt() {
  localStorage.setItem(DEMO_PROMPTED_KEY, '1')
  showDemoPrompt.value = false
}

async function installDemoData() {
  installingDemo.value = true
  try {
    const now = new Date()
    const addDays = (n: number) => {
      const d = new Date(now); d.setDate(d.getDate() + n); return d
    }
    const iso = (d: Date, h: number, m = 0) => {
      const x = new Date(d); x.setHours(h, m, 0, 0); return x.toISOString()
    }

    // Categories
    const { data: cats } = await db.from('categories').insert([
      { org_id: orgId.value, name: 'Swim Training', color: '#3B82F6' },
      { org_id: orgId.value, name: 'Competitions', color: '#8B5CF6' },
      { org_id: orgId.value, name: 'Social Events', color: '#10B981' },
    ]).select('id, name')

    const catByName = Object.fromEntries((cats ?? []).map((c: any) => [c.name, c.id]))

    // Events
    await db.from('events').insert([
      {
        org_id: orgId.value, style: 'BASIC', status: 'PUBLISHED',
        title: 'Swim Squad Training',
        category_id: catByName['Swim Training'],
        start_at: iso(addDays(2), 7), end_at: iso(addDays(2), 8),
        is_all_day: false,
      },
      {
        org_id: orgId.value, style: 'BASIC', status: 'PUBLISHED',
        title: 'Junior Development Training',
        category_id: catByName['Swim Training'],
        start_at: iso(addDays(5), 16), end_at: iso(addDays(5), 17, 30),
        is_all_day: false,
      },
      {
        org_id: orgId.value, style: 'BASIC', status: 'PUBLISHED',
        title: 'Regional Championships',
        category_id: catByName['Competitions'],
        start_at: iso(addDays(14), 8), end_at: iso(addDays(15), 17),
        is_all_day: false,
      },
      {
        org_id: orgId.value, style: 'BASIC', status: 'DRAFT',
        title: 'End of Season Dinner',
        category_id: catByName['Social Events'],
        start_at: iso(addDays(21), 18, 30), end_at: iso(addDays(21), 22),
        is_all_day: false,
      },
    ])

    await Promise.all([load(), loadCalendars()])
    localStorage.setItem(DEMO_PROMPTED_KEY, '1')
    showDemoPrompt.value = false
    toast.add({ severity: 'success', summary: 'Demo data installed', detail: '4 sample events and 3 categories added.', life: 4000 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Could not install demo data', detail: e?.message, life: 4000 })
  } finally {
    installingDemo.value = false
  }
}

// Set initial calendar title
onMounted(async () => {
  await Promise.all([load(), loadCalendars()])
  calendarTitle.value = new Date().toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })

  // Show demo data prompt only if no events and not previously dismissed
  if (events.value.length === 0 && !localStorage.getItem(DEMO_PROMPTED_KEY)) {
    showDemoPrompt.value = true
  }
})
</script>

<style>
.fc .fc-toolbar { display: none; }
.fc .fc-daygrid-day-top { padding: 6px 8px; }
.fc .fc-daygrid-day-number { font-size: 12px; color: #374151; font-weight: 500; }
.fc .fc-col-header-cell-cushion { font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; padding: 8px 0; }
.fc .fc-daygrid-event { border-radius: 4px; padding: 1px 6px; font-size: 12px; font-weight: 500; margin: 1px 4px; }
.fc .fc-day-today .fc-daygrid-day-frame { background: #f0f4ff; }
.fc .fc-day-today .fc-daygrid-day-number { color: var(--brand-primary); font-weight: 700; }
.fc-theme-standard td, .fc-theme-standard th { border-color: #e5e7eb; }
.fc-theme-standard .fc-scrollgrid { border-color: transparent; }
.fc .fc-event-dimmed { opacity: 0.15; transition: opacity 0.15s; }
.fc .fc-event-dimmed:hover { opacity: 0.5; }
</style>
