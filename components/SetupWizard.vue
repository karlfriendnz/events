<template>
  <Dialog :visible="visible" @update:visible="$emit('update:visible', $event)"
    modal :show-header="false" :dismissable-mask="!creating"
    :style="{ width: 'min(940px, 95vw)' }"
    :content-style="{ padding: 0 }"
    :pt="{ root: { class: 'setup-wizard-dialog' } }">
    <div class="flex flex-col sm:flex-row min-h-[620px]">

      <!-- LEFT: sport list -->
      <aside class="w-full sm:w-60 shrink-0 border-r border-gray-100 bg-gray-50/40 sm:py-5 py-3">
        <div class="px-5 pt-1 pb-4">
          <p class="text-base font-bold text-gray-900 leading-tight">Set up a sport</p>
          <p class="text-xs text-gray-400 mt-0.5 leading-snug">
            One step — venues, layouts, and what people can book.
          </p>
        </div>
        <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-5 pb-2">Sport</p>
        <div class="px-2">
          <button v-for="s in SPORTS" :key="s.type" type="button"
            class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors"
            :class="selectedType === s.type
              ? 'bg-white text-primary ring-1 ring-primary/15 shadow-sm'
              : 'text-gray-700 hover:bg-white/70'"
            @click="selectSport(s.type)">
            <span class="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0 transition-colors"
              :class="selectedType === s.type ? 'bg-primary/8' : 'bg-white ring-1 ring-gray-100'">
              <span>{{ s.icon }}</span>
            </span>
            <span class="text-sm font-medium tracking-tight">{{ s.name }}</span>
          </button>
        </div>
      </aside>

      <!-- RIGHT: workbench -->
      <main class="flex-1 flex flex-col min-w-0">
        <header class="px-7 pt-7 pb-4 border-b border-gray-100 flex items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="text-[11px] font-semibold text-primary uppercase tracking-[0.18em]">Sport setup</p>
            <h2 class="text-xl font-bold text-gray-900 mt-1 tracking-tight">{{ sport.name }}</h2>
            <p class="text-sm text-gray-500 mt-0.5">{{ sport.description }}</p>
          </div>
          <button type="button" aria-label="Close" :disabled="creating"
            class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0 disabled:opacity-40"
            @click="$emit('update:visible', false)">
            <i class="pi pi-times text-xs" />
          </button>
        </header>

        <div class="flex-1 px-7 py-5 overflow-y-auto space-y-7">

          <!-- ── Section 1: parent facility ── -->
          <section>
            <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.14em] mb-2">1 · Facility name</p>
            <input v-model="venueName" type="text"
              class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-shadow" />
            <p class="text-[11px] text-gray-400 mt-1">
              Top-level venue that owns the {{ baseName.toLowerCase() }}s — e.g. "Tennis Courts" or "Aspen Sports Centre".
            </p>
          </section>

          <!-- ── Section 2: count + base name ── -->
          <section>
            <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.14em] mb-2">2 · How many {{ baseName.toLowerCase() }}s?</p>
            <div class="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-4">
              <div>
                <label class="text-xs font-semibold text-gray-600 mb-1.5 block">{{ sport.noun }}s</label>
                <InputNumber v-model="count" :min="1" :max="50" show-buttons button-layout="horizontal"
                  decrement-button-class="!h-9 !w-9" increment-button-class="!h-9 !w-9"
                  input-class="!h-9 !w-12 !text-center !text-sm !font-semibold" class="w-full" />
              </div>
              <div>
                <label class="text-xs font-semibold text-gray-600 mb-1.5 block">Base name <span class="text-gray-300 font-normal">— suffixed 1, 2, 3 …</span></label>
                <input v-model="baseName" type="text"
                  class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-shadow" />
              </div>
            </div>
          </section>

          <!-- ── Section 3: modes ── -->
          <section>
            <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.14em] mb-2">3 · What can people book?</p>
            <p class="text-xs text-gray-500 mb-3">Pick the formats you want offered. Anything that needs a half or a quarter
              court will automatically get the right sub-venues + configurations.</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button v-for="m in sport.presetModes" :key="m.key" type="button"
                class="text-left flex items-start gap-3 px-3 py-3 rounded-xl border-2 transition-all"
                :class="pickedModeKeys.has(m.key)
                  ? 'border-primary bg-primary/[0.04]'
                  : 'border-gray-100 hover:border-gray-200 bg-white'"
                @click="toggleMode(m.key)">
                <div class="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors"
                  :class="pickedModeKeys.has(m.key) ? 'bg-primary border-primary' : 'border-gray-300'">
                  <i v-if="pickedModeKeys.has(m.key)" class="pi pi-check text-white text-[10px]" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <p class="text-sm font-semibold text-gray-800">{{ m.name }}</p>
                    <span v-if="m.requires" class="text-[10px] font-bold uppercase tracking-wide bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-1.5 py-0.5">
                      {{ requiresLabel(m.requires) }}
                    </span>
                  </div>
                  <p class="text-xs text-gray-500 mt-0.5 leading-snug">{{ m.description }}</p>
                </div>
              </button>
            </div>
          </section>

          <!-- ── Section 4: activity name ── -->
          <section>
            <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.14em] mb-2">4 · Activity name</p>
            <input v-model="activityName" type="text"
              class="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-shadow" />
            <p class="text-[11px] text-gray-400 mt-1">The activity people see when booking — e.g. "Tennis", "Tennis Hire".</p>
          </section>

          <!-- ── Section 5: operating hours + slot length ── -->
          <section>
            <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.14em] mb-2">5 · Default sessions</p>
            <p class="text-xs text-gray-500 mb-3">When can people book, and how long is each session? Edit per-{{ baseName.toLowerCase() }} later in the venue's Availability tab.</p>

            <div class="space-y-4">
              <!-- Days -->
              <div>
                <label class="text-xs font-semibold text-gray-600 mb-1.5 block">Days</label>
                <div class="flex gap-1.5 flex-wrap">
                  <button v-for="(label, i) in DAY_LABELS" :key="i" type="button"
                    class="w-9 h-9 rounded-lg text-xs font-bold transition-colors border"
                    :class="days.includes(i)
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'"
                    @click="toggleDay(i)">{{ label }}</button>
                </div>
              </div>

              <!-- Open / close -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="text-xs font-semibold text-gray-600 mb-1.5 block">Open</label>
                  <input v-model="openTime" type="time"
                    class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-shadow" />
                </div>
                <div>
                  <label class="text-xs font-semibold text-gray-600 mb-1.5 block">Close</label>
                  <input v-model="closeTime" type="time"
                    class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-shadow" />
                </div>
              </div>

              <!-- Slot length / buffer -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="text-xs font-semibold text-gray-600 mb-1.5 block">Session length <span class="text-gray-300 font-normal">— minutes</span></label>
                  <InputNumber v-model="slotMins" :min="15" :max="480" :step="15" show-buttons button-layout="horizontal"
                    decrement-button-class="!h-9 !w-9" increment-button-class="!h-9 !w-9"
                    input-class="!h-9 !w-16 !text-center !text-sm !font-semibold" class="w-full" />
                </div>
                <div>
                  <label class="text-xs font-semibold text-gray-600 mb-1.5 block">Gap <span class="text-gray-300 font-normal">— minutes between sessions</span></label>
                  <InputNumber v-model="bufferMins" :min="0" :max="120" :step="5" show-buttons button-layout="horizontal"
                    decrement-button-class="!h-9 !w-9" increment-button-class="!h-9 !w-9"
                    input-class="!h-9 !w-16 !text-center !text-sm !font-semibold" class="w-full" />
                </div>
              </div>

              <!-- Preview -->
              <div class="rounded-lg bg-gray-50 px-3 py-2 text-[11px] text-gray-600 leading-relaxed">
                <span class="font-semibold text-gray-500 uppercase tracking-wider mr-2">Preview</span>
                <span v-if="slotPreview">{{ slotPreview }}</span>
                <span v-else class="text-gray-400">Pick days + times to see the slots.</span>
              </div>
            </div>
          </section>

          <!-- ── Summary ── -->
          <section class="rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
            <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.14em] mb-2">Plan</p>
            <ul class="text-sm space-y-1.5">
              <li class="flex items-start gap-2">
                <i class="pi pi-check-circle text-emerald-500 text-xs mt-0.5" />
                <span>Facility <span class="font-semibold text-gray-900">"{{ venueName || sport.name }}"</span> created at the top level</span>
              </li>
              <li class="flex items-start gap-2">
                <i class="pi pi-check-circle text-emerald-500 text-xs mt-0.5" />
                <span><span class="font-semibold text-gray-900">{{ count }} {{ baseName.toLowerCase() }}{{ count === 1 ? '' : 's' }}</span> nested under it<span v-if="count > 1"> ({{ baseName }} 1 is the master, the rest linked)</span></span>
              </li>
              <li v-for="div in requiredDivisions" :key="div.key" class="flex items-start gap-2">
                <i class="pi pi-check-circle text-emerald-500 text-xs mt-0.5" />
                <span><span class="font-semibold text-gray-900">{{ div.name }} layout</span> on each {{ baseName.toLowerCase() }} ({{ div.children.length }} sub-{{ div.children.length === 1 ? 'venue' : 'venues' }} per parent + a "{{ div.name }}" configuration)</span>
              </li>
              <li class="flex items-start gap-2">
                <i class="pi pi-check-circle text-emerald-500 text-xs mt-0.5" />
                <span>Activity <span class="font-semibold text-gray-900">"{{ activityName || sport.name }}"</span> with <span class="font-semibold text-gray-900">{{ pickedModeKeys.size }}</span> mode{{ pickedModeKeys.size === 1 ? '' : 's' }}</span>
              </li>
              <li v-if="days.length && openTime && closeTime" class="flex items-start gap-2">
                <i class="pi pi-check-circle text-emerald-500 text-xs mt-0.5" />
                <span><span class="font-semibold text-gray-900">{{ daysSummary }}</span> {{ openTime }}–{{ closeTime }}, <span class="font-semibold text-gray-900">{{ slotMins }}-min</span> sessions<span v-if="bufferMins"> + {{ bufferMins }}-min gap</span></span>
              </li>
              <li v-if="!pickedModeKeys.size" class="flex items-start gap-2 text-amber-700">
                <i class="pi pi-exclamation-circle text-amber-500 text-xs mt-0.5" />
                <span>Pick at least one bookable format above.</span>
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
  (e: 'done', payload: { activityId: string; parentBookableIds: string[] }): void
}>()

const db = useDb()
const { orgId } = useOrg()
const toast = useToast()

// ── Catalogue ────────────────────────────────────────────────────────────
// Each sport ships with the divisions it actually uses + a curated set of
// preset modes. Adding a new sport here is the only change needed for it
// to flow through the wizard.
interface Division {
  key: string
  name: string
  children: string[]
  orientation?: 'cols' | 'rows' | 'grid'
}
interface PresetMode {
  key: string
  name: string
  description: string
  /** Configuration key required to book this mode, or null for whole venue. */
  requires: string | null
}
interface SportPreset {
  type: string
  name: string
  icon: string
  noun: string
  description: string
  divisions: Division[]
  presetModes: PresetMode[]
}

const SPORTS: SportPreset[] = [
  {
    type: 'tennis', name: 'Tennis', icon: '🎾', noun: 'Court',
    description: 'Tennis courts that can be booked whole, halved for mini-tennis, or quartered for kids coaching.',
    divisions: [
      { key: 'halves', name: 'Halves',   children: ['Half A', 'Half B'] },
      { key: 'quads',  name: 'Quarters', children: ['Quarter 1', 'Quarter 2', 'Quarter 3', 'Quarter 4'], orientation: 'grid' },
    ],
    presetModes: [
      { key: 'singles',       name: 'Singles',          description: '1v1 match — full court.',                requires: null },
      { key: 'doubles',       name: 'Doubles',          description: '2v2 match — full court.',                requires: null },
      { key: 'mini-tennis',   name: 'Mini-tennis',      description: 'Half-court, beginner / kids friendly.',  requires: 'halves' },
      { key: 'kids-coaching', name: 'Kids coaching',    description: 'Quarter-court drills, group lessons.',   requires: 'quads' },
      { key: 'practice',      name: 'Practice / hit-up',description: 'Single player or pair, full court.',     requires: null },
    ],
  },
  {
    type: 'basketball', name: 'Basketball', icon: '🏀', noun: 'Court',
    description: 'Basketball courts that can be booked whole or halved for cross-court training.',
    divisions: [
      { key: 'halves',       name: 'Halves',       children: ['Half A', 'Half B'] },
      { key: 'cross-courts', name: 'Cross-courts', children: ['Cross-court A', 'Cross-court B'] },
    ],
    presetModes: [
      { key: 'full-game',     name: 'Full-court game',  description: '5v5 match.',                              requires: null },
      { key: 'three-on-three',name: '3×3',              description: 'Half-court 3v3.',                         requires: 'halves' },
      { key: 'shootaround',   name: 'Shootaround',      description: 'Casual, half-court.',                     requires: 'halves' },
      { key: 'training',      name: 'Cross-court training', description: 'Two simultaneous sessions.',          requires: 'cross-courts' },
    ],
  },
  {
    type: 'football', name: 'Football', icon: '⚽', noun: 'Field',
    description: 'Football fields used full size, halved, or quartered for training.',
    divisions: [
      { key: 'halves', name: 'Halves',   children: ['Half A', 'Half B'] },
      { key: 'thirds', name: 'Thirds',   children: ['Third 1', 'Third 2', 'Third 3'] },
      { key: 'quads',  name: 'Quarters', children: ['Quarter 1', 'Quarter 2', 'Quarter 3', 'Quarter 4'], orientation: 'grid' },
    ],
    presetModes: [
      { key: 'match',           name: 'Match',           description: 'Full-pitch game.',                     requires: null },
      { key: 'small-sided',     name: 'Small-sided game',description: 'Half-pitch — 5v5 / 7v7.',              requires: 'halves' },
      { key: 'training-thirds', name: 'Thirds training', description: 'Three drills running side-by-side.',   requires: 'thirds' },
      { key: 'mini-pitches',    name: 'Mini-pitches',    description: 'Quarter-pitch grids for kids.',        requires: 'quads' },
    ],
  },
  {
    type: 'netball', name: 'Netball', icon: '🥎', noun: 'Court',
    description: 'Netball courts at full size, halved, or split into thirds for training.',
    divisions: [
      { key: 'halves', name: 'Halves', children: ['Half A', 'Half B'] },
      { key: 'thirds', name: 'Thirds', children: ['Goal Third (Attack)', 'Centre Third', 'Goal Third (Defence)'] },
    ],
    presetModes: [
      { key: 'match',          name: 'Match',           description: '7v7 match — full court.',             requires: null },
      { key: 'half-court',     name: 'Half-court drills', description: 'Half-court training.',              requires: 'halves' },
      { key: 'thirds-training', name: 'Thirds training', description: 'Position-specific work in each third.', requires: 'thirds' },
    ],
  },
  {
    type: 'hall', name: 'Sports Hall', icon: '🏛️', noun: 'Hall',
    description: 'Multi-purpose halls that can run as one big space or split into badminton courts.',
    divisions: [
      { key: 'halves', name: 'Halves',          children: ['Half A', 'Half B'] },
      { key: 'bad-4',  name: 'Badminton (4)',   children: ['Court 1', 'Court 2', 'Court 3', 'Court 4'], orientation: 'grid' },
    ],
    presetModes: [
      { key: 'whole-hall',  name: 'Whole-hall hire', description: 'Birthday parties, school assemblies, full-hall hire.', requires: null },
      { key: 'half-hall',   name: 'Half-hall hire',  description: 'Two activities at once.',                              requires: 'halves' },
      { key: 'badminton',   name: 'Badminton',       description: 'Per-court badminton bookings.',                        requires: 'bad-4' },
    ],
  },
]

// ── Local state ──────────────────────────────────────────────────────────
const selectedType = ref<string>('tennis')
const sport = computed(() => SPORTS.find(s => s.type === selectedType.value) ?? SPORTS[0])
const venueName = ref('Tennis Courts')
const count = ref(4)
const baseName = ref('Court')
const pickedModeKeys = ref<Set<string>>(new Set(['singles', 'doubles']))
const activityName = ref('Tennis')
const creating = ref(false)

// ── Default sessions (operating hours + slot length) ─────────────────────
// 0=Mon … 6=Sun (matches availability_rules.days_of_week convention).
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const days = ref<number[]>([0, 1, 2, 3, 4])
const openTime = ref('09:00')
const closeTime = ref('17:00')
const slotMins = ref(60)
const bufferMins = ref(15)

function toggleDay(i: number) {
  const next = new Set(days.value)
  if (next.has(i)) next.delete(i)
  else next.add(i)
  days.value = Array.from(next).sort((a, b) => a - b)
}

const daysSummary = computed(() => {
  if (!days.value.length) return 'No days'
  const sorted = [...days.value].sort((a, b) => a - b)
  // Tight contiguous range → "Mon–Fri" shorthand.
  const isContiguous = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1)
  if (isContiguous && sorted.length >= 3) return `${DAY_NAMES[sorted[0]]}–${DAY_NAMES[sorted[sorted.length - 1]]}`
  return sorted.map(d => DAY_NAMES[d]).join(', ')
})

function fmtTime(mins: number): string {
  const h = Math.floor(mins / 60), m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Slice the open/close window into discrete sessions of slotMins separated
// by bufferMins. Used both by the live preview and by the create() write —
// availability_rules.time_slots is what the calendar/scheduler iterates to
// render bookable cells.
function buildSessionSlots(): { from: string; to: string }[] {
  if (!openTime.value || !closeTime.value || !slotMins.value) return []
  const [oh, om] = openTime.value.split(':').map(Number)
  const [ch, cm] = closeTime.value.split(':').map(Number)
  const openMin = oh * 60 + om
  const closeMin = ch * 60 + cm
  const step = slotMins.value + (bufferMins.value || 0)
  if (closeMin - openMin < slotMins.value || step <= 0) return []
  const out: { from: string; to: string }[] = []
  for (let t = openMin; t + slotMins.value <= closeMin; t += step) {
    out.push({ from: fmtTime(t), to: fmtTime(t + slotMins.value) })
  }
  return out
}

const slotPreview = computed(() => {
  if (!days.value.length) return ''
  const slots = buildSessionSlots()
  if (!slots.length) return 'Window too short for a session.'
  const previews = slots.slice(0, 5).map(s => s.from)
  const more = slots.length > previews.length ? `, … (${slots.length} per day)` : ''
  return previews.join(', ') + more
})

function selectSport(t: string) {
  selectedType.value = t
  const s = SPORTS.find(x => x.type === t)
  if (!s) return
  baseName.value = s.noun
  activityName.value = s.name
  // Sensible default for the parent facility — sport-specific. The user
  // can rename before applying.
  venueName.value = `${s.name} ${s.noun}s`
  // Default to the first two preset modes — usually the "primary" formats.
  pickedModeKeys.value = new Set(s.presetModes.slice(0, 2).map(m => m.key))
}
function toggleMode(key: string) {
  const next = new Set(pickedModeKeys.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  pickedModeKeys.value = next
}

// Required divisions = the union of `requires` keys across picked modes.
// Resolve each key against the sport's divisions list.
const requiredDivisions = computed<Division[]>(() => {
  const keys = new Set<string>()
  for (const k of pickedModeKeys.value) {
    const m = sport.value.presetModes.find(x => x.key === k)
    if (m?.requires) keys.add(m.requires)
  }
  return Array.from(keys)
    .map(k => sport.value.divisions.find(d => d.key === k))
    .filter((d): d is Division => !!d)
})

function requiresLabel(key: string): string {
  return sport.value.divisions.find(d => d.key === key)?.name ?? key
}

const canCreate = computed(() =>
  pickedModeKeys.value.size > 0 &&
  count.value >= 1 &&
  !!venueName.value.trim() &&
  !!baseName.value.trim() &&
  !!activityName.value.trim(),
)

// ── Apply ────────────────────────────────────────────────────────────────
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
      require_mode: true,
      area_name_singular: sport.value.noun,
      area_name_plural: `${sport.value.noun}s`,
      // Sport-style activities use the single-screen scheduler (grid + side
      // panel) rather than the multi-step wizard — slot picking on a court
      // grid is the natural flow for repeat hireable spaces.
      booking_flow: 'scheduler',
      // Default sessions — fixed slot length + gap. min == max keeps the
      // booker locked to one duration; advanced users can widen the range
      // later in the activity editor.
      min_duration_mins: slotMins.value,
      max_duration_mins: slotMins.value,
      buffer_mins: bufferMins.value,
    }).select('id').single()
    if (actErr || !act?.id) throw actErr ?? new Error('Could not create activity')
    const activityId = act.id as string

    // 2) Top-level facility (grandparent). Owns the courts so the venue
    //    list shows a clean "Tennis Courts › Court 1 › Q1…" tree.
    const { data: facility, error: fErr } = await (db.from as any)('bookables').insert({
      org_id: orgId.value,
      name: venueName.value.trim(),
      type: 'VENUE',
      status: 'ACTIVE',
      max_concurrent: 1,
      is_public: true,
      allow_sub_venues: true,
    }).select('id').single()
    if (fErr || !facility?.id) throw fErr ?? new Error('Could not create facility')
    const facilityId = facility.id as string

    // 3) Parent court bookables. Court 1 is the master; the rest link via
    //    master_id. allow_sub_venues is only true when the picked modes
    //    need a finer division. auto_resolve_children mirrors that —
    //    when a court has halves/quarters the booker shouldn't pick
    //    among them; the system picks based on the mode's config_key.
    const needsSubVenues = requiredDivisions.value.length > 0
    const parentIds: string[] = []
    for (let i = 0; i < count.value; i++) {
      const isMaster = i === 0
      const name = count.value === 1 ? baseName.value.trim() : `${baseName.value.trim()} ${i + 1}`
      const { data, error } = await (db.from as any)('bookables').insert({
        org_id: orgId.value,
        name,
        type: 'VENUE',
        status: 'ACTIVE',
        max_concurrent: 1,
        parent_id: facilityId,
        is_master: isMaster,
        master_id: isMaster ? null : parentIds[0],
        is_public: true,
        allow_sub_venues: needsSubVenues,
        auto_resolve_children: needsSubVenues,
      }).select('id').single()
      if (error || !data?.id) throw error ?? new Error('Could not create venue')
      parentIds.push(data.id)
    }

    // 4) Sub-venues + configurations.
    //    Only the FINEST required division is materialised as physical
    //    sub-venues — coarser configurations group those finer sub-venues
    //    into slots. So a court that needs both halves and quarters gets
    //    Q1–Q4 as bookables, and the Halves configuration is two slots:
    //    {Q1+Q2}, {Q3+Q4}.
    if (requiredDivisions.value.length) {
      // Pick finest = largest child count.
      const finest = requiredDivisions.value.reduce(
        (max, d) => d.children.length > max.children.length ? d : max,
        requiredDivisions.value[0],
      )

      // Master parent's physical sub-children = finest division's children.
      const masterChildIds: string[] = []
      for (let ci = 0; ci < finest.children.length; ci++) {
        const isMaster = ci === 0
        const { data, error } = await (db.from as any)('bookables').insert({
          org_id: orgId.value,
          name: finest.children[ci],
          type: 'VENUE',
          status: 'ACTIVE',
          max_concurrent: 1,
          parent_id: parentIds[0],
          is_master: isMaster,
          master_id: isMaster ? null : masterChildIds[0],
          is_public: true,
        }).select('id').single()
        if (error || !data?.id) throw error ?? new Error('Could not create sub-venue')
        masterChildIds.push(data.id)
      }

      // Save every required configuration on the master, slicing the
      // finest children into slots for coarser configs.
      for (const div of requiredDivisions.value) {
        const slots = computeSlots(div, finest, masterChildIds)
        await saveConfigurationSlots(parentIds[0], div.key, div.name, slots)
      }

      // Linked siblings: physical sub-children mirror the master's, then
      // configurations get computed against each sibling's own children.
      for (let pi = 1; pi < parentIds.length; pi++) {
        const linkedChildIds: string[] = []
        for (let ci = 0; ci < finest.children.length; ci++) {
          const { data, error } = await (db.from as any)('bookables').insert({
            org_id: orgId.value,
            name: finest.children[ci],
            type: 'VENUE',
            status: 'ACTIVE',
            max_concurrent: 1,
            parent_id: parentIds[pi],
            is_master: false,
            master_id: masterChildIds[ci],
            is_public: true,
          }).select('id').single()
          if (error || !data?.id) throw error ?? new Error('Could not create linked sub-venue')
          linkedChildIds.push(data.id)
        }
        for (const div of requiredDivisions.value) {
          const slots = computeSlots(div, finest, linkedChildIds)
          await saveConfigurationSlots(parentIds[pi], div.key, div.name, slots)
        }
      }
    }

    // 5) Activity modes — one per picked preset, wired to its config_key.
    //    Capture mode ids so we can populate per-mode bookable scope next.
    const insertedModes: { id: string; requires: string | null }[] = []
    let order = 0
    for (const k of pickedModeKeys.value) {
      const m = sport.value.presetModes.find(x => x.key === k)
      if (!m) continue
      const { data: row, error: mErr } = await (db.from as any)('activity_modes').insert({
        activity_id: activityId,
        name: m.name,
        configuration_key: m.requires,
        sort_order: order++,
      }).select('id, configuration_key').single()
      if (mErr || !row?.id) throw mErr ?? new Error('Could not create activity mode')
      insertedModes.push({ id: row.id, requires: m.requires })
    }

    // 6) Link the parent court venues to the activity (the facility itself
    //    isn't a booking target — it's just for org structure). Children
    //    of each court inherit through configuration pool resolution at
    //    booking time.
    await (db.from as any)('activity_bookables').insert(
      parentIds.map(pid => ({ activity_id: activityId, bookable_id: pid })),
    )

    // 7a) Default availability rules — one OPEN rule per parent court whose
    //     time_slots[] holds every individual session generated from the
    //     open window + slot length + gap. The calendar/scheduler iterates
    //     time_slots to render bookable cells; collapsing the window to a
    //     single block would render as one slot. Skipped if the user
    //     cleared all days (treat as 24/7 / configure later).
    const sessionSlots = buildSessionSlots()
    if (days.value.length && sessionSlots.length && parentIds.length) {
      const { error: avErr } = await (db.from as any)('availability_rules').insert(
        parentIds.map(pid => ({
          bookable_id: pid,
          name: 'Default sessions',
          rule_type: 'OPEN',
          days_of_week: days.value,
          // time_from/time_to mirror the first slot — matches the shape
          // AvailabilityEditor writes, keeps the legacy fallback consistent.
          time_from: sessionSlots[0].from,
          time_to: sessionSlots[0].to,
          time_slots: sessionSlots,
          is_active: true,
        })),
      )
      if (avErr) throw avErr
    }

    // 7b) Per-mode bookable scope. Every mode is bookable on every parent
    //    court the wizard just created — making this explicit (rather than
    //    leaving the table empty as "implicit all") matches what the mode
    //    editor's UI shows and avoids surprises if later changes narrow
    //    activity-level scope without touching the modes.
    if (insertedModes.length && parentIds.length) {
      const scopeRows: any[] = []
      for (const mode of insertedModes) {
        for (const pid of parentIds) {
          scopeRows.push({ mode_id: mode.id, bookable_id: pid })
        }
      }
      const { error: scopeErr } = await (db.from as any)('activity_mode_bookables').insert(scopeRows)
      if (scopeErr) throw scopeErr
    }

    toast.add({
      severity: 'success',
      summary: 'Setup complete',
      detail: `${count.value} ${baseName.value.toLowerCase()}${count.value === 1 ? '' : 's'} + ${pickedModeKeys.value.size} mode${pickedModeKeys.value.size === 1 ? '' : 's'} ready.`,
      life: 4000,
    })
    emit('done', { activityId, parentBookableIds: parentIds })
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

// Map a coarser division onto the finest division's physical children by
// sequential grouping. Halves over 4 quarters → slot 0 = [Q1, Q2], slot 1
// = [Q3, Q4]. Self-mapping (div === finest) yields one child per slot.
interface ConfigSlot { name: string; childIds: string[] }
function computeSlots(div: Division, finest: Division, finestChildIds: string[]): ConfigSlot[] {
  const numSlots = div.children.length
  if (!numSlots) return []
  const groupSize = Math.max(1, Math.floor(finestChildIds.length / numSlots))
  const slots: ConfigSlot[] = []
  for (let si = 0; si < numSlots; si++) {
    const start = si * groupSize
    // Last slot sweeps up any remainder so we never lose a child.
    const end = si === numSlots - 1 ? finestChildIds.length : start + groupSize
    slots.push({
      name: div.children[si] ?? `Slot ${si + 1}`,
      childIds: finestChildIds.slice(start, end),
    })
  }
  return slots
}

// Slot-aware save lives in useBookableConfigurations so it's shared with
// pages/bookables/[id].vue (manual edit dialog + template apply).
const { saveConfiguration: saveConfigurationSlots } = useBookableConfigurations()
</script>
