<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <div class="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
      <button class="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700" @click="navigateTo('/bookings')">
        <i class="pi pi-arrow-left text-xs" />
        Bookings
      </button>
      <span class="text-gray-300">/</span>
      <span class="text-sm font-medium text-gray-900">New Booking</span>
    </div>

    <div class="max-w-6xl mx-auto px-6 py-8 flex gap-8">

      <!-- Main form -->
      <div class="flex-1 min-w-0">

        <!-- Step indicator -->
        <div class="flex items-center gap-0 mb-8">
          <template v-for="(s, i) in steps" :key="s.key">
            <div class="flex items-center gap-2 cursor-pointer" @click="step > i ? step = i : null">
              <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors"
                :class="step === i ? 'bg-[#1E2157] text-white' : step > i ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'">
                <i v-if="step > i" class="pi pi-check text-xs" />
                <span v-else>{{ i + 1 }}</span>
              </div>
              <span class="text-sm font-medium"
                :class="step === i ? 'text-[#1E2157]' : step > i ? 'text-green-600' : 'text-gray-400'">
                {{ s.label }}
              </span>
            </div>
            <div v-if="i < steps.length - 1" class="flex-1 h-px mx-3" :class="step > i ? 'bg-green-400' : 'bg-gray-200'" />
          </template>
        </div>

        <!-- ── STEP 0: Pick resource ── -->
        <div v-if="step === 0" class="space-y-5">
          <div>
            <h2 class="text-lg font-semibold text-gray-900">What do you want to book?</h2>
            <p class="text-sm text-gray-500 mt-1">Select a venue, item, or person.</p>
          </div>

          <!-- Search + type tabs -->
          <div class="flex items-center gap-3">
            <IconField class="flex-1">
              <InputIcon class="pi pi-search" />
              <InputText v-model="resourceSearch" placeholder="Search…" class="w-full" />
            </IconField>
            <div class="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
              <button v-for="t in resourceTabs" :key="t.value"
                class="px-4 py-2 transition-colors border-l border-gray-200 first:border-l-0 flex items-center gap-1.5"
                :class="resourceTab === t.value ? 'bg-[#1E2157] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'"
                @click="resourceTab = t.value">
                <i :class="`pi ${t.icon} text-xs`" />{{ t.label }}
              </button>
            </div>
          </div>

          <!-- Loading -->
          <div v-if="loadingBookables" class="py-12 flex justify-center">
            <i class="pi pi-spin pi-spinner text-2xl text-gray-400" />
          </div>

          <!-- Empty -->
          <div v-else-if="!filteredBookables.length" class="py-12 text-center text-gray-400">
            <i class="pi pi-building text-3xl mb-3 block" />
            <p class="text-sm">No bookables found.</p>
          </div>

          <!-- Resource cards: accordion by category (ITEM tab with categories) -->
          <div v-else-if="resourceTab === 'ITEM' && hasCategorizedItems" class="space-y-2">
            <div v-for="group in categorizedItems" :key="group.category ?? '__uncategorized__'"
              class="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <!-- Accordion header -->
              <button
                class="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                @click="toggleCategory(group.category ?? '__uncategorized__')">
                <div class="flex items-center gap-2">
                  <i class="pi pi-box text-amber-500 text-sm" />
                  <span class="text-sm font-semibold text-gray-800">
                    {{ group.category ?? 'Other' }}
                  </span>
                  <span class="text-xs text-gray-400 font-normal">({{ group.items.length }})</span>
                </div>
                <i class="pi text-gray-400 text-xs transition-transform"
                  :class="openCategories.has(group.category ?? '__uncategorized__') ? 'pi-chevron-up' : 'pi-chevron-down'" />
              </button>
              <!-- Accordion body -->
              <div v-show="openCategories.has(group.category ?? '__uncategorized__')"
                class="border-t border-gray-100 p-3">
                <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div v-for="item in group.items" :key="item.id"
                    class="bg-white rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-sm"
                    :class="booking.bookableId === item.id ? 'border-[#1E2157] shadow-sm' : 'border-gray-200 hover:border-gray-300'"
                    @click="selectBookable(item)">
                    <div class="flex items-start justify-between mb-3">
                      <div class="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                        <i class="pi pi-box text-amber-600 text-base" />
                      </div>
                      <div v-if="booking.bookableId === item.id"
                        class="w-5 h-5 rounded-full bg-[#1E2157] flex items-center justify-center">
                        <i class="pi pi-check text-white text-xs" />
                      </div>
                    </div>
                    <p class="text-sm font-semibold text-gray-900">{{ item.name }}</p>
                    <p v-if="item.location" class="text-xs text-gray-400 mt-0.5 truncate">{{ item.location }}</p>
                    <p v-if="item.parent_name" class="text-xs text-gray-400 mt-0.5">
                      <i class="pi pi-building text-xs mr-0.5" />{{ item.parent_name }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Resource cards: flat grid (non-ITEM tabs or items without categories) -->
          <div v-else class="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div v-for="item in filteredBookables" :key="item.id"
              class="bg-white rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-sm"
              :class="booking.bookableId === item.id
                ? 'border-[#1E2157] shadow-sm'
                : 'border-gray-200 hover:border-gray-300'"
              @click="selectBookable(item)">
              <div class="flex items-start justify-between mb-3">
                <div class="w-10 h-10 rounded-lg flex items-center justify-center"
                  :class="item.type === 'VENUE' ? 'bg-[#EFF6FF]' : item.type === 'ITEM' ? 'bg-amber-50' : 'bg-green-50'">
                  <i class="pi text-base"
                    :class="item.type === 'VENUE' ? 'pi-building text-[#1E2157]' : item.type === 'ITEM' ? 'pi-box text-amber-600' : 'pi-user text-green-600'" />
                </div>
                <div v-if="booking.bookableId === item.id"
                  class="w-5 h-5 rounded-full bg-[#1E2157] flex items-center justify-center">
                  <i class="pi pi-check text-white text-xs" />
                </div>
              </div>
              <p class="text-sm font-semibold text-gray-900">{{ item.name }}</p>
              <p v-if="item.location" class="text-xs text-gray-400 mt-0.5 truncate">{{ item.location }}</p>
              <p v-if="item.parent_name" class="text-xs text-gray-400 mt-0.5">
                <i class="pi pi-building text-xs mr-0.5" />{{ item.parent_name }}
              </p>
              <div class="flex items-center gap-1.5 mt-2">
                <span class="text-xs px-2 py-0.5 rounded-full font-medium"
                  :class="item.type === 'VENUE' ? 'bg-blue-50 text-blue-700' : item.type === 'ITEM' ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'">
                  {{ item.type }}
                </span>
              </div>
            </div>
          </div>

          <div class="flex justify-end pt-2">
            <Button label="Next: Choose date & time" icon="pi pi-arrow-right" icon-pos="right"
              :disabled="!booking.bookableId" @click="step = 1"
              style="background:#1E2157; border-color:#1E2157" />
          </div>
        </div>

        <!-- ── STEP 1: Date & time ── -->
        <div v-if="step === 1" class="space-y-5">
          <div>
            <h2 class="text-lg font-semibold text-gray-900">When do you need it?</h2>
            <p class="text-sm text-gray-500 mt-1">Choose the date, time, and booking type.</p>
          </div>

          <!-- Date range -->
          <div>
            <label class="text-sm font-semibold text-gray-700 block mb-2">Date <span class="text-gray-400 font-normal">(select a range for multi-day)</span></label>
            <DatePicker v-model="booking.dateRange" inline selection-mode="range" class="w-full" :min-date="new Date()" :number-of-months="2" />
          </div>

          <!-- All-day toggle (multi-day only) -->
          <div v-if="isMultiDay" class="flex items-center gap-3 px-4 py-3 bg-blue-50 rounded-lg border border-blue-100">
            <button
              class="w-10 h-6 rounded-full transition-colors shrink-0 relative"
              :class="booking.allDay ? 'bg-[#1E2157]' : 'bg-gray-300'"
              @click="booking.allDay = !booking.allDay">
              <span class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                :class="booking.allDay ? 'translate-x-4' : 'translate-x-0'" />
            </button>
            <div>
              <p class="text-sm font-medium text-gray-900">All day</p>
              <p class="text-xs text-gray-500">No specific start or end time</p>
            </div>
          </div>

          <!-- Time range -->
          <div v-if="!booking.allDay" class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-sm font-semibold text-gray-700 block mb-2">Start time</label>
              <Select v-model="booking.startTime" :options="timeSlots" option-label="label" option-value="value"
                placeholder="Select start…" class="w-full" />
            </div>
            <div>
              <label class="text-sm font-semibold text-gray-700 block mb-2">End time</label>
              <Select v-model="booking.endTime" :options="endTimeSlots" option-label="label" option-value="value"
                placeholder="Select end…" :disabled="!booking.startTime" class="w-full" />
            </div>
          </div>

          <!-- Duration display -->
          <div v-if="durationHours > 0" class="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-3">
            <i class="pi pi-clock text-gray-400" />
            Duration: <span class="font-semibold text-gray-900">{{ durationLabel }}</span>
          </div>

          <!-- Layout picker (venues only) -->
          <div v-if="booking.bookable?.layouts?.length">
            <label class="text-sm font-semibold text-gray-700 block mb-2">Layout</label>
            <div class="flex flex-wrap gap-2">
              <button v-for="layout in booking.bookable.layouts" :key="layout"
                class="px-4 py-2 rounded-lg border text-sm font-medium transition-all"
                :class="booking.layoutName === layout
                  ? 'border-[#1E2157] bg-[#EFF6FF] text-[#1E2157]'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'"
                @click="booking.layoutName = layout">
                {{ layout }}
              </button>
            </div>
          </div>

          <div class="flex justify-between pt-2">
            <Button label="Back" severity="secondary" outlined icon="pi pi-arrow-left" @click="step = 0" />
            <Button label="Next: Details" icon="pi pi-arrow-right" icon-pos="right"
              :disabled="!booking.dateRange?.[0] || (!booking.allDay && (!booking.startTime || !booking.endTime))"
              @click="step = 2" style="background:#1E2157; border-color:#1E2157" />
          </div>
        </div>

        <!-- ── STEP 2: Details ── -->
        <div v-if="step === 2" class="space-y-5">
          <div>
            <h2 class="text-lg font-semibold text-gray-900">Booking details</h2>
            <p class="text-sm text-gray-500 mt-1">Link to an event and choose any add-ons.</p>
          </div>

          <!-- Link to event -->
          <div>
            <label class="text-sm font-semibold text-gray-700 block mb-1.5">Link to event <span class="text-gray-400 font-normal">(optional)</span></label>
            <Select v-model="booking.eventId" :options="events" option-label="title" option-value="id"
              placeholder="Select an event…" filter show-clear class="w-full" />
          </div>

          <!-- Notes -->
          <div>
            <label class="text-sm font-semibold text-gray-700 block mb-1.5">Notes</label>
            <Textarea v-model="booking.notes" rows="3" placeholder="Any special requirements…" class="w-full" auto-resize />
          </div>

          <!-- Contact -->
          <div>
            <label class="text-sm font-semibold text-gray-700 block mb-2">Contact details</label>
            <div class="grid grid-cols-3 gap-3">
              <InputText v-model="booking.contactName" placeholder="Name" />
              <InputText v-model="booking.contactEmail" placeholder="Email" type="email" />
              <InputText v-model="booking.contactPhone" placeholder="Phone" />
            </div>
          </div>

          <div class="flex justify-between pt-2">
            <Button label="Back" severity="secondary" outlined icon="pi pi-arrow-left" @click="step = 1" />
            <Button label="Review booking" icon="pi pi-arrow-right" icon-pos="right"
              :disabled="false"
              @click="step = 3" style="background:#1E2157; border-color:#1E2157" />
          </div>
        </div>

        <!-- ── STEP 3: Review ── -->
        <div v-if="step === 3" class="space-y-5">
          <div>
            <h2 class="text-lg font-semibold text-gray-900">Review your booking</h2>
            <p class="text-sm text-gray-500 mt-1">Check everything looks right before confirming.</p>
          </div>

          <div class="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            <!-- Bookable -->
            <div class="flex items-center gap-4 px-5 py-4">
              <div class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                :class="booking.bookable?.type === 'VENUE' ? 'bg-[#EFF6FF]' : booking.bookable?.type === 'ITEM' ? 'bg-amber-50' : 'bg-green-50'">
                <i class="pi text-base"
                  :class="booking.bookable?.type === 'VENUE' ? 'pi-building text-[#1E2157]' : booking.bookable?.type === 'ITEM' ? 'pi-box text-amber-600' : 'pi-user text-green-600'" />
              </div>
              <div class="flex-1">
                <p class="text-xs text-gray-400 uppercase tracking-wide font-medium">Booking</p>
                <p class="text-sm font-semibold text-gray-900">{{ booking.bookable?.name }}</p>
                <p v-if="booking.bookable?.location" class="text-xs text-gray-400">{{ booking.bookable.location }}</p>
              </div>
              <button class="text-xs text-[#1E2157] underline" @click="step = 0">Change</button>
            </div>
            <!-- Date/time -->
            <div class="flex items-center gap-4 px-5 py-4">
              <div class="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                <i class="pi pi-calendar text-purple-600 text-base" />
              </div>
              <div class="flex-1">
                <p class="text-xs text-gray-400 uppercase tracking-wide font-medium">Date & time</p>
                <p class="text-sm font-semibold text-gray-900">{{ formatReviewDate }}</p>
                <p class="text-xs text-gray-400">{{ durationLabel }}</p>
              </div>
              <button class="text-xs text-[#1E2157] underline" @click="step = 1">Change</button>
            </div>
            <!-- Event link -->
            <div v-if="booking.eventId" class="flex items-center gap-4 px-5 py-4">
              <div class="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                <i class="pi pi-calendar text-gray-500 text-base" />
              </div>
              <div class="flex-1">
                <p class="text-xs text-gray-400 uppercase tracking-wide font-medium">Linked event</p>
                <p class="text-sm font-semibold text-gray-900">{{ events.find(e => e.id === booking.eventId)?.title }}</p>
              </div>
              <button class="text-xs text-[#1E2157] underline" @click="step = 2">Change</button>
            </div>
          </div>

          <div class="flex justify-between pt-2">
            <Button label="Back" severity="secondary" outlined icon="pi pi-arrow-left" @click="step = 2" />
            <Button label="Confirm booking" icon="pi pi-check" :loading="creating"
              @click="handleCreate" style="background:#1E2157; border-color:#1E2157" />
          </div>
        </div>

      </div>

      <!-- Sticky summary sidebar -->
      <div class="w-72 shrink-0">
        <div class="sticky top-8 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Booking summary</p>
          </div>
          <div class="p-4 space-y-4">
            <!-- Bookable -->
            <div>
              <p class="text-xs text-gray-400 mb-1">Resource</p>
              <div v-if="booking.bookable" class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  :class="booking.bookable.type === 'VENUE' ? 'bg-[#EFF6FF]' : booking.bookable.type === 'ITEM' ? 'bg-amber-50' : 'bg-green-50'">
                  <i class="pi text-xs"
                    :class="booking.bookable.type === 'VENUE' ? 'pi-building text-[#1E2157]' : booking.bookable.type === 'ITEM' ? 'pi-box text-amber-600' : 'pi-user text-green-600'" />
                </div>
                <div>
                  <p class="text-sm font-medium text-gray-900">{{ booking.bookable.name }}</p>
                  <p v-if="booking.bookable.location" class="text-xs text-gray-400 truncate">{{ booking.bookable.location }}</p>
                </div>
              </div>
              <p v-else class="text-sm text-gray-400 italic">Not selected</p>
            </div>
            <!-- Date/time -->
            <div>
              <p class="text-xs text-gray-400 mb-1">Date & time</p>
              <div v-if="booking.dateRange?.[0] && booking.startTime && booking.endTime">
                <p class="text-sm font-medium text-gray-900">{{ formatReviewDate }}</p>
                <p class="text-xs text-gray-400">{{ durationLabel }}</p>
              </div>
              <p v-else class="text-sm text-gray-400 italic">Not set</p>
            </div>
          </div>
        </div>
      </div>

    </div>

    <Toast />
  </div>
</template>

<script setup lang="ts">
const { orgId } = useOrg()
import { useToast } from 'primevue/usetoast'

const db = useDb()
const toast = useToast()

// ── Step state ───────────────────────────────────────────────
const step = ref(0)
const steps = [
  { key: 'resource', label: 'Resource' },
  { key: 'datetime', label: 'Date & time' },
  { key: 'details',  label: 'Details' },
  { key: 'review',   label: 'Review' },
]

// ── Booking form state ───────────────────────────────────────
const booking = reactive<any>({
  bookableId: null,
  bookable: null,
  dateRange: null as Date[] | null,
  allDay: false,
  startTime: null,
  endTime: null,
  layoutName: null,
  eventId: null,
  notes: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
})

// ── Data ─────────────────────────────────────────────────────
const bookables = ref<any[]>([])
const events = ref<any[]>([])
const loadingBookables = ref(true)
const creating = ref(false)

// ── Resource picker ──────────────────────────────────────────
const resourceSearch = ref('')
const resourceTab = ref('ALL')
const resourceTabs = [
  { label: 'All', value: 'ALL', icon: 'pi-th-large' },
  { label: 'Venues', value: 'VENUE', icon: 'pi-building' },
  { label: 'Items', value: 'ITEM', icon: 'pi-box' },
  { label: 'Persons', value: 'PERSON', icon: 'pi-user' },
]

const filteredBookables = computed(() => {
  const q = resourceSearch.value.toLowerCase()
  return bookables.value.filter(b => {
    const matchType = resourceTab.value === 'ALL' || b.type === resourceTab.value
    const matchSearch = !q || b.name.toLowerCase().includes(q) || (b.location ?? '').toLowerCase().includes(q)
    return matchType && matchSearch
  })
})

const openCategories = ref<Set<string>>(new Set())

function toggleCategory(key: string) {
  const next = new Set(openCategories.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  openCategories.value = next
}

const categorizedItems = computed(() => {
  if (resourceTab.value !== 'ITEM') return []
  const items = filteredBookables.value.filter(b => b.type === 'ITEM')
  const map = new Map<string, any[]>()
  for (const item of items) {
    const cat = item.item_category ?? ''
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(item)
  }
  // Named categories first (sorted), then uncategorized last
  const named = [...map.entries()].filter(([k]) => k !== '').sort((a, b) => a[0].localeCompare(b[0]))
  const uncategorized = map.get('') ?? []
  const result: { category: string | null; items: any[] }[] = [
    ...named.map(([cat, items]) => ({ category: cat, items })),
    ...(uncategorized.length ? [{ category: null, items: uncategorized }] : []),
  ]
  return result
})

const hasCategorizedItems = computed(() =>
  categorizedItems.value.some(g => g.category !== null)
)

watch(categorizedItems, (groups) => {
  const next = new Set(openCategories.value)
  for (const g of groups) next.add(g.category ?? '__uncategorized__')
  openCategories.value = next
}, { immediate: true })

function selectBookable(item: any) {
  booking.bookableId = item.id
  booking.bookable = item
  booking.layoutName = null
}

// ── Time slots ───────────────────────────────────────────────
const timeSlots = computed(() => {
  const slots = []
  for (let h = 6; h <= 23; h++) {
    for (const m of [0, 30]) {
      const hh = h.toString().padStart(2, '0')
      const mm = m.toString().padStart(2, '0')
      const ampm = h < 12 ? 'am' : 'pm'
      const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
      slots.push({ value: `${hh}:${mm}`, label: `${h12}:${mm}${ampm}` })
    }
  }
  return slots
})

const endTimeSlots = computed(() => {
  if (!booking.startTime) return timeSlots.value
  const startDate = booking.dateRange?.[0] ?? null
  const endDate = booking.dateRange?.[1] ?? null
  if (!endDate || !startDate || endDate.toDateString() !== startDate.toDateString()) {
    return timeSlots.value
  }
  const [sh, sm] = booking.startTime.split(':').map(Number)
  const startMins = sh * 60 + sm
  return timeSlots.value.filter(s => {
    const [eh, em] = s.value.split(':').map(Number)
    return eh * 60 + em > startMins
  })
})

const isMultiDay = computed(() => {
  const s = booking.dateRange?.[0]
  const e = booking.dateRange?.[1]
  return !!(s && e && s.toDateString() !== e.toDateString())
})

watch(isMultiDay, (val) => { if (!val) booking.allDay = false })

// ── Duration helpers ─────────────────────────────────────────
const durationHours = computed(() => {
  if (!booking.dateRange?.[0]) return 0
  const startDate = booking.dateRange[0] as Date
  const endDate = (booking.dateRange[1] as Date | null) ?? startDate
  if (booking.allDay) {
    const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
    const end   = new Date(endDate.getFullYear(),   endDate.getMonth(),   endDate.getDate() + 1)
    return (end.getTime() - start.getTime()) / 3600000
  }
  if (!booking.startTime || !booking.endTime) return 0
  const [sh, sm] = booking.startTime.split(':').map(Number)
  const [eh, em] = booking.endTime.split(':').map(Number)
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), sh, sm)
  const end   = new Date(endDate.getFullYear(),   endDate.getMonth(),   endDate.getDate(),   eh, em)
  return (end.getTime() - start.getTime()) / 3600000
})

const durationLabel = computed(() => {
  const h = durationHours.value
  if (h <= 0) return ''
  const days = Math.floor(h / 24)
  const remHours = Math.floor(h % 24)
  const mins = Math.round((h % 1) * 60)
  if (days > 0) {
    const parts = [`${days} day${days !== 1 ? 's' : ''}`]
    if (remHours) parts.push(`${remHours}h`)
    if (mins) parts.push(`${mins}min`)
    return parts.join(' ')
  }
  if (h < 1) return `${Math.round(h * 60)} min`
  const hrs = Math.floor(h)
  const m = Math.round((h - hrs) * 60)
  return m ? `${hrs}h ${m}min` : `${hrs} hour${hrs !== 1 ? 's' : ''}`
})

const formatReviewDate = computed(() => {
  if (!booking.dateRange?.[0]) return ''
  const startDate = booking.dateRange[0] as Date
  const endDate = (booking.dateRange[1] as Date | null) ?? startDate
  const fmtDate = (d: Date) => d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'long' })
  if (booking.allDay) {
    return isMultiDay.value
      ? `${fmtDate(startDate)} – ${fmtDate(endDate)} · All day`
      : `${fmtDate(startDate)} · All day`
  }
  if (!booking.startTime || !booking.endTime) return ''
  const toAmPm = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    const ampm = h < 12 ? 'am' : 'pm'
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
    return `${h12}:${m.toString().padStart(2, '0')}${ampm}`
  }
  if (isMultiDay.value) {
    return `${fmtDate(startDate)}, ${toAmPm(booking.startTime)} – ${fmtDate(endDate)}, ${toAmPm(booking.endTime)}`
  }
  return `${fmtDate(startDate)}, ${toAmPm(booking.startTime)} – ${toAmPm(booking.endTime)}`
})

// ── Data loading ─────────────────────────────────────────────
async function load() {
  loadingBookables.value = true
  const [{ data: bData }, { data: eData }] = await Promise.all([
    db.from('bookables')
      .select('id, name, type, location, is_public, layouts, item_category, parent_id, parent:bookables!parent_id(name)')
      .eq('org_id', orgId.value)
      .eq('status', 'ACTIVE')
      .order('type').order('name'),
    db.from('events').select('id, title').eq('org_id', orgId.value).order('start_at'),
  ])
  bookables.value = (bData ?? []).map((b: any) => ({ ...b, parent_name: b.parent?.name ?? null }))
  events.value = eData ?? []
  loadingBookables.value = false
}

// ── Submit ───────────────────────────────────────────────────
async function handleCreate() {
  creating.value = true
  try {
    const startDate = booking.dateRange?.[0] as Date
    const endDate = (booking.dateRange?.[1] as Date | null) ?? startDate
    let start: Date, end: Date
    if (booking.allDay) {
      start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0)
      end   = new Date(endDate.getFullYear(),   endDate.getMonth(),   endDate.getDate() + 1, 0, 0)
    } else {
      const [sh, sm] = booking.startTime.split(':').map(Number)
      const [eh, em] = booking.endTime.split(':').map(Number)
      start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), sh, sm)
      end   = new Date(endDate.getFullYear(),   endDate.getMonth(),   endDate.getDate(),   eh, em)
    }

    const { error } = await db.from('bookings').insert({
      org_id: orgId.value,
      bookable_id: booking.bookableId,
      event_id: booking.eventId || null,
      type: 'ONE_OFF',
      status: 'CONFIRMED',
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      notes: booking.notes || null,
      layout_name: booking.layoutName || null,
      is_all_day: booking.allDay,
      contact_name: booking.contactName || null,
      contact_email: booking.contactEmail || null,
      contact_phone: booking.contactPhone || null,
    })
    if (error) throw error
    toast.add({ severity: 'success', summary: 'Booking confirmed!', life: 3000 })
    await navigateTo('/bookings')
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Failed to create booking', detail: e?.message, life: 4000 })
  }
  creating.value = false
}

onMounted(async () => {
  await load()
  const route = useRoute()
  const { bookableId, date, startTime, endTime } = route.query as Record<string, string>
  if (bookableId) {
    const found = bookables.value.find(b => b.id === bookableId)
    if (found) {
      booking.bookableId = found.id
      booking.bookable = found
      step.value = 1
    }
  }
  if (date) booking.dateRange = [new Date(date), null]
  if (startTime) booking.startTime = startTime
  if (endTime) booking.endTime = endTime
  if (bookableId && date) step.value = startTime && endTime ? 2 : 1
})
</script>
