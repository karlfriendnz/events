<template>
  <div class="flex flex-col h-full">
    <!-- Scheduler grid -->
    <div class="flex-1 min-h-0 overflow-auto bg-white relative">
      <div class="flex h-full" :style="`min-width: ${timeGutterWidth + children.length * colMinWidth}px`">

        <!-- Time gutter -->
        <div :style="`width:${timeGutterWidth}px`" class="shrink-0 sticky left-0 z-20 bg-white border-r border-gray-200">
          <div :style="`height:${headerHeight}px`" class="sticky top-0 z-20 bg-white border-b border-gray-200" />
          <div v-for="slot in timeSlots" :key="slot.minutes"
            :style="`height:${slotHeight}px`"
            class="relative border-b border-gray-100 pr-2 flex items-start justify-end">
            <span v-if="slot.minutes % 60 === 0" class="text-[11px] text-gray-400 leading-none mt-1">
              {{ formatSlotTime(slot.minutes) }}
            </span>
          </div>
        </div>

        <!-- Sub-venue columns -->
        <div v-for="child in children" :key="child.id"
          :style="`min-width:${colMinWidth}px`"
          class="flex-1 border-r border-gray-200">

          <!-- Column header -->
          <div :style="`height:${headerHeight}px`"
            class="sticky top-0 z-10 bg-white border-b border-gray-200 overflow-hidden">
            <NuxtLink :to="`/bookables/${child.id}`"
              class="flex flex-col items-center w-full h-full hover:opacity-80 transition-opacity"
              style="padding: 10px 4px 4px">
              <div class="flex-1 min-h-0 w-full flex items-center justify-center">
                <img v-if="child.sponsor_image" :src="child.sponsor_image"
                  class="max-w-full max-h-full object-contain" />
                <img v-else-if="child.main_image" :src="child.main_image"
                  class="max-w-full max-h-full object-contain" />
                <div v-else
                  class="w-10 h-10 rounded-full bg-[#1E2157] flex items-center justify-center text-white text-xs font-bold shadow shrink-0">
                  {{ initials(child.name) }}
                </div>
              </div>
              <span class="shrink-0 text-[11px] font-semibold text-gray-700 text-center leading-tight max-w-full truncate px-1 mt-1">
                {{ child.name }}
              </span>
            </NuxtLink>
          </div>

          <!-- Slot cells + bookings -->
          <div class="relative select-none">
            <div v-for="slot in timeSlots" :key="slot.minutes"
              :style="`height:${slotHeight}px`"
              :class="[
                'border-b cursor-pointer transition-colors',
                slot.minutes % 60 === 0 ? 'border-gray-200' : 'border-gray-100',
                isDragging && dragChildId === child.id && isSlotSelected(slot.minutes)
                  ? 'bg-[#1E2157]/10'
                  : 'hover:bg-gray-50'
              ]"
              @mousedown="startDrag(child, slot.minutes)"
              @mouseover="extendDrag(slot.minutes)"
              @mouseup="commitDrag(child)" />

            <template v-for="booking in bookingsForChild(child.id)" :key="booking.id">
              <div
                class="absolute left-1 right-1 rounded-md px-2 py-1 overflow-hidden cursor-pointer transition-opacity hover:opacity-90 shadow-sm"
                :style="bookingStyle(booking)"
                :class="statusClass(booking.status)"
                @click.stop="$emit('booking-click', booking)">
                <p class="text-[11px] font-semibold leading-tight truncate">{{ bookingLabel(booking) }}</p>
                <p class="text-[10px] opacity-80 leading-tight truncate">{{ bookingTimeRange(booking) }}</p>
              </div>
            </template>
          </div>
        </div>

      </div>

      <!-- Loading overlay -->
      <div v-if="loading" class="absolute inset-0 bg-white/60 flex items-center justify-center z-30">
        <i class="pi pi-spin pi-spinner text-2xl text-[#1E2157]" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  children: any[]
  date: Date
}>()

const emit = defineEmits<{
  'booking-click': [booking: any]
  'new-booking': [child: any, start: Date, end: Date]
}>()

const db = useDb()

const DAY_START_HOUR = 6
const DAY_END_HOUR   = 23
const SLOT_MINS      = 30
const slotHeight     = 28
const headerHeight   = 80
const timeGutterWidth = 52
const colMinWidth    = 140

const timeSlots = computed(() => {
  const slots = []
  for (let m = DAY_START_HOUR * 60; m < DAY_END_HOUR * 60; m += SLOT_MINS) {
    slots.push({ minutes: m })
  }
  return slots
})

const loading  = ref(false)
const bookings = ref<any[]>([])

function formatSlotTime(minutes: number) {
  const h = Math.floor(minutes / 60)
  const ampm = h < 12 ? 'am' : 'pm'
  const h12 = h % 12 || 12
  return `${h12}${ampm}`
}

function initials(name: string) {
  return name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
}

function bookingsForChild(childId: string) {
  return bookings.value.filter(b => b.bookable_id === childId)
}

function minutesFromDayStart(iso: string) {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes() - DAY_START_HOUR * 60
}

function bookingStyle(booking: any) {
  const startMins    = Math.max(minutesFromDayStart(booking.start_at), 0)
  const endMins      = Math.min(minutesFromDayStart(booking.end_at), (DAY_END_HOUR - DAY_START_HOUR) * 60)
  const durationMins = Math.max(endMins - startMins, SLOT_MINS)
  const top    = (startMins / SLOT_MINS) * slotHeight
  const height = (durationMins / SLOT_MINS) * slotHeight - 2
  return { top: `${top}px`, height: `${height}px` }
}

function statusClass(status: string) {
  if (status === 'CONFIRMED') return 'bg-[#1E2157] text-white'
  if (status === 'PENDING')   return 'bg-amber-400 text-white'
  return 'bg-gray-200 text-gray-600'
}

function bookingLabel(booking: any) {
  return booking.notes || booking.event?.title || booking.contact_name || 'Booking'
}

function bookingTimeRange(booking: any) {
  const fmt = (iso: string) => new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${fmt(booking.start_at)} – ${fmt(booking.end_at)}`
}

// Drag-to-select
const isDragging   = ref(false)
const dragChildId  = ref<string | null>(null)
const dragStartMin = ref(0)
const dragEndMin   = ref(0)

function startDrag(child: any, minutes: number) {
  isDragging.value   = true
  dragChildId.value  = child.id
  dragStartMin.value = minutes
  dragEndMin.value   = minutes
}

function extendDrag(minutes: number) {
  if (isDragging.value) dragEndMin.value = minutes
}

function commitDrag(child: any) {
  if (!isDragging.value || dragChildId.value !== child.id) return
  isDragging.value = false
  const start = Math.min(dragStartMin.value, dragEndMin.value)
  const end   = Math.max(dragStartMin.value, dragEndMin.value) + SLOT_MINS
  const d = props.date
  const startDate = new Date(d)
  startDate.setHours(Math.floor(start / 60), start % 60, 0, 0)
  const endDate = new Date(d)
  endDate.setHours(Math.floor(end / 60), end % 60, 0, 0)
  emit('new-booking', child, startDate, endDate)
  dragChildId.value = null
}

function isSlotSelected(minutes: number) {
  const lo = Math.min(dragStartMin.value, dragEndMin.value)
  const hi = Math.max(dragStartMin.value, dragEndMin.value)
  return minutes >= lo && minutes <= hi
}

async function loadBookings() {
  if (!props.children.length) return
  loading.value = true
  const d = props.date
  const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0)
  const dayEnd   = new Date(d); dayEnd.setHours(23, 59, 59, 999)
  const childIds = props.children.map((c: any) => c.id)
  const { data } = await db.from('bookings')
    .select('*, event:events(id, title)')
    .in('bookable_id', childIds)
    .gte('start_at', dayStart.toISOString())
    .lte('start_at', dayEnd.toISOString())
    .order('start_at')
  bookings.value = data ?? []
  loading.value = false
}

watch([() => props.date, () => props.children], loadBookings, { immediate: true })
</script>
