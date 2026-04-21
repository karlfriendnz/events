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
            <label class="text-sm font-semibold text-gray-700">{{ editingCalendarId ? 'Edit Calendar' : 'New Calendar' }}</label>
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

        <!-- Categories visibility -->
        <div class="flex flex-col gap-2">
          <label class="text-sm font-semibold text-gray-700">Categories</label>
          <div v-if="!allCategories.length" class="text-xs text-gray-400 py-2">
            No categories yet.
          </div>
          <div class="flex flex-col gap-1">
            <div
              v-for="cat in allCategories"
              :key="cat.id"
              class="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer"
              @click="(() => { const idx = calSettings.visibleCategoryIds.indexOf(cat.id); idx >= 0 ? calSettings.visibleCategoryIds.splice(idx, 1) : calSettings.visibleCategoryIds.push(cat.id) })()"
            >
              <Checkbox v-model="calSettings.visibleCategoryIds" :value="cat.id" :binary="false" @click.stop />
              <span class="w-3 h-3 rounded-full shrink-0" :style="{ background: cat.color ?? '#94a3b8' }" />
              <span class="text-sm text-gray-700 flex-1">{{ cat.name }}</span>
            </div>
          </div>
          <div class="border-t border-gray-100 pt-2 mt-1">
            <div class="flex items-center gap-2 cursor-pointer" @click="calSettings.showUncategorised = !calSettings.showUncategorised">
              <Checkbox v-model="calSettings.showUncategorised" :binary="true" @click.stop />
              <span class="text-sm text-gray-600">Show uncategorised events</span>
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
    <div v-if="viewMode === 'calendar'" class="bg-white rounded-xl border border-gray-200 overflow-hidden flex-1" style="min-height:0"
      @wheel.passive="handleCalendarWheel">
      <FullCalendar ref="calendarRef" :options="calendarOptions" style="height:100%" />
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

    <!-- Event name modal (step 1) -->
    <Dialog v-model:visible="showEventNameModal" header="New event" modal style="width:420px" @keydown.enter.prevent="submitEventName">
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
          <Button label="Next" icon="pi pi-arrow-right" icon-pos="right" size="small" :disabled="!newEventName.trim()" @click="submitEventName" style="background:#1E2157;border-color:#1E2157" />
        </div>
      </div>
    </Dialog>

    <!-- Event type picker modal -->
    <Dialog v-model:visible="showEventTypeModal" header="Create new event" modal style="width:680px">
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

      <div class="grid grid-cols-3 gap-4">
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
          @click="createMultiSessionEvent"
        >
          <div class="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center mb-3">
            <i class="pi pi-clone text-green-700 text-lg" />
          </div>
          <h3 class="font-semibold text-gray-900 mb-1">Multi Session</h3>
          <p class="text-xs text-gray-500 leading-relaxed">Ideal for holiday programmes. Multiple sessions under one event with shared registration.</p>
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

    <!-- Demo Data Prompt -->
    <Dialog v-model:visible="showDemoPrompt" header="Welcome to FriendlyManager!" modal :closable="false" style="width:460px">
      <div class="py-2 space-y-4">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-full bg-[#1E2157]/10 flex items-center justify-center shrink-0 mt-0.5">
            <i class="pi pi-sparkles text-[#1E2157]" />
          </div>
          <div>
            <p class="text-sm font-medium text-gray-800 mb-1">Your calendar is empty.</p>
            <p class="text-sm text-gray-500">Would you like to load some sample events and categories so you can explore the app, or start with a blank slate?</p>
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Start Fresh" severity="secondary" text :loading="installingDemo" @click="dismissDemoPrompt" />
        <Button label="Install Demo Data" icon="pi pi-download" :loading="installingDemo" @click="installDemoData" style="background:#1E2157; border-color:#1E2157" />
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
const allCategories = ref<any[]>([])
const categoriesById = computed(() => Object.fromEntries(allCategories.value.map((c: any) => [c.id, c])))

async function loadCalendars() {
  const [{ data: cals }, { data: cats }] = await Promise.all([
    (db.from as any)('calendars')
      .select('id, name, sort_order, calendar_categories(category_id)')
      .eq('org_id', orgId.value)
      .order('sort_order'),
    db.from('categories')
      .select('id, name, color, icon')
      .eq('org_id', orgId.value)
      .order('name'),
  ])
  allCategories.value = cats ?? []
  namedCalendars.value = (cals ?? []).map((c: any) => ({
    ...c,
    categoryIds: c.calendar_categories?.map((cc: any) => cc.category_id) ?? [],
  }))
  if (calSettings.visibleCategoryIds.length === 0 && (cats ?? []).length) {
    calSettings.visibleCategoryIds = (cats ?? []).map((c: any) => c.id)
  }
}

function resetCalSettings() {
  calSettings.colorBy = 'category'
  calSettings.defaultView = 'dayGridMonth'
  calSettings.weekStart = 1
  calSettings.showWeekends = true
  calSettings.visibleCategoryIds = allCategories.value.map(c => c.id)
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
    if (allCategories.value.length === 0) return true
    if (categoryId) return calSettings.visibleCategoryIds.includes(categoryId)
    return calSettings.showUncategorised
  }

  const q = search.value.trim().toLowerCase()

  const eventItems = events.value
    .filter(e => categoryFilter(e.category_id))
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
  calendarRef.value?.getApi()?.prev()
}
function next() {
  calendarRef.value?.getApi()?.next()
}
function goToday() {
  calendarRef.value?.getApi()?.today()
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
.fc .fc-day-today .fc-daygrid-day-number { color: #1E2157; font-weight: 700; }
.fc-theme-standard td, .fc-theme-standard th { border-color: #e5e7eb; }
.fc-theme-standard .fc-scrollgrid { border-color: transparent; }
.fc .fc-event-dimmed { opacity: 0.15; transition: opacity 0.15s; }
.fc .fc-event-dimmed:hover { opacity: 0.5; }
</style>
