<template>
  <div class="h-full bg-[#F5F8FA]">

    <!-- ── DONE state takes over the whole pane after submit ── -->
    <div v-if="step === 2" class="h-full overflow-y-auto px-6 pb-6">
      <div class="max-w-xl mx-auto py-10 text-center">
        <div class="w-14 h-14 mx-auto rounded-full bg-green-100 flex items-center justify-center">
          <i class="pi pi-check text-green-600 text-xl" />
        </div>
        <h2 class="text-lg font-semibold text-gray-900 mt-4">Booking {{ bookedStatus === 'PENDING' ? 'received' : 'confirmed' }}</h2>
        <p class="text-sm text-gray-500 mt-1">
          {{ bookedStatus === 'PENDING'
            ? 'A staff member will confirm shortly. The contact will get an email update.'
            : 'The contact has been emailed the booking details.' }}
        </p>
        <div class="flex justify-center gap-2 mt-5">
          <Button severity="secondary" outlined label="Make another" icon="pi pi-plus" @click="resetAll" />
          <Button label="Done" @click="$emit('done')" style="background:#1E2157; border-color:#1E2157" />
        </div>
      </div>
    </div>

    <!-- ── SCHEDULE: grid on the left, booking summary panel on the right ── -->
    <div v-else class="h-full flex flex-col lg:flex-row gap-4 p-4 lg:p-6 min-h-0">

      <!-- LEFT: schedule grid -->
      <div class="flex-1 min-w-0 min-h-0 flex flex-col">
        <div v-if="loadingBookables" class="text-sm text-gray-400 py-8 text-center">Loading venue…</div>
        <div v-else-if="!venueOptions.length" class="text-sm text-gray-400 py-8 text-center">
          No bookable venues linked to this activity yet — link one in the Activities page.
        </div>
        <template v-else>
        <!-- Venue picker — parent venues as a row of cards. Cards with
             children expand to show sub-venues as smaller chips inside. -->
        <div v-if="venueGroups.length > 1 || venueGroups[0]?.children.length"
          class="mb-3 shrink-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div v-for="g in venueGroups" :key="g.parent.id"
            class="rounded-xl border-2 bg-white transition-all"
            :class="isVenueGroupActive(g) ? 'border-[#1E2157] ring-2 ring-[#1E2157]/20' : 'border-gray-100 hover:border-gray-200'">
            <!-- Parent row -->
            <button type="button" class="w-full flex items-center gap-3 px-3 py-2.5 text-left"
              :class="g.children.length ? '' : 'rounded-xl'"
              @click="onPickGroup(g)">
              <div class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden bg-[#1E2157]/10">
                <img v-if="g.parent.main_image" :src="g.parent.main_image" class="w-full h-full object-cover" />
                <i v-else class="pi pi-building text-[#1E2157] text-sm" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold text-gray-900 truncate">{{ g.parent.name }}</p>
                <p class="text-[11px] text-gray-400 truncate">
                  <template v-if="g.configName">Any {{ g.configName.toLowerCase() }} · pick from below</template>
                  <template v-else-if="g.children.length">Whole space · {{ g.children.length }} sub-{{ g.children.length === 1 ? 'venue' : 'venues' }}</template>
                  <template v-else>{{ g.parent.location || 'Single bookable space' }}</template>
                </p>
              </div>
              <i v-if="selectedVenueId === g.parent.id" class="pi pi-check text-[#1E2157] text-xs shrink-0" />
            </button>
            <!-- Children chips -->
            <div v-if="g.children.length" class="px-3 pb-3 pt-1 flex flex-wrap gap-1.5 border-t border-gray-100">
              <button v-for="c in g.children" :key="c.id" type="button"
                class="px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors"
                :class="selectedVenueId === c.id
                  ? 'bg-[#1E2157] border-[#1E2157] text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'"
                @click="selectedVenueId = c.id">
                <i v-if="selectedVenueId === c.id" class="pi pi-check text-[9px] mr-1" />{{ c.name }}
              </button>
            </div>
          </div>
        </div>

        <div class="flex flex-col sm:flex-row sm:items-center gap-3 mb-3 shrink-0">
          <div class="flex-1 min-w-0">
            <h2 class="text-base font-semibold text-gray-900 leading-tight">{{ selectedVenue?.name }}</h2>
            <p class="text-xs text-gray-400">Click an empty slot to add it</p>
          </div>
          <div class="flex items-center gap-1.5">
            <button type="button" class="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500"
              @click="navDay(-1)"><i class="pi pi-chevron-left text-xs" /></button>
            <span class="text-sm font-medium text-gray-700 min-w-32 text-center">
              {{ schedDate.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'long' }) }}
            </span>
            <button type="button" class="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500"
              @click="navDay(1)"><i class="pi pi-chevron-right text-xs" /></button>
            <button type="button" class="ml-2 px-2.5 py-1.5 text-xs font-semibold rounded border border-gray-200 hover:bg-gray-50 text-gray-700"
              @click="schedDate = new Date()">Today</button>
          </div>
        </div>

        <div class="flex-1 min-h-0 rounded-xl border border-gray-200 bg-white overflow-hidden">
          <SubVenueScheduler v-if="(selectedVenue?.children?.length ?? 0) > 0"
            class="h-full"
            :children="selectedVenue!.children!"
            :date="schedDate"
            :activity-mode-ids="modeIds"
            :selected-slot-keys="selectedSlotKeys"
            @new-booking="onSlotClick"
            @add-slot="onAddSlot"
            @booking-click="onExistingBookingClick" />
          <BookingsCalendar v-else
            class="h-full"
            :bookable-id="selectedVenueId!"
            :cal-date="schedDate"
            cal-view="day"
            :wizard-mode="true"
            :activity-mode-ids="modeIds"
            :selected-slot-keys="selectedSlotKeys"
            @slot-click="onSingleSlotClick" />
        </div>

        <!-- Sponsor strip (only shows when the active venue or its children
             have sponsor_image set). Visible on both staff and public flows. -->
        <div v-if="sponsors.length"
          class="mt-3 px-3 py-2.5 rounded-xl border border-gray-200 bg-white shrink-0">
          <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Sponsored by</p>
          <div class="flex items-center gap-3 flex-wrap">
            <img v-for="s in sponsors" :key="s.url"
              :src="s.url" :alt="s.name"
              v-tooltip.top="s.name"
              class="h-8 max-w-[120px] object-contain" />
          </div>
        </div>
        </template>
      </div>

      <!-- RIGHT: build-the-booking panel.
           On lg+: fixed-width right column (380px). On mobile: stacks below
           the grid. Empty state encourages picking a slot first. -->
      <aside class="w-full lg:w-[380px] shrink-0 bg-white border border-gray-200 rounded-xl flex flex-col min-h-0">
        <div class="px-4 py-3 border-b border-gray-100 shrink-0">
          <p class="text-sm font-bold text-gray-900">Your booking</p>
          <p class="text-xs text-gray-400">
            {{ selectedSlots.length
                ? `${selectedSlots.length} slot${selectedSlots.length === 1 ? '' : 's'} selected`
                : 'Pick a slot from the schedule to get started.' }}
          </p>
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-5 text-sm">
          <!-- Empty state -->
          <div v-if="!selectedSlots.length" class="py-10 text-center">
            <div class="w-12 h-12 mx-auto rounded-full bg-gray-50 flex items-center justify-center">
              <i class="pi pi-calendar-plus text-gray-300 text-lg" />
            </div>
            <p class="text-xs text-gray-400 mt-3">Click an available slot on the left to start your booking.</p>
          </div>

          <template v-else>
            <!-- Selected slots, removable -->
            <div class="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5 space-y-2">
              <div v-for="(s, i) in selectedSlots" :key="`${slotKey(s)}-${i}`"
                class="flex items-start gap-2">
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-semibold text-gray-800 truncate flex items-center gap-1.5">
                    <i class="pi pi-map-marker text-gray-400 text-[10px]" />{{ s.bookableName }}
                  </p>
                  <p class="text-[11px] text-gray-500 mt-0.5">{{ formatSlotDate(s.start) }} · {{ formatSlotTime(s.start) }} – {{ formatSlotTime(s.end) }}</p>
                </div>
                <button type="button" class="text-gray-300 hover:text-red-500 transition-colors shrink-0 mt-0.5"
                  @click="selectedSlots.splice(i, 1)">
                  <i class="pi pi-times text-xs" />
                </button>
              </div>
            </div>

            <!-- Mode -->
            <div>
              <label class="text-xs font-semibold text-gray-600 mb-2 block">Mode</label>
              <div v-if="!modes.length" class="text-xs text-gray-400 italic">No modes configured for this activity yet.</div>
              <div v-else class="grid grid-cols-2 gap-2">
                <button v-for="m in modes" :key="m.id" type="button"
                  class="flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all text-left"
                  :class="pendingModeId === m.id
                    ? 'border-[#1E2157] ring-1 ring-[#1E2157]/30 bg-white'
                    : 'border-gray-100 hover:border-gray-200 bg-white'"
                  @click="pendingModeId = m.id">
                  <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="`background:${m.color || '#1E2157'}`" />
                  <span class="text-sm text-gray-800">{{ m.name }}</span>
                </button>
              </div>
            </div>

            <!-- Add-ons -->
            <div v-if="hasModeAddons" class="border-t border-gray-100 pt-4">
              <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Add-ons</p>
              <div class="space-y-2">
                <button v-for="addon in modeAddons" :key="addon.id" type="button"
                  class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border-2 text-left transition-colors"
                  :class="isAddonSelected(addon.id)
                    ? 'border-[#1E2157] bg-[#1E2157]/5'
                    : 'border-gray-100 hover:border-gray-200 bg-white'"
                  @click="toggleAddon(addon.id)">
                  <div class="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors"
                    :class="isAddonSelected(addon.id) ? 'bg-[#1E2157] border-[#1E2157]' : 'border-gray-300'">
                    <i v-if="isAddonSelected(addon.id)" class="pi pi-check text-white text-[10px]" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold text-gray-800 truncate">{{ addon.name }}</p>
                    <p v-if="addon.description" class="text-xs text-gray-400 truncate">{{ addon.description }}</p>
                    <p v-else-if="addon.type === 'fee_per_person'" class="text-xs text-gray-400">${{ addonUnitAmount(addon).toFixed(2) }} per person</p>
                  </div>
                  <span class="text-sm font-semibold text-[#1E2157] tabular-nums shrink-0">
                    ${{ addonDisplayAmount(addon).toFixed(2) }}
                  </span>
                </button>
              </div>
            </div>

            <!-- Contact details -->
            <div class="border-t border-gray-100 pt-4">
              <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Contact details</p>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="text-xs font-semibold text-gray-600 mb-1 block">First Name <span class="text-red-400">*</span></label>
                  <input v-model="form.firstName" type="text" placeholder="John"
                    class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3]" />
                </div>
                <div>
                  <label class="text-xs font-semibold text-gray-600 mb-1 block">Last Name <span class="text-red-400">*</span></label>
                  <input v-model="form.lastName" type="text" placeholder="Smith"
                    class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3]" />
                </div>
                <div class="sm:col-span-2">
                  <label class="text-xs font-semibold text-gray-600 mb-1 block">Email <span class="text-red-400">*</span></label>
                  <input v-model="form.email" type="email" placeholder="you@example.com"
                    class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3]" />
                </div>
                <div>
                  <label class="text-xs font-semibold text-gray-600 mb-1 block">Phone</label>
                  <input v-model="form.phone" type="tel" placeholder="+64…"
                    class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3]" />
                </div>
                <div>
                  <label class="text-xs font-semibold text-gray-600 mb-1 block">People attending</label>
                  <InputNumber v-model="form.attendees" :min="1" class="w-full" />
                </div>
                <div class="sm:col-span-2">
                  <label class="text-xs font-semibold text-gray-600 mb-1 block">Notes</label>
                  <textarea v-model="form.notes" rows="2" placeholder="Anything we should know"
                    class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] resize-none" />
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- Sticky footer with confirm/clear -->
        <div v-if="selectedSlots.length" class="px-4 py-3 border-t border-gray-100 shrink-0 flex items-center gap-2">
          <button type="button" class="text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors"
            @click="clearSelection">Clear</button>
          <Button label="Confirm booking" icon="pi pi-check" class="ml-auto" size="small"
            :loading="submitting"
            :disabled="!canSubmitDialog"
            @click="submitFromDialog"
            style="background:#1E2157; border-color:#1E2157" />
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  activityId: string
  staff?: boolean
  /** Bookable the user already clicked on the venue page — pre-selects the
   *  matching venue option (or the parent option that owns it). */
  presetBookableId?: string | null
  /** ISO start of the slot the user clicked — opens the mode dialog. */
  presetStart?: string | null
  presetEnd?: string | null
}>()
defineEmits<{ (e: 'done'): void }>()

const db = useDb()
const route = useRoute()
const { orgId: staffOrgId } = useOrg()
// Staff path uses the user's session org; the public /book flow reads ?org=
// from the URL (same convention as BookingWizard).
const orgId = computed(() => props.staff ? staffOrgId.value : (route.query.org as string | undefined))
const toast = useToast()

// One-shot booking: pick a slot on the schedule grid → all booking inputs
// (mode + contact details) live in a single dialog → submit → done.
// step 1 = schedule, step 2 = booking-confirmed screen. (Stepper UI was
// dropped per UX feedback — kept the variable for the v-if logic only.)
const step = ref(1)

// ── Bookable + mode loading ───────────────────────────────────────────────
interface VenueOpt {
  id: string
  name: string
  parent_id: string | null
  parentName?: string | null
  location?: string | null
  type: string
  main_image?: string | null
  sponsor_image?: string | null
  children?: any[]
}

const allBookables = ref<any[]>([])
const venueOptions = ref<VenueOpt[]>([])
const modes = ref<any[]>([])
// mode_id → array of bookable_ids the mode is restricted to. Empty list means
// "no scope set" — the mode can be booked on any of the activity's linked
// bookables (and their descendants).
const modeBookableScope = ref<Record<string, string[]>>({})
// parent_bookable_id → { configKey → { name, slots } } where each slot
// lists the physical sub-venues that get booked atomically when the slot
// is picked. childIds (flat union across all slots) is also kept for the
// venue-card filter so the picker still shows the configured pool.
interface ConfigSlot { index: number; name: string; memberIds: string[] }
interface ConfigEntry { name: string; slots: ConfigSlot[]; childIds: string[] }
const configurationsByParent = ref<Record<string, Record<string, ConfigEntry>>>({})
const loadingBookables = ref(true)

async function load() {
  if (!orgId.value || !props.activityId) return
  loadingBookables.value = true
  // Activity → linked bookables
  const { data: links } = await (db.from as any)('activity_bookables')
    .select('bookable_id')
    .eq('activity_id', props.activityId)
  const linkedIds = (links ?? []).map((l: any) => l.bookable_id)

  // Pull every bookable in the org so we can resolve children of linked parents.
  const { data: all } = await (db.from as any)('bookables')
    .select('id, name, type, parent_id, location, sort_order, is_master, master_id, sponsor_image, main_image')
    .eq('org_id', orgId.value)
    .neq('status', 'DELETED')
    .neq('status', 'ARCHIVED')
    .order('sort_order')
    .order('name')
  allBookables.value = all ?? []

  const byParent: Record<string, any[]> = {}
  for (const b of allBookables.value) {
    if (b.parent_id) (byParent[b.parent_id] ??= []).push(b)
  }
  // venueOptions now keeps every linked bookable (parent + children + masters
  // + linked siblings) so the card picker can render them grouped. Picking
  // the parent uses SubVenueScheduler; picking a child uses BookingsCalendar
  // for that single resource.
  const opts: VenueOpt[] = []
  for (const id of linkedIds) {
    const b = allBookables.value.find(x => x.id === id)
    if (!b) continue
    const children = byParent[b.id] ?? []
    const parent = b.parent_id ? allBookables.value.find(x => x.id === b.parent_id) : null
    opts.push({
      id: b.id,
      name: b.name,
      parent_id: b.parent_id,
      parentName: parent?.name ?? null,
      location: b.location ?? null,
      type: b.type,
      main_image: b.main_image ?? null,
      sponsor_image: b.sponsor_image ?? null,
      children,
    })
  }
  venueOptions.value = opts

  // Auto-pick the first linked venue — the user's already on the activity, so
  // there's nothing to choose. Multi-venue activities still get all options
  // exposed via the header switcher in step 1.
  // Preset-bookable wins: if the caller already picked a slot on a specific
  // bookable, find the venue option that contains it (the bookable itself, or
  // the parent option whose children include it).
  if (!selectedVenueId.value) {
    if (props.presetBookableId) {
      const direct = opts.find(o => o.id === props.presetBookableId)
      const viaParent = opts.find(o => (o.children ?? []).some((c: any) => c.id === props.presetBookableId))
      selectedVenueId.value = (direct?.id ?? viaParent?.id ?? opts[0]?.id) ?? null
    } else if (opts.length) {
      selectedVenueId.value = opts[0].id
    }
  }

  // Activity (for the allow_multi_slot flag — controls whether the user
  // can pick multiple slots before submitting).
  const { data: act } = await (db.from as any)('activities')
    .select('allow_multi_slot')
    .eq('id', props.activityId)
    .maybeSingle()
  allowMultiSlot.value = !!act?.allow_multi_slot

  // Activity modes (incl. addons jsonb so the dialog can render them, plus
  // configuration_key for the "any half / any quarter" pool resolution).
  const { data: m } = await (db.from as any)('activity_modes')
    .select('id, name, color, sort_order, approval_mode, addons, configuration_key')
    .eq('activity_id', props.activityId)
    .order('sort_order')
    .order('name')
  modes.value = m ?? []
  // Default the active mode to the first one — otherwise venueGroups can't
  // apply the mode's scope or configuration filter, and the picker briefly
  // shows venues the mode wouldn't allow.
  if (!pendingModeId.value && modes.value.length) {
    pendingModeId.value = modes.value[0].id
  }

  // Per-mode bookable scope — empty = "any bookable on this activity".
  if (modes.value.length) {
    const { data: mb } = await (db.from as any)('activity_mode_bookables')
      .select('mode_id, bookable_id')
      .in('mode_id', modes.value.map(x => x.id))
    const map: Record<string, string[]> = {}
    for (const row of (mb ?? []) as { mode_id: string; bookable_id: string }[]) {
      ;(map[row.mode_id] ??= []).push(row.bookable_id)
    }
    modeBookableScope.value = map
  } else {
    modeBookableScope.value = {}
  }

  // Configurations — named layouts owned by parents. Modes can require a
  // configuration_key (e.g. 'halves'); the booking flow then surfaces the
  // configuration's children as a single "Any half" pool. We fetch every
  // configuration for every parent in venueOptions so the active-mode
  // computed can resolve the pool client-side without another round-trip.
  const parentIds = new Set<string>()
  for (const v of venueOptions.value) {
    parentIds.add(v.id)
    if (v.parent_id) parentIds.add(v.parent_id)
  }
  if (parentIds.size) {
    const { data: cfgs } = await (db.from as any)('bookable_configurations')
      .select('id, parent_bookable_id, key, name, sort_order')
      .in('parent_bookable_id', Array.from(parentIds))
      .order('sort_order')
    const cfgRows = (cfgs ?? []) as { id: string; parent_bookable_id: string; key: string; name: string; sort_order: number }[]
    let cfgChildren: { configuration_id: string; bookable_id: string; sort_order: number }[] = []
    if (cfgRows.length) {
      const { data: cc } = await (db.from as any)('bookable_configuration_children')
        .select('configuration_id, bookable_id, sort_order, slot_index, slot_name')
        .in('configuration_id', cfgRows.map(c => c.id))
        .order('slot_index')
        .order('sort_order')
      cfgChildren = (cc ?? []) as typeof cfgChildren
    }
    // Group children into slots per configuration.
    const slotsByConfig: Record<string, Record<number, ConfigSlot>> = {}
    for (const cc of cfgChildren) {
      const idx = (cc as any).slot_index ?? 0
      const cfg = (slotsByConfig[cc.configuration_id] ??= {})
      const slot = (cfg[idx] ??= { index: idx, name: (cc as any).slot_name ?? `Slot ${idx + 1}`, memberIds: [] })
      slot.memberIds.push(cc.bookable_id)
    }
    const map: Record<string, Record<string, ConfigEntry>> = {}
    for (const c of cfgRows) {
      const slotMap = slotsByConfig[c.id] ?? {}
      const slots = Object.values(slotMap).sort((a, b) => a.index - b.index)
      const childIds = slots.flatMap(s => s.memberIds)
      ;(map[c.parent_bookable_id] ??= {})[c.key] = { name: c.name, slots, childIds }
    }
    configurationsByParent.value = map
  } else {
    configurationsByParent.value = {}
  }

  loadingBookables.value = false

  // If the caller pre-selected an exact slot (admin clicked a slot on the
  // venue page), pre-fill the selection and jump straight to the dialog.
  if (props.presetBookableId && props.presetStart && props.presetEnd && !selectedSlots.value.length && !selectedSlot.value) {
    const bk = allBookables.value.find(b => b.id === props.presetBookableId)
    if (bk) {
      selectedSlots.value = [{
        bookableId: bk.id,
        bookableName: bk.name,
        start: new Date(props.presetStart),
        end:   new Date(props.presetEnd),
      }]
      pendingModeId.value = modes.value[0]?.id ?? null
      modeDialogOpen.value = true
    }
  }
}
// Re-run on either orgId change (auth resolves async on the staff path) or
// activityId change (parent route swaps activity). The immediate firing of
// this watch is registered at the bottom of the script so all reactive
// state declared later (pendingModeId, allowMultiSlot, selectedSlots…) is
// in scope when load() runs.
watch([() => props.activityId, orgId], load)

// ── Step 1 selection ───────────────────────────────────────────────────────
const selectedVenueId = ref<string | null>(null)

// Bookable ids the active mode allows. Empty/null = no scope, so every
// venue option is eligible. The scope can list either parents or children
// (or both) — children are surfaced under their parent in the card.
const allowedBookableIds = computed<Set<string> | null>(() => {
  if (!pendingModeId.value) return null
  const ids = modeBookableScope.value[pendingModeId.value]
  if (!ids?.length) return null
  return new Set(ids)
})

// Active mode's configuration_key (e.g. 'halves', 'quarters'). Null = no
// configuration required, so the picker shows whatever children the parent
// venue has.
const activeConfigKey = computed<string | null>(() => {
  if (!pendingModeId.value) return null
  const m = modes.value.find(x => x.id === pendingModeId.value)
  return (m?.configuration_key as string | undefined) ?? null
})

// When a configuration is active, this maps each in-scope parent to its
// slots + the flat union of child ids (for the picker filter). Parents
// without the active configuration drop out of the picker entirely.
const activeConfigByParent = computed<Record<string, { name: string; childIds: Set<string>; slots: ConfigSlot[] }>>(() => {
  const key = activeConfigKey.value
  const out: Record<string, { name: string; childIds: Set<string>; slots: ConfigSlot[] }> = {}
  if (!key) return out
  for (const [parentId, byKey] of Object.entries(configurationsByParent.value)) {
    const cfg = byKey[key]
    if (cfg && cfg.childIds.length) {
      out[parentId] = { name: cfg.name, childIds: new Set(cfg.childIds), slots: cfg.slots }
    }
  }
  return out
})

// Resolve a (parent, child) pair to the slot of the active configuration
// that contains the child. Returns null when no configuration is active or
// the child isn't part of the active config.
function resolveSlotForChild(parentId: string, childId: string): ConfigSlot | null {
  const cfg = activeConfigByParent.value[parentId]
  if (!cfg) return null
  for (const slot of cfg.slots) {
    if (slot.memberIds.includes(childId)) return slot
  }
  return null
}

// Group venueOptions by parent for the card-based picker. Top-level entries
// are either standalone bookables OR parents whose children are also linked.
// Children that have their parent in the list are tucked under the parent
// card as chips ("Whole space" parent + "Half A" / "Half B" children).
// When the active mode has a scope set, anything that doesn't match the
// allowed list is filtered out. When the active mode requires a
// configuration, only parents that have that configuration are shown, and
// the children list is narrowed to the configuration's pool.
interface VenueGroup {
  parent: VenueOpt
  children: VenueOpt[]
  /** Set when the active mode has a configuration_key — parent picking is
   *  hidden in favour of the configured pool, and the card subtitle reads
   *  "Any [configName]" rather than "Whole space". */
  configName?: string | null
}
const venueGroups = computed<VenueGroup[]>(() => {
  const linkedIds = new Set(venueOptions.value.map(v => v.id))
  const allowed = allowedBookableIds.value
  const cfgByParent = activeConfigByParent.value
  const cfgActive = activeConfigKey.value !== null
  const groups: VenueGroup[] = []
  for (const v of venueOptions.value) {
    if (v.parent_id && linkedIds.has(v.parent_id)) continue
    const childPool = (v.children ?? [])
      .filter((c: any) => linkedIds.has(c.id))
      .map((c: any) => venueOptions.value.find(o => o.id === c.id))
      .filter((c): c is VenueOpt => !!c)

    // Mode-scope filter: parent visible only if itself OR any child is allowed.
    let scopedChildren = allowed ? childPool.filter(c => allowed.has(c.id)) : childPool
    if (allowed) {
      const parentAllowed = allowed.has(v.parent_id ?? '') || allowed.has(v.id)
      if (!parentAllowed && !scopedChildren.length) continue
    }

    // Configuration filter: when active, narrow children to the configured
    // pool and skip parents that don't have this configuration. Config
    // children come straight from allBookables — they don't need to be
    // separately linked to the activity (the activity links the parent
    // court; configurations slice it).
    if (cfgActive) {
      const cfg = cfgByParent[v.id]
      if (!cfg) continue
      const cfgChildren: VenueOpt[] = []
      for (const childId of cfg.childIds) {
        const existing = scopedChildren.find(c => c.id === childId)
        if (existing) { cfgChildren.push(existing); continue }
        const raw = allBookables.value.find(b => b.id === childId)
        if (!raw) continue
        cfgChildren.push({
          id: raw.id,
          name: raw.name,
          parent_id: raw.parent_id,
          parentName: v.name,
          location: raw.location ?? null,
          type: raw.type,
          main_image: raw.main_image ?? null,
          sponsor_image: raw.sponsor_image ?? null,
          children: [],
        })
      }
      if (!cfgChildren.length) continue
      groups.push({ parent: v, children: cfgChildren, configName: cfg.name })
      continue
    }

    groups.push({ parent: v, children: scopedChildren })
  }
  return groups
})

// venueOptions only contains bookables directly linked to the activity, but
// config children may live outside that set (the activity links the parent;
// configurations slice it). Walk venueGroups too so config-only children
// resolve correctly. When the active mode requires a configuration AND the
// user has picked a parent, swap the parent's children for the configured
// pool — the SubVenueScheduler then shows availability across just the
// halves/quarters the mode actually allows.
const selectedVenue = computed<VenueOpt | null>(() => {
  const id = selectedVenueId.value
  if (!id) return null
  const groupForParent = venueGroups.value.find(g => g.parent.id === id)
  if (groupForParent) {
    if (groupForParent.configName) {
      return { ...groupForParent.parent, children: groupForParent.children }
    }
    return groupForParent.parent
  }
  const direct = venueOptions.value.find(v => v.id === id)
  if (direct) return direct
  for (const g of venueGroups.value) {
    const c = g.children.find(c => c.id === id)
    if (c) return c
  }
  return null
})

function isVenueGroupActive(g: VenueGroup): boolean {
  if (selectedVenueId.value === g.parent.id) return true
  return g.children.some(c => c.id === selectedVenueId.value)
}

// Card click target. When the active mode requires a configuration we keep
// the selection on the parent so SubVenueScheduler can render the whole
// configured pool side-by-side. Without a configuration, picking the
// parent shows the parent's full sub-venue grid as before.
function onPickGroup(g: VenueGroup) {
  selectedVenueId.value = g.parent.id
}

// When the user switches mode, the eligible venue set can shift in two
// ways: the mode's bookable scope may exclude the current pick, or the
// mode's required configuration may rule out the current parent. Either
// way, snap to the first venue that's actually selectable. We watch
// venueGroups so the selection re-validates when configurations finish
// loading (configurationsByParent populates after modes).
//
// The watch reads venueGroups synchronously to set up tracking — and
// venueGroups indirectly reads pendingModeId (declared further down). So
// we register this inside onMounted, by which time every ref exists.
function registerVenueGroupsWatcher() {
  watch(venueGroups, (groups) => {
    if (!groups.length) return
    const stillValid = groups.some(g =>
      g.parent.id === selectedVenueId.value ||
      g.children.some(c => c.id === selectedVenueId.value),
    )
    if (stillValid) return
    // Default to the parent so SubVenueScheduler shows the whole pool.
    selectedVenueId.value = groups[0].parent.id
  })
}

// ── Step 2 scheduler state ─────────────────────────────────────────────────
const schedDate = ref(new Date())
function navDay(delta: number) {
  const d = new Date(schedDate.value)
  d.setDate(d.getDate() + delta)
  schedDate.value = d
}

// (Old modal flag — kept for back-compat with submitFromDialog which closes
// nothing now but the variable is still referenced.)
const modeDialogOpen = ref(false)
const allowMultiSlot = ref(false)

interface PendingSlot {
  bookableId: string
  bookableName: string
  start: Date
  end: Date
}
// Multi-slot model: every clicked slot lives here. In single-slot mode the
// list is auto-truncated to one entry. The dialog at the bottom shows every
// entry; submit fans out one booking per slot.
const selectedSlots = ref<PendingSlot[]>([])
const pendingModeId = ref<string | null>(null)
// Convenience: the first selected slot (used when the dialog needs a single
// "active" slot for things like initial mode pick).
const pendingSlot = computed(() => selectedSlots.value[0] ?? null)

function slotKey(s: { bookableId: string; start: Date; end: Date }): string {
  return `${s.bookableId}|${s.start.toISOString()}|${s.end.toISOString()}`
}
function isSlotSelected(bookableId: string, start: Date, end: Date): boolean {
  const k = slotKey({ bookableId, start, end })
  return selectedSlots.value.some(s => slotKey(s) === k)
}
// Set of currently-selected slot keys passed to the calendar/scheduler so
// they can render a strong visual highlight on picked cells.
const selectedSlotKeys = computed<Set<string>>(() => {
  const out = new Set<string>()
  for (const s of selectedSlots.value) out.add(slotKey(s))
  return out
})

// Sponsor logos for the active venue (and any children it has). De-dup'd by
// URL so a parent + each child sharing a sponsor only renders it once.
interface SponsorLogo { url: string; name: string }
const sponsors = computed<SponsorLogo[]>(() => {
  const out = new Map<string, SponsorLogo>()
  const consider = (b: any | null | undefined) => {
    if (!b?.sponsor_image) return
    if (!out.has(b.sponsor_image)) out.set(b.sponsor_image, { url: b.sponsor_image, name: b.name })
  }
  // Active venue itself (look it up in the all-bookables list to get sponsor_image).
  if (selectedVenue.value) {
    consider(allBookables.value.find(b => b.id === selectedVenue.value!.id))
    for (const c of selectedVenue.value.children ?? []) consider(c)
  }
  return Array.from(out.values())
})
function toggleSlot(bookableId: string, bookableName: string, start: Date, end: Date) {
  const k = slotKey({ bookableId, start, end })
  const idx = selectedSlots.value.findIndex(s => slotKey(s) === k)
  if (idx >= 0) {
    selectedSlots.value.splice(idx, 1)
    return
  }
  if (!allowMultiSlot.value) {
    // Single-slot mode: replace the selection and open the confirm dialog.
    selectedSlots.value = [{ bookableId, bookableName, start, end }]
    if (!pendingModeId.value) pendingModeId.value = modes.value[0]?.id ?? null
    modeDialogOpen.value = true
    return
  }
  selectedSlots.value.push({ bookableId, bookableName, start, end })
  if (!pendingModeId.value) pendingModeId.value = modes.value[0]?.id ?? null
}
function openMultiSlotDialog() {
  if (!selectedSlots.value.length) return
  if (!pendingModeId.value) pendingModeId.value = modes.value[0]?.id ?? null
  modeDialogOpen.value = true
}
function clearSelection() {
  selectedSlots.value = []
}

// SubVenueScheduler emits (child, start, end).
function onSlotClick(child: any, start: Date, end: Date) {
  toggleSlot(child.id, child.name, start, end)
}
// Idempotent add — used during mousedown-drag so dragging back over a slot
// doesn't toggle it back off.
function onAddSlot(child: any, start: Date, end: Date) {
  if (isSlotSelected(child.id, start, end)) return
  if (!allowMultiSlot.value) return  // single-slot activities ignore drag-add
  selectedSlots.value.push({ bookableId: child.id, bookableName: child.name, start, end })
  if (!pendingModeId.value) pendingModeId.value = modes.value[0]?.id ?? null
}
// Single-resource path (BookingsCalendar emits start, end).
function onSingleSlotClick(start: Date, end?: Date) {
  if (!selectedVenue.value) return
  const e = end ?? new Date(start.getTime() + 60 * 60 * 1000)
  toggleSlot(selectedVenue.value.id, selectedVenue.value.name, start, e)
}
function onExistingBookingClick() {
  toast.add({
    severity: 'info',
    summary: 'Slot taken',
    detail: 'Pick a different time — click an empty area on the schedule.',
    life: 3000,
  })
}

const selectedMode = computed(() =>
  modes.value.find(m => m.id === pendingModeId.value) ?? null,
)
// Every mode for this activity — passed to the calendar so scoped rules show
// up before the user has picked a specific mode.
const modeIds = computed(() => modes.value.map(m => m.id))

// ── Add-ons ────────────────────────────────────────────────────────────────
const selectedAddonIds = ref<Set<string>>(new Set())
// When the user switches mode mid-dialog, drop any addon selections that
// don't belong to the new mode (otherwise they'd silently submit).
watch(pendingModeId, () => { selectedAddonIds.value = new Set() })

const modeAddons = computed<any[]>(() =>
  Array.isArray(selectedMode.value?.addons) ? selectedMode.value!.addons : [],
)
const hasModeAddons = computed(() => modeAddons.value.length > 0)

function addonUnitAmount(addon: any): number {
  return (addon?.fees ?? []).reduce((s: number, f: any) => s + (f?.amount ?? 0), 0)
}
function addonDisplayAmount(addon: any): number {
  const unit = addonUnitAmount(addon)
  if (addon?.type === 'fee_per_person') {
    const people = Math.max(1, form.attendees ?? 1)
    return unit * people
  }
  return unit
}
function isAddonSelected(addonId: string): boolean {
  return selectedAddonIds.value.has(addonId)
}
function toggleAddon(addonId: string) {
  const next = new Set(selectedAddonIds.value)
  if (next.has(addonId)) next.delete(addonId)
  else next.add(addonId)
  selectedAddonIds.value = next
}
// Resolve picked addon objects with the qty the user is actually committing
// to (per-person addons multiply by attendees), in the shape expected by
// /api/public-booking and the staff direct-insert.
const selectedAddonsPayload = computed(() => {
  const out: any[] = []
  for (const a of modeAddons.value) {
    if (!selectedAddonIds.value.has(a.id)) continue
    const qty = a.type === 'fee_per_person' ? Math.max(1, form.attendees ?? 1) : 1
    out.push({ ...a, qty })
  }
  return out
})

// Legacy single-slot reference kept for resetAll's signature; no longer set
// during submit (the loop reads from selectedSlots directly).
const selectedSlot = ref<(PendingSlot & { modeId: string | null }) | null>(null)

// Per-slot formatters used by the dialog summary rows.
function formatSlotDate(d: Date): string {
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
}
function formatSlotTime(d: Date): string {
  return d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })
}

// Validation for the all-in-one dialog: at least one slot, mode is required
// when the activity has modes, contact name+email are required.
const canSubmitDialog = computed(() => {
  if (!selectedSlots.value.length) return false
  if (modes.value.length > 0 && !pendingModeId.value) return false
  return !!form.firstName.trim() && !!form.lastName.trim() && !!form.email.trim()
})

async function submitFromDialog() {
  if (!canSubmitDialog.value) return
  modeDialogOpen.value = false
  await submit()
}

// ── Step 3 form + submit ───────────────────────────────────────────────────
const form = reactive({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  attendees: 1 as number | null,
  notes: '',
})
const canSubmit = computed(() =>
  !!form.firstName.trim() && !!form.lastName.trim() && !!form.email.trim() && selectedSlots.value.length > 0,
)
const submitting = ref(false)
const bookedStatus = ref<'CONFIRMED' | 'PENDING' | null>(null)

async function submit() {
  if (!canSubmit.value || !selectedSlots.value.length) return
  submitting.value = true
  try {
    const isPending = (selectedMode.value?.approval_mode ?? 'INSTANT') === 'REQUIRES_APPROVAL'
    const status: 'PENDING' | 'CONFIRMED' = isPending ? 'PENDING' : 'CONFIRMED'
    const contactName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim()
    const contactEmail = form.email.trim()
    const contactPhone = form.phone.trim() || null
    const notesValue = form.notes.trim() || null
    const attendeeCount = form.attendees ?? null
    const addons = selectedAddonsPayload.value

    if (props.staff) {
      // Staff path. When the active mode requires a configuration, each
      // picked slot is expanded to every member of the matching slot —
      // we insert a primary row + N children linked via parent_booking_id
      // so all the physical sub-venues get blocked atomically. Without a
      // configuration, it's still one row per picked slot like before.
      const baseFor = (s: PendingSlot) => ({
        activity_id: props.activityId,
        activity_mode_id: pendingModeId.value,
        type: 'ONE_OFF',
        status,
        start_at: s.start.toISOString(),
        end_at: s.end.toISOString(),
        contact_name: contactName,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        attendee_count: attendeeCount,
        notes: notesValue,
        selected_addons: addons,
        is_all_day: false,
      })

      const primaryIds: string[] = []
      for (const s of selectedSlots.value) {
        // Resolve members: configured slot → every sub-venue in it;
        // otherwise just the single picked bookable.
        let memberIds: string[] = [s.bookableId]
        if (activeConfigKey.value) {
          const child = allBookables.value.find(b => b.id === s.bookableId)
          const parentId = child?.parent_id
          if (parentId) {
            const slot = resolveSlotForChild(parentId, s.bookableId)
            if (slot && slot.memberIds.length) memberIds = slot.memberIds
          }
        }
        const base = baseFor(s)
        const { data: primary, error: pErr } = await (db.from as any)('bookings')
          .insert({ ...base, bookable_id: memberIds[0] })
          .select('id').single()
        if (pErr) throw pErr
        primaryIds.push(primary.id)
        if (memberIds.length > 1) {
          const childRows = memberIds.slice(1).map(bid => ({
            ...base,
            bookable_id: bid,
            parent_booking_id: primary.id,
          }))
          const { error: cErr } = await (db.from as any)('bookings').insert(childRows)
          if (cErr) throw cErr
        }
      }

      // Single notification covers the whole batch.
      const first = selectedSlots.value[0]
      const { data: notif } = await (db.from as any)('notifications').insert({
        org_id: orgId.value,
        type: isPending ? 'booking.pending' : 'booking.created',
        title: isPending ? 'Booking awaiting approval' : 'Booking created',
        body: `${form.firstName} ${form.lastName} — ${selectedSlots.value.length} slot${selectedSlots.value.length === 1 ? '' : 's'} from ${first.start.toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`,
        link: `/bookables/${first.bookableId}?tab=bookings`,
        payload: {
          contact_name: contactName,
          start_at: first.start.toISOString(),
          bookable_id: first.bookableId,
          activity_mode_id: pendingModeId.value,
          slot_count: selectedSlots.value.length,
        },
      }).select('id').single()
      if (notif?.id) {
        $fetch('/api/send-notification-email', { method: 'POST', body: { notificationId: notif.id } }).catch(() => {})
      }
      // One customer email per primary booking. Children share the same
      // contact data so a single notification per slot booking is right.
      for (const id of primaryIds) {
        $fetch('/api/send-customer-booking-email', { method: 'POST', body: { bookingId: id, event: 'created' } }).catch(() => {})
      }
    } else {
      // Public: one /api/public-booking call per slot — anon RLS path.
      for (const s of selectedSlots.value) {
        await $fetch<{ success: boolean; bookingId: string | null; status: 'PENDING' | 'CONFIRMED' }>(
          '/api/public-booking',
          {
            method: 'POST',
            body: {
              bookableId: s.bookableId,
              activityId: props.activityId,
              activityModeId: pendingModeId.value,
              startAt: s.start.toISOString(),
              endAt: s.end.toISOString(),
              contactName,
              contactEmail,
              contactPhone,
              notes: notesValue,
              attendeeCount,
              selectedAddons: addons,
            },
          },
        )
      }
    }

    bookedStatus.value = status
    step.value = 2
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Booking failed', detail: e?.data?.message ?? e?.message ?? 'Unknown error', life: 5000 })
  } finally {
    submitting.value = false
  }
}

function resetAll() {
  step.value = 1
  selectedSlot.value = null
  selectedSlots.value = []
  pendingModeId.value = null
  selectedAddonIds.value = new Set()
  bookedStatus.value = null
  form.firstName = ''; form.lastName = ''; form.email = ''
  form.phone = ''; form.attendees = 1; form.notes = ''
}

// Initial load + venueGroups watcher both run here, after every ref above
// is initialised. Registering them earlier would TDZ on pendingModeId /
// allowMultiSlot / selectedSlots since their declarations come after this
// file's computeds and watches read them.
onMounted(() => {
  registerVenueGroupsWatcher()
  load()
})
</script>
