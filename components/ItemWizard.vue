<template>
  <Dialog :visible="visible" @update:visible="$emit('update:visible', $event)"
    modal :show-header="false" :dismissable-mask="!creating"
    :style="{ width: 'min(940px, 95vw)' }"
    :content-style="{ padding: 0 }"
    :pt="{ root: { class: 'item-wizard-dialog' } }">
    <div class="flex flex-col sm:flex-row min-h-[680px]">

      <!-- LEFT: preset list -->
      <aside class="w-full sm:w-60 shrink-0 border-r border-gray-100 bg-gray-50/40 sm:py-5 py-3">
        <div class="px-5 pt-1 pb-4">
          <p class="text-base font-bold text-gray-900 leading-tight">Set up an item</p>
          <p class="text-xs text-gray-400 mt-0.5 leading-snug">
            One step — units, rates, and how members hire it.
          </p>
        </div>
        <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-5 pb-2">Item</p>
        <div class="px-2">
          <button v-for="p in PRESETS" :key="p.type" type="button"
            class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors"
            :class="selectedType === p.type
              ? 'bg-white text-primary ring-1 ring-primary/15 shadow-sm'
              : 'text-gray-700 hover:bg-white/70'"
            @click="selectPreset(p.type)">
            <span class="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0 transition-colors"
              :class="selectedType === p.type ? 'bg-primary/8' : 'bg-white ring-1 ring-gray-100'">
              <span>{{ p.icon }}</span>
            </span>
            <span class="text-sm font-medium tracking-tight">{{ p.name }}</span>
          </button>
        </div>
      </aside>

      <!-- RIGHT: workbench -->
      <main class="flex-1 flex flex-col min-w-0">
        <header class="px-7 pt-7 pb-4 border-b border-gray-100 flex items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="text-[11px] font-semibold text-primary uppercase tracking-[0.18em]">Item setup</p>
            <h2 class="text-xl font-bold text-gray-900 mt-1 tracking-tight">{{ preset.name }}</h2>
            <p class="text-sm text-gray-500 mt-0.5">{{ preset.description }}</p>
          </div>
          <button type="button" aria-label="Close" :disabled="creating"
            class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0 disabled:opacity-40"
            @click="$emit('update:visible', false)">
            <i class="pi pi-times text-xs" />
          </button>
        </header>

        <div class="flex-1 px-7 py-5 overflow-y-auto space-y-7">

          <!-- ── Section 1: name ── -->
          <section>
            <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.14em] mb-2">1 · {{ count > 1 ? 'Group name' : 'Item name' }}</p>
            <input v-model="itemName" type="text"
              class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-shadow" />
            <p class="text-[11px] text-gray-400 mt-1">
              <span v-if="count > 1">Top-level bookable that owns the {{ baseName.toLowerCase() }}s — e.g. "Locker Room", "Bike Fleet".</span>
              <span v-else>The bookable row members will see — e.g. "Projector", "Meeting Room A".</span>
            </p>
          </section>

          <!-- ── Section 2: count + base name ── -->
          <section>
            <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.14em] mb-2">2 · How many?</p>
            <div class="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-4">
              <div>
                <label class="text-xs font-semibold text-gray-600 mb-1.5 block">{{ preset.noun }}s</label>
                <InputNumber v-model="count" :min="1" :max="200" show-buttons button-layout="horizontal"
                  decrement-button-class="!h-9 !w-9" increment-button-class="!h-9 !w-9"
                  input-class="!h-9 !w-12 !text-center !text-sm !font-semibold" class="w-full" />
              </div>
              <div v-if="count > 1">
                <label class="text-xs font-semibold text-gray-600 mb-1.5 block">Base name <span class="text-gray-300 font-normal">— suffixed 1, 2, 3 …</span></label>
                <input v-model="baseName" type="text"
                  class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-shadow" />
              </div>
            </div>
            <p class="text-[11px] text-gray-400 mt-1">
              <span v-if="count > 1">{{ count }} child bookables get created — each is a real rentable unit.</span>
              <span v-else>Single unit — system always assigns it on booking.</span>
            </p>
          </section>

          <!-- ── Section 3: who picks (only with multiple units) ── -->
          <section v-if="count > 1">
            <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.14em] mb-2">3 · Who picks the {{ preset.noun.toLowerCase() }}?</p>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button v-for="opt in ASSIGNMENT_OPTIONS" :key="opt.value" type="button"
                class="text-left px-3 py-2.5 rounded-xl border-2 transition-all"
                :class="assignmentMode === opt.value
                  ? 'border-primary bg-primary/[0.04]'
                  : 'border-gray-100 hover:border-gray-200 bg-white'"
                @click="assignmentMode = opt.value">
                <p class="text-sm font-semibold text-gray-800">{{ opt.label }}</p>
                <p class="text-[11px] text-gray-500 mt-0.5 leading-snug">{{ opt.description }}</p>
              </button>
            </div>
          </section>

          <!-- ── Section 4: rates ── -->
          <section>
            <div class="flex items-baseline justify-between mb-2">
              <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.14em]">{{ count > 1 ? 4 : 3 }} · Rates</p>
              <button type="button" class="text-xs font-medium text-primary hover:text-[#2a2f6e] flex items-center gap-1"
                @click="addRate">
                <i class="pi pi-plus text-[10px]" /> Add rate
              </button>
            </div>
            <p class="text-xs text-gray-500 mb-3">Each rate is a way for members to hire this {{ preset.noun.toLowerCase() }}. They pick one at booking time.</p>

            <div v-if="!rates.length" class="text-xs text-gray-400 py-4 text-center border border-dashed border-gray-200 rounded-lg">
              No rates yet — add at least one.
            </div>
            <div v-else class="space-y-2">
              <div v-for="(r, i) in rates" :key="r.id"
                class="border border-gray-200 rounded-xl bg-white px-4 py-3">
                <div class="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-end">
                  <!-- Name -->
                  <div>
                    <label class="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Name</label>
                    <input v-model="r.name" type="text"
                      class="w-full h-8 px-2 text-sm border border-gray-200 rounded-md outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
                  </div>
                  <!-- Period -->
                  <div class="flex items-end gap-1">
                    <div>
                      <label class="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Every</label>
                      <InputNumber v-model="r.period_count" :min="1" :max="12"
                        input-class="!h-8 !w-12 !text-center !text-sm" class="w-12" />
                    </div>
                    <div>
                      <label class="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Unit</label>
                      <Select v-model="r.period_unit" :options="UNIT_OPTIONS" option-label="label" option-value="value"
                        size="small" class="w-24" />
                    </div>
                  </div>
                  <!-- Term -->
                  <div>
                    <label class="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Term</label>
                    <Select v-model="r.term_type" :options="TERM_OPTIONS" option-label="label" option-value="value"
                      size="small" class="w-32" />
                  </div>
                  <!-- Price -->
                  <div>
                    <label class="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Price</label>
                    <div class="flex items-center gap-1">
                      <span class="text-sm text-gray-400">$</span>
                      <InputNumber v-model="r.period_price" :min="0" :max-fraction-digits="2"
                        input-class="!h-8 !w-20 !text-right !text-sm" class="w-20" />
                    </div>
                  </div>
                  <!-- Remove -->
                  <button type="button"
                    class="w-8 h-8 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center"
                    @click="removeRate(i)" aria-label="Remove rate">
                    <i class="pi pi-times text-xs" />
                  </button>
                </div>
                <p v-if="r.term_type === 'recurring'" class="text-[11px] text-emerald-600 mt-1.5">
                  Rolling — auto-renews every {{ formatPeriod(r) }} until cancelled.
                </p>
              </div>
            </div>
          </section>

          <!-- ── Section 5: activity name ── -->
          <section>
            <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.14em] mb-2">{{ count > 1 ? 5 : 4 }} · Activity name</p>
            <input v-model="activityName" type="text"
              class="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-shadow" />
            <p class="text-[11px] text-gray-400 mt-1">Shown to members on the booking page — e.g. "Projector hire", "Locker rental".</p>
          </section>

          <!-- ── Summary ── -->
          <section class="rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
            <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.14em] mb-2">Plan</p>
            <ul class="text-sm space-y-1.5">
              <li v-if="count === 1" class="flex items-start gap-2">
                <i class="pi pi-check-circle text-emerald-500 text-xs mt-0.5" />
                <span>Single bookable <span class="font-semibold text-gray-900">"{{ itemName || preset.name }}"</span></span>
              </li>
              <template v-else>
                <li class="flex items-start gap-2">
                  <i class="pi pi-check-circle text-emerald-500 text-xs mt-0.5" />
                  <span>Parent <span class="font-semibold text-gray-900">"{{ itemName || preset.name }}"</span> with <span class="font-semibold text-gray-900">{{ count }} {{ baseName.toLowerCase() }}s</span> nested</span>
                </li>
                <li class="flex items-start gap-2">
                  <i class="pi pi-check-circle text-emerald-500 text-xs mt-0.5" />
                  <span>{{ assignmentSummary }}</span>
                </li>
              </template>
              <li v-if="rates.length" class="flex items-start gap-2">
                <i class="pi pi-check-circle text-emerald-500 text-xs mt-0.5" />
                <span><span class="font-semibold text-gray-900">{{ rates.length }}</span> rate{{ rates.length === 1 ? '' : 's' }}: {{ rateSummary }}</span>
              </li>
              <li class="flex items-start gap-2">
                <i class="pi pi-check-circle text-emerald-500 text-xs mt-0.5" />
                <span>Activity <span class="font-semibold text-gray-900">"{{ activityName || preset.name }}"</span> with <code class="text-[11px] px-1 py-0.5 rounded bg-white border border-gray-200">booking_flow=item</code></span>
              </li>
              <li v-if="!rates.length" class="flex items-start gap-2 text-amber-700">
                <i class="pi pi-exclamation-circle text-amber-500 text-xs mt-0.5" />
                <span>Add at least one rate.</span>
              </li>
            </ul>
          </section>
        </div>

        <footer class="border-t border-gray-100 bg-gray-50/40 px-7 py-3.5 flex items-center justify-between gap-3">
          <button type="button" class="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors px-2 py-1.5"
            :disabled="creating" @click="$emit('update:visible', false)">Cancel</button>
          <button type="button"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm transition-all"
            :class="canCreate
              ? 'bg-primary hover:bg-[#161A45] hover:shadow-md'
              : 'bg-gray-300 cursor-not-allowed'"
            :disabled="!canCreate || creating"
            @click="create">
            <i v-if="creating" class="pi pi-spin pi-spinner text-[11px]" />
            <span>{{ creating ? 'Creating…' : 'Create everything' }}</span>
            <i v-if="!creating" class="pi pi-arrow-right text-[11px]" />
          </button>
        </footer>
      </main>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
defineProps<{ visible: boolean }>()
const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'done', payload: { activityId: string; bookableIds: string[] }): void
}>()

const db = useDb()
const { orgId } = useOrg()
const toast = useToast()

// ── Catalogue ─────────────────────────────────────────────────────────────
type Unit = 'hour' | 'day' | 'week' | 'month' | 'year'
type Term = 'fixed' | 'recurring'
interface DraftRate { id: string; name: string; period_unit: Unit; period_count: number; term_type: Term; period_price: number }
interface ItemPreset {
  type: string
  name: string
  icon: string
  noun: string
  description: string
  defaultName: string
  defaultBaseName: string
  defaultActivityName: string
  defaultCount: number
  defaultAssignment: 'system' | 'member' | 'either'
  defaultRates: Omit<DraftRate, 'id'>[]
}

const PRESETS: ItemPreset[] = [
  {
    type: 'projector', name: 'Projector', icon: '📽️', noun: 'Projector',
    description: 'AV equipment members hire by the hour or day.',
    defaultName: 'Projector', defaultBaseName: 'Projector', defaultActivityName: 'Projector hire',
    defaultCount: 1, defaultAssignment: 'system',
    defaultRates: [
      { name: 'Hourly', period_unit: 'hour', period_count: 1, term_type: 'fixed', period_price: 10 },
      { name: 'Daily',  period_unit: 'day',  period_count: 1, term_type: 'fixed', period_price: 40 },
    ],
  },
  {
    type: 'locker', name: 'Lockers', icon: '🔒', noun: 'Locker',
    description: 'Storage members rent for weeks or months at a time.',
    defaultName: 'Locker Room', defaultBaseName: 'Locker', defaultActivityName: 'Locker rental',
    defaultCount: 10, defaultAssignment: 'either',
    defaultRates: [
      { name: 'Weekly',    period_unit: 'week',  period_count: 1, term_type: 'recurring', period_price: 10 },
      { name: '6-Monthly', period_unit: 'month', period_count: 6, term_type: 'fixed',     period_price: 100 },
    ],
  },
  {
    type: 'room', name: 'Meeting room', icon: '🏢', noun: 'Room',
    description: 'A bookable space — typically by the hour.',
    defaultName: 'Meeting Room', defaultBaseName: 'Room', defaultActivityName: 'Meeting room booking',
    defaultCount: 1, defaultAssignment: 'system',
    defaultRates: [
      { name: 'Hourly',  period_unit: 'hour', period_count: 1, term_type: 'fixed', period_price: 25 },
      { name: 'Half-day', period_unit: 'hour', period_count: 4, term_type: 'fixed', period_price: 80 },
    ],
  },
  {
    type: 'bike', name: 'Bike fleet', icon: '🚲', noun: 'Bike',
    description: 'Hire bikes from a fleet — system or member picks one.',
    defaultName: 'Bike Fleet', defaultBaseName: 'Bike', defaultActivityName: 'Bike hire',
    defaultCount: 5, defaultAssignment: 'either',
    defaultRates: [
      { name: 'Hourly', period_unit: 'hour', period_count: 1, term_type: 'fixed', period_price: 8 },
      { name: 'Daily',  period_unit: 'day',  period_count: 1, term_type: 'fixed', period_price: 30 },
    ],
  },
  {
    type: 'kit', name: 'Equipment kit', icon: '🎒', noun: 'Kit',
    description: 'Bag of gear (rackets, balls, helmets) hired as a set.',
    defaultName: 'Equipment', defaultBaseName: 'Kit', defaultActivityName: 'Equipment hire',
    defaultCount: 4, defaultAssignment: 'system',
    defaultRates: [
      { name: 'Per session', period_unit: 'hour', period_count: 2, term_type: 'fixed', period_price: 5 },
      { name: 'Daily',       period_unit: 'day',  period_count: 1, term_type: 'fixed', period_price: 15 },
    ],
  },
  {
    type: 'custom', name: 'Custom', icon: '✨', noun: 'Item',
    description: 'Anything else — start blank and configure.',
    defaultName: 'Item', defaultBaseName: 'Item', defaultActivityName: 'Item hire',
    defaultCount: 1, defaultAssignment: 'either',
    defaultRates: [
      { name: 'Hourly', period_unit: 'hour', period_count: 1, term_type: 'fixed', period_price: 0 },
    ],
  },
]

const UNIT_OPTIONS: { label: string; value: Unit }[] = [
  { label: 'Hour',  value: 'hour' },
  { label: 'Day',   value: 'day' },
  { label: 'Week',  value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'Year',  value: 'year' },
]
const TERM_OPTIONS: { label: string; value: Term }[] = [
  { label: 'One-off',    value: 'fixed' },
  { label: 'Auto-renew', value: 'recurring' },
]
const ASSIGNMENT_OPTIONS: { label: string; description: string; value: 'system' | 'member' | 'either' }[] = [
  { label: 'System',      description: 'Auto-assigns the first free unit.',    value: 'system' },
  { label: 'Member picks', description: 'Members pick a specific unit.',        value: 'member' },
  { label: 'Either',      description: 'Show "Assign me one" + the unit list.', value: 'either' },
]

// ── Local state ───────────────────────────────────────────────────────────
const selectedType = ref<string>('projector')
const preset = computed(() => PRESETS.find(p => p.type === selectedType.value) ?? PRESETS[0])
const itemName = ref(PRESETS[0].defaultName)
const baseName = ref(PRESETS[0].defaultBaseName)
const activityName = ref(PRESETS[0].defaultActivityName)
const count = ref(PRESETS[0].defaultCount)
const assignmentMode = ref<'system' | 'member' | 'either'>(PRESETS[0].defaultAssignment)
const rates = ref<DraftRate[]>(PRESETS[0].defaultRates.map(r => ({ ...r, id: cryptoId() })))
const creating = ref(false)

function cryptoId() {
  return Math.random().toString(36).slice(2, 10)
}
function selectPreset(t: string) {
  selectedType.value = t
  const p = PRESETS.find(x => x.type === t)
  if (!p) return
  itemName.value = p.defaultName
  baseName.value = p.defaultBaseName
  activityName.value = p.defaultActivityName
  count.value = p.defaultCount
  assignmentMode.value = p.defaultAssignment
  rates.value = p.defaultRates.map(r => ({ ...r, id: cryptoId() }))
}
function addRate() {
  rates.value.push({ id: cryptoId(), name: 'New rate', period_unit: 'day', period_count: 1, term_type: 'fixed', period_price: 0 })
}
function removeRate(i: number) {
  rates.value.splice(i, 1)
}

function formatPeriod(r: DraftRate): string {
  const unit = r.period_unit
  if (r.period_count === 1) return unit
  return `${r.period_count} ${unit}s`
}

const assignmentSummary = computed(() => {
  switch (assignmentMode.value) {
    case 'system': return 'System auto-assigns the first available unit'
    case 'member': return 'Members pick a specific unit'
    case 'either': return 'Members can pick a specific unit OR ask for any available'
  }
  return ''
})

const rateSummary = computed(() => rates.value.map(r => `${r.name} $${r.period_price}/${formatPeriod(r)}${r.term_type === 'recurring' ? ' (rolling)' : ''}`).join(' · '))

const canCreate = computed(() =>
  rates.value.length > 0 &&
  count.value >= 1 &&
  !!itemName.value.trim() &&
  !!activityName.value.trim() &&
  rates.value.every(r => r.name.trim() && r.period_price >= 0 && r.period_count >= 1),
)

// ── Apply ─────────────────────────────────────────────────────────────────
async function create() {
  if (!canCreate.value || !orgId.value) return
  creating.value = true
  try {
    // 1) Activity row.
    const { data: act, error: actErr } = await (db.from as any)('activities').insert({
      org_id: orgId.value,
      name: activityName.value.trim(),
      status: 'ACTIVE',
      bookings_enabled: true,
      booking_flow: 'item',
      require_mode: true,
      assignment_mode: count.value > 1 ? assignmentMode.value : 'system',
      area_name_singular: preset.value.noun,
      area_name_plural: `${preset.value.noun}s`,
      color: '#1E2157',
      icon: preset.value.type === 'projector' ? 'pi-video'
        : preset.value.type === 'locker' ? 'pi-lock'
        : preset.value.type === 'room' ? 'pi-building'
        : preset.value.type === 'bike' ? 'pi-car'
        : preset.value.type === 'kit' ? 'pi-briefcase'
        : 'pi-box',
    }).select('id').single()
    if (actErr || !act?.id) throw actErr ?? new Error('Could not create activity')
    const activityId = act.id as string

    // 2) Bookables. Single-unit setups get one row; multi-unit setups get
    //    a parent + N children so each child is an addressable rentable
    //    row that ItemBooker can pick.
    const bookableIds: string[] = []
    if (count.value === 1) {
      const { data: bk, error: bkErr } = await (db.from as any)('bookables').insert({
        org_id: orgId.value,
        name: itemName.value.trim(),
        type: 'ITEM',
        status: 'ACTIVE',
        max_concurrent: 1,
        is_public: true,
      }).select('id').single()
      if (bkErr || !bk?.id) throw bkErr ?? new Error('Could not create bookable')
      bookableIds.push(bk.id)
      await (db.from as any)('activity_bookables').insert({ activity_id: activityId, bookable_id: bk.id })
    } else {
      const { data: parent, error: pErr } = await (db.from as any)('bookables').insert({
        org_id: orgId.value,
        name: itemName.value.trim(),
        type: 'VENUE',
        status: 'ACTIVE',
        max_concurrent: count.value,
        is_public: true,
        allow_sub_venues: true,
      }).select('id').single()
      if (pErr || !parent?.id) throw pErr ?? new Error('Could not create parent bookable')
      bookableIds.push(parent.id)
      const childRows = Array.from({ length: count.value }, (_, i) => ({
        org_id: orgId.value,
        name: `${baseName.value.trim()} ${i + 1}`,
        type: 'ITEM',
        parent_id: parent.id,
        status: 'ACTIVE',
        max_concurrent: 1,
        is_public: true,
      }))
      const { data: kids, error: kErr } = await (db.from as any)('bookables').insert(childRows).select('id')
      if (kErr) throw kErr
      for (const k of kids ?? []) bookableIds.push(k.id)
      await (db.from as any)('activity_bookables').insert({ activity_id: activityId, bookable_id: parent.id })
    }

    // 3) Modes.
    const modeRows = rates.value.map((r, i) => ({
      activity_id: activityId,
      name: r.name.trim(),
      period_unit: r.period_unit,
      period_count: r.period_count,
      term_type: r.term_type,
      period_price: r.period_price,
      sort_order: i,
    }))
    const { error: mErr } = await (db.from as any)('activity_modes').insert(modeRows)
    if (mErr) throw mErr

    toast.add({
      severity: 'success',
      summary: 'Item set up',
      detail: `${count.value} ${preset.value.noun.toLowerCase()}${count.value === 1 ? '' : 's'} + ${rates.value.length} rate${rates.value.length === 1 ? '' : 's'} ready.`,
      life: 4000,
    })
    emit('done', { activityId, bookableIds })
    emit('update:visible', false)
  } catch (e: any) {
    toast.add({
      severity: 'error',
      summary: 'Setup failed',
      detail: e?.message ?? 'Unknown error — partial state may have been written.',
      life: 6000,
    })
  } finally {
    creating.value = false
  }
}
</script>
