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
                  class="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shadow shrink-0">
                  {{ initials(child.name) }}
                </div>
              </div>
              <span class="shrink-0 text-[11px] font-semibold text-gray-700 text-center leading-tight max-w-full truncate px-1 mt-1">
                {{ child.name }}
              </span>
            </NuxtLink>
          </div>

          <!-- Slot cells + availability rules + bookings -->
          <div class="relative select-none">
            <div v-for="slot in timeSlots" :key="slot.minutes"
              :style="`height:${slotHeight}px`"
              :class="[
                'border-b cursor-pointer transition-colors',
                slot.minutes % 60 === 0 ? 'border-gray-200' : 'border-gray-100',
                isDragging && dragChildId === child.id && isSlotSelected(slot.minutes)
                  ? 'bg-primary/10'
                  : 'hover:bg-gray-50'
              ]"
              @mousedown="startDrag(child, slot.minutes)"
              @mouseover="extendDrag(slot.minutes)"
              @mouseup="commitDrag(child)" />

            <!-- Availability slots from the bookable's rules — clickable cards
                 that emit new-booking with the exact slot range. Selected
                 slots get a strong indigo highlight so the user can see the
                 booking they're building. Lower z-index than bookings so a
                 confirmed booking still renders on top. -->
            <div v-for="(slot, i) in slotsForChild(child.id)" :key="`${child.id}-rule-${i}`"
              class="absolute left-1 right-1 rounded-md border-2 cursor-pointer transition-colors z-0 select-none"
              :class="isSlotPicked(child, slot)
                ? 'bg-primary border-primary shadow-md ring-2 ring-primary/40 ring-offset-1'
                : slot.ruleType === 'CLOSED'
                  ? 'bg-red-50 border-red-200 hover:bg-red-100/70'
                  : slot.ruleType === 'RESTRICTED'
                    ? 'bg-blue-50 border-blue-200 hover:bg-blue-100/70'
                    : 'bg-green-50 border-green-200 hover:bg-green-100/80'"
              :style="slotStyle(slot)"
              @mousedown.stop.prevent="startSlotDrag(child, slot)"
              @mouseenter="extendSlotDrag(child, slot)">
              <p class="px-1.5 pt-1 text-[10px] font-semibold leading-tight flex items-center gap-1"
                :class="isSlotPicked(child, slot)
                  ? 'text-white'
                  : slot.ruleType === 'CLOSED' ? 'text-red-600' : slot.ruleType === 'RESTRICTED' ? 'text-blue-600' : 'text-green-700'">
                <i v-if="isSlotPicked(child, slot)" class="pi pi-check text-[9px]" />
                <span>{{ slot.from }}–{{ slot.to }}</span>
              </p>
            </div>

            <template v-for="booking in bookingsForChild(child.id)" :key="`${child.id}-${booking.id}`">
              <div
                class="absolute left-1 right-1 rounded-md px-2 py-1 overflow-hidden cursor-pointer transition-opacity hover:opacity-90 shadow-sm z-10"
                :class="[
                  statusClass(booking.status),
                  booking.status === 'PENDING' ? 'booking-pending ring-1 ring-amber-300/70' : '',
                  booking._fromParent ? 'opacity-60 ring-1 ring-white/40 striped-parent' : '',
                ]"
                :style="bookingStyle(booking)"
                @click.stop="$emit('booking-click', booking)">
                <p class="text-[11px] font-semibold leading-tight truncate flex items-center gap-1">
                  <i v-if="booking._fromParent" class="pi pi-lock text-[9px] shrink-0" />
                  <i v-else-if="booking.status === 'PENDING'" class="pi pi-clock text-[9px] shrink-0 booking-pending-icon" />
                  <span class="truncate">{{ booking._fromParent ? 'Whole venue' : bookingLabel(booking) }}</span>
                </p>
                <p class="text-[10px] opacity-80 leading-tight truncate">{{ bookingTimeRange(booking) }}</p>
              </div>
            </template>
          </div>
        </div>

      </div>

      <!-- Loading overlay -->
      <div v-if="loading" class="absolute inset-0 bg-white/60 flex items-center justify-center z-30">
        <i class="pi pi-spin pi-spinner text-2xl text-primary" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  children: any[]
  date: Date
  // Optional: restrict displayed rules to those whose activity_mode_ids
  // overlap with this list (used by the BookingScheduler so the user sees
  // slots applicable to the activity they're booking, before they pick a mode).
  activityModeIds?: string[]
  // Set of `${bookableId}|${startISO}|${endISO}` keys for slots the parent
  // (BookingScheduler) has marked as selected. Drives the visual highlight.
  selectedSlotKeys?: Set<string>
}>()

const emit = defineEmits<{
  'booking-click': [booking: any]
  // Click on an availability slot — parent toggles it in/out of the selection.
  'new-booking': [child: any, start: Date, end: Date]
  // Drag entered a new slot (mouse held down). Parent adds it idempotently
  // — never removes — so dragging back over a slot won't unselect it.
  'add-slot': [child: any, start: Date, end: Date]
  // Fired once after rules first load if `props.date` has no applicable
  // slots and a future date (within 14 days) does. Parent decides whether
  // to apply it — typically only on initial mount, before the user has
  // manually navigated.
  'suggest-date': [date: Date]
  // List of dates within the lookahead window that have no applicable
  // slots — wired to the parent's DatePicker `:disabled-dates` so users
  // can't pick days the courts are closed. Empty array = nothing disabled
  // (e.g. when there are no rules at all and we don't know the schedule).
  'disabled-dates': [dates: Date[]]
}>()

const db = useDb()

// Default fallback window when no rules + no bookings exist for the day —
// keeps the grid from collapsing to nothing on a blank schedule.
const FALLBACK_START_HOUR = 9
const FALLBACK_END_HOUR   = 17

const SLOT_MINS      = 30
const slotHeight     = 28
const headerHeight   = 80
const timeGutterWidth = 52
const colMinWidth    = 140

// Earliest rule slot start / latest rule slot end across all visible
// children + any bookings on the day, rounded outward to the hour. The
// grid crops to this window so empty hours don't take up vertical space.
const visibleHours = computed(() => {
  let minMin = Infinity
  let maxMin = -Infinity
  for (const child of props.children) {
    for (const slot of slotsForChild(child.id)) {
      const from = timeToMins(slot.from)
      const to   = timeToMins(slot.to)
      if (from < minMin) minMin = from
      if (to   > maxMin) maxMin = to
    }
  }
  // Existing bookings outside the rule window must still be visible.
  for (const b of bookings.value) {
    const s = new Date(b.start_at)
    const e = new Date(b.end_at)
    const sm = s.getHours() * 60 + s.getMinutes()
    const em = e.getHours() * 60 + e.getMinutes()
    if (sm < minMin) minMin = sm
    if (em > maxMin) maxMin = em
  }
  if (!isFinite(minMin) || !isFinite(maxMin)) {
    return { startHour: FALLBACK_START_HOUR, endHour: FALLBACK_END_HOUR }
  }
  const startHour = Math.max(0,  Math.floor(minMin / 60))
  let   endHour   = Math.min(24, Math.ceil(maxMin  / 60))
  if (endHour <= startHour) endHour = startHour + 1
  return { startHour, endHour }
})
const dayStartHour = computed(() => visibleHours.value.startHour)
const dayEndHour   = computed(() => visibleHours.value.endHour)

const timeSlots = computed(() => {
  const slots = []
  for (let m = dayStartHour.value * 60; m < dayEndHour.value * 60; m += SLOT_MINS) {
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
  // Child's own bookings + any parent-level bookings. Parent bookings render
  // in every child column to make the "blocked across the venue" state
  // visible. We tag them with _fromParent so the template can style them
  // differently (semi-transparent + "Whole venue" label).
  return bookings.value
    .filter(b => b.bookable_id === childId || parentBookableIds.value.has(b.bookable_id))
    .map(b => parentBookableIds.value.has(b.bookable_id) ? { ...b, _fromParent: true } : b)
}

function minutesFromDayStart(iso: string) {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes() - dayStartHour.value * 60
}

function bookingStyle(booking: any) {
  const startMins    = Math.max(minutesFromDayStart(booking.start_at), 0)
  const endMins      = Math.min(minutesFromDayStart(booking.end_at), (dayEndHour.value - dayStartHour.value) * 60)
  const durationMins = Math.max(endMins - startMins, SLOT_MINS)
  const top    = (startMins / SLOT_MINS) * slotHeight
  const height = (durationMins / SLOT_MINS) * slotHeight - 2
  return { top: `${top}px`, height: `${height}px` }
}

function statusClass(status: string) {
  if (status === 'CONFIRMED') return 'bg-primary text-white'
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
  // Include the shared parent so parent-level bookings (e.g. someone booked
  // the entire field) render as blocked across every child column.
  const parentIds = Array.from(new Set(props.children.map((c: any) => c.parent_id).filter(Boolean) as string[]))
  parentBookableIds.value = new Set(parentIds)
  const { data } = await db.from('bookings')
    .select('*, event:events(id, title)')
    .in('bookable_id', [...childIds, ...parentIds])
    .gte('start_at', dayStart.toISOString())
    .lte('start_at', dayEnd.toISOString())
    .order('start_at')
  bookings.value = data ?? []
  loading.value = false
}

// Bookings made on a parent venue block every child during that slot — the
// SubVenueScheduler renders them in each child column with a distinct style.
const parentBookableIds = ref<Set<string>>(new Set())

// ── Availability rules per child ────────────────────────────────────────────
const rules = ref<any[]>([])
async function loadRules() {
  if (!props.children.length) { rules.value = []; return }
  // A linked child (master_id set) inherits its master's rules. Load the
  // union of child ids + their masters so slotsForChild can resolve either.
  const childIds = props.children.map((c: any) => c.id)
  const masterIds = props.children
    .map((c: any) => c.master_id)
    .filter((id: string | null | undefined): id is string => !!id)
  const ids = Array.from(new Set([...childIds, ...masterIds]))
  const { data } = await (db.from as any)('availability_rules')
    .select('id, bookable_id, name, rule_type, days_of_week, time_slots, time_from, time_to, activity_mode_ids, is_active, color, valid_from, valid_until, rrule')
    .in('bookable_id', ids)
    .eq('is_active', true)
  rules.value = data ?? []
}

// Does any visible child have an applicable rule with at least one slot on
// `date`? Used by the initial-seek logic — when today has nothing, the
// parent jumps the date forward to the next day that does.
function hasAnySlotsOnDate(date: Date): boolean {
  for (const child of props.children) {
    const sourceId = child.master_id ?? child.id
    for (const r of rules.value) {
      if (r.bookable_id !== sourceId) continue
      if (!ruleAppliesOnDate(r, date)) continue
      const slots = r.time_slots?.length
        ? r.time_slots.filter((s: any) => s?.from && s?.to)
        : (r.time_from ? [{ from: r.time_from, to: r.time_to }] : [])
      if (slots.length) return true
    }
  }
  return false
}

// One-shot seek: after the first non-empty rule load, if today has no
// applicable slots, look forward up to 14 days for the next date that does
// and emit it back to the parent. Runs once per component lifetime.
let initialSeekDone = false
watch(rules, () => {
  // Refresh the disabled-dates set every time rules change so the
  // parent's DatePicker stays in sync.
  emit('disabled-dates', computeDisabledDates())

  if (initialSeekDone || !rules.value.length) return
  initialSeekDone = true
  if (hasAnySlotsOnDate(props.date)) return
  for (let d = 1; d <= 14; d++) {
    const candidate = new Date(props.date)
    candidate.setHours(0, 0, 0, 0)
    candidate.setDate(candidate.getDate() + d)
    if (hasAnySlotsOnDate(candidate)) {
      emit('suggest-date', candidate)
      return
    }
  }
})

// Build the list of dates within the next 90 days that have NO applicable
// slots. Skipped (returns []) when rules are empty — we don't know the
// schedule yet, so don't constrain the picker.
const DISABLE_LOOKAHEAD_DAYS = 90
function computeDisabledDates(): Date[] {
  if (!rules.value.length) return []
  const out: Date[] = []
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  for (let d = 0; d < DISABLE_LOOKAHEAD_DAYS; d++) {
    const candidate = new Date(start)
    candidate.setDate(candidate.getDate() + d)
    if (!hasAnySlotsOnDate(candidate)) out.push(candidate)
  }
  return out
}

function timeToMins(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function ruleAppliesOnDate(rule: any, date: Date): boolean {
  if (rule.valid_from) {
    const from = new Date(rule.valid_from); from.setHours(0, 0, 0, 0)
    if (date < from) return false
  }
  if (rule.valid_until) {
    const until = new Date(rule.valid_until); until.setHours(23, 59, 59, 999)
    if (date > until) return false
  }
  const dow = (date.getDay() + 6) % 7
  if (!rule.days_of_week?.includes(dow)) return false
  return true
}

interface DisplaySlot { from: string; to: string; ruleType: string; color: string }

function slotsForChild(childId: string): DisplaySlot[] {
  const out: DisplaySlot[] = []
  // Linked children (master_id set) display their master's rules — same model
  // as pages/bookables/[id].vue's propagation logic. Otherwise fall back to
  // the child's own rules.
  const child = props.children.find((c: any) => c.id === childId)
  const sourceId = child?.master_id ?? childId
  for (const r of rules.value) {
    if (r.bookable_id !== sourceId) continue
    if (!ruleAppliesOnDate(r, props.date)) continue
    // Mode scope: when caller passed activityModeIds, the rule must overlap;
    // an empty rule scope ([]) means "applies to any mode".
    if (r.activity_mode_ids?.length && (props.activityModeIds?.length ?? 0) > 0) {
      if (!r.activity_mode_ids.some((id: string) => props.activityModeIds!.includes(id))) continue
    }
    const slots = r.time_slots?.length
      ? r.time_slots.filter((s: any) => s?.from && s?.to)
      : (r.time_from
          ? [{ from: r.time_from.slice(0, 5), to: (r.time_to ?? '23:00').slice(0, 5) }]
          : [])
    for (const s of slots) {
      out.push({
        from: s.from.slice(0, 5),
        to:   s.to.slice(0, 5),
        ruleType: r.rule_type ?? 'OPEN',
        color: r.color ?? '#22C55E',
      })
    }
  }
  return out
}

function slotStyle(slot: DisplaySlot) {
  // SLOT_MINS-based vertical positioning matching the timeSlots grid.
  const dayStart = dayStartHour.value * 60
  const top    = ((timeToMins(slot.from) - dayStart) / SLOT_MINS) * slotHeight
  const height = Math.max(((timeToMins(slot.to) - timeToMins(slot.from)) / SLOT_MINS) * slotHeight, slotHeight)
  return { top: `${top}px`, height: `${height}px` }
}

function buildSlotDates(slot: DisplaySlot): { start: Date; end: Date } {
  const start = new Date(props.date); start.setHours(...timeParts(slot.from), 0, 0)
  const end   = new Date(props.date); end.setHours(...timeParts(slot.to),   0, 0)
  return { start, end }
}
function timeParts(t: string): [number, number] {
  const [h, m] = t.split(':').map(Number)
  return [h, m]
}

// True when this exact (child, slot) tuple is in the parent's selection set.
function isSlotPicked(child: any, slot: DisplaySlot): boolean {
  if (!props.selectedSlotKeys?.size) return false
  const { start, end } = buildSlotDates(slot)
  return props.selectedSlotKeys.has(`${child.id}|${start.toISOString()}|${end.toISOString()}`)
}

// ── Click + drag to multi-select ────────────────────────────────────────────
// Mousedown toggles (parent decides add/remove). While the mouse is held,
// hovering over other slots emits `add-slot` so the parent only ever adds —
// dragging back over an already-selected slot won't toggle it off.
const isDragSelecting = ref(false)
function startSlotDrag(child: any, slot: DisplaySlot) {
  isDragSelecting.value = true
  const { start, end } = buildSlotDates(slot)
  emit('new-booking', child, start, end)
}
function extendSlotDrag(child: any, slot: DisplaySlot) {
  if (!isDragSelecting.value) return
  if (isSlotPicked(child, slot)) return
  const { start, end } = buildSlotDates(slot)
  emit('add-slot', child, start, end)
}
function endSlotDrag() { isDragSelecting.value = false }
onMounted(() => window.addEventListener('mouseup', endSlotDrag))
onBeforeUnmount(() => window.removeEventListener('mouseup', endSlotDrag))

watch([() => props.date, () => props.children], loadBookings, { immediate: true })
watch(() => props.children, loadRules, { immediate: true })
</script>

<style scoped>
.booking-pending {
  background-image: repeating-linear-gradient(
    45deg,
    transparent 0,
    transparent 6px,
    rgba(255, 255, 255, 0.22) 6px,
    rgba(255, 255, 255, 0.22) 12px
  );
}
.booking-pending-icon {
  animation: pending-pulse 2s ease-in-out infinite;
}
@keyframes pending-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.55; }
}
</style>
