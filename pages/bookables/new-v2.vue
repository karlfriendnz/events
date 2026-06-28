<template>
  <div class="min-h-screen flex flex-col" style="background: linear-gradient(180deg, #F5F8FA 0%, #ffffff 100%)">

    <!-- Top bar -->
    <header class="bg-white/80 backdrop-blur border-b border-gray-200 px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-20">
      <button class="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        @click="navigateTo('/bookables')">
        <i class="pi pi-times text-xs" />
        <span>Cancel</span>
      </button>
      <div class="flex items-center gap-2">
        <span class="text-sm font-semibold text-gray-800">Set up your club</span>
        <span class="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded uppercase tracking-wider">v2 conversational</span>
      </div>
      <NuxtLink to="/bookables/new" class="text-xs text-gray-400 hover:text-gray-700">
        ← Try v1
      </NuxtLink>
    </header>

    <main class="flex-1">
      <div class="max-w-xl mx-auto px-4 md:px-6 pt-12 pb-32 space-y-12">

        <!-- 0) Club setup. Only when the org has no top-level venues yet. -->
        <transition name="reveal">
          <section v-if="showClub" class="space-y-3">
            <p class="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight tracking-tight">First things first — what's your club called?</p>
            <p class="text-sm text-gray-500">This is the main facility everything else lives inside. We'll add courts, rooms, lockers, etc. underneath in a moment.</p>
            <InputText ref="clubInput" v-model="form.club_name"
              placeholder="e.g. Acme Tennis Club, Riverside Sports Centre"
              class="w-full !text-lg !py-3" autofocus
              @keyup.enter="clubNameFilled && advance()" />
            <div v-if="revealedUpTo === 0" class="pt-1">
              <Button label="Continue" icon="pi pi-arrow-right" icon-pos="right" size="small"
                :disabled="!clubNameFilled" @click="advance()"
                style="background:var(--brand-primary);border-color:var(--brand-primary)" />
            </div>
          </section>
        </transition>

        <!-- 1) Capture the area names — chip-style input. We use the
             singular form for each so the rest of the wizard can ask
             "how many Tennis Courts" cleanly. -->
        <transition name="reveal">
          <section v-if="showAreas" class="space-y-3">
            <p class="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight tracking-tight">
              What sort of areas do you want to hire out{{ clubLabel ? ` at ${clubLabel}` : '' }}?
            </p>
            <p class="text-sm text-gray-500">List the kinds of spaces — we'll set each one up afterwards. Use the singular form (e.g. "Tennis Court", not "Courts").</p>

            <div class="flex flex-wrap gap-2">
              <span v-for="(area, i) in form.areas" :key="i"
                class="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium bg-primary/5 text-primary border border-primary/15">
                {{ area.name }}
                <button type="button" class="text-primary/40 hover:text-red-500"
                  @click="removeArea(i)">
                  <i class="pi pi-times text-[10px]" />
                </button>
              </span>
            </div>

            <div class="flex items-center gap-2">
              <InputText ref="areaInput" v-model="newAreaName"
                placeholder="e.g. Tennis Court, Locker, Function Room"
                class="flex-1 !py-2.5" @keyup.enter="addArea" />
              <Button label="Add" icon="pi pi-plus" size="small"
                :disabled="!newAreaName.trim()" @click="addArea"
                style="background:var(--brand-primary);border-color:var(--brand-primary)" />
            </div>

            <div v-if="revealedUpTo === 1" class="pt-1 flex items-center gap-3">
              <Button label="Continue" icon="pi pi-arrow-right" icon-pos="right" size="small"
                :disabled="!form.areas.length" @click="advance()"
                style="background:var(--brand-primary);border-color:var(--brand-primary)" />
              <span v-if="!form.areas.length" class="text-xs text-gray-400">Add at least one area to continue</span>
            </div>
          </section>
        </transition>

        <!-- 2) Per-area config loop. Each area gets its own card revealed
             one at a time as the user clicks "Save & next area". The
             card stays visible after configuring so the user can scroll
             back and edit. -->
        <template v-for="(area, i) in form.areas" :key="`area-${i}`">
          <transition name="reveal">
            <section v-if="showArea(i)" class="space-y-3 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div class="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                <span class="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px]">{{ i + 1 }}</span>
                <span>Area {{ i + 1 }} of {{ form.areas.length }}</span>
              </div>
              <p class="text-xl sm:text-2xl font-bold text-gray-900 leading-tight tracking-tight">
                Let's set up <span class="text-primary">{{ area.name }}</span>
              </p>

              <!-- Count -->
              <div class="space-y-2 pt-2">
                <p class="text-sm font-semibold text-gray-700">How many <span class="text-primary">{{ area.name }}</span>s do you have?</p>
                <div class="flex items-center gap-3">
                  <InputNumber v-model="area.count" :min="1" :max="200"
                    input-class="w-20 !text-base !py-2.5" class="shrink-0" />
                  <div class="flex flex-wrap gap-1.5">
                    <button v-for="n in [1, 2, 4, 10, 20]" :key="n" type="button"
                      class="px-3 py-1.5 text-xs font-medium rounded-full transition-colors"
                      :class="area.count === n
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
                      @click="area.count = n">{{ n }}</button>
                  </div>
                </div>
              </div>

              <!-- Capacity -->
              <div class="space-y-2 pt-2">
                <p class="text-sm font-semibold text-gray-700">How many bookings can run at the same time at each?</p>
                <p class="text-xs text-gray-400 -mt-1">For a single court / room this is usually 1. For a hall hosting multiple groups, set higher.</p>
                <InputNumber v-model="area.max_concurrent" :min="1" :max="100"
                  input-class="w-20 !text-base !py-2.5" class="shrink-0" />
              </div>

              <!-- Booking types -->
              <div class="space-y-2 pt-2">
                <p class="text-sm font-semibold text-gray-700">What sort of <span class="text-primary">{{ area.name }}</span> bookings do you offer?</p>
                <p class="text-xs text-gray-400 -mt-1">Like Singles, Doubles, or Birthday parties — these are the choices people pick when they book.</p>
                <div class="flex flex-wrap gap-2 items-center">
                  <span v-for="(m, mi) in area.modes" :key="mi"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-primary/5 text-primary border border-primary/15">
                    <span class="w-2 h-2 rounded-full" :style="{ background: m.color }" />
                    {{ m.name }}
                    <button type="button" class="text-primary/40 hover:text-red-500 ml-0.5"
                      @click="area.modes.splice(mi, 1)">
                      <i class="pi pi-times text-[9px]" />
                    </button>
                  </span>
                  <button type="button"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white border-2 border-dashed border-gray-300 text-gray-500 hover:border-primary hover:text-primary transition-colors"
                    @click="openModeWizard(i)">
                    <i class="pi pi-plus text-[10px]" />
                    {{ area.modes.length ? 'Add another type' : 'Add a type' }}
                  </button>
                </div>
              </div>

              <!-- Per-area Continue. Bumps to next area, or to stage 3 if on the last area. -->
              <div v-if="isCurrentArea(i)" class="pt-3 flex items-center gap-3">
                <Button :label="i < form.areas.length - 1 ? `Save & set up ${form.areas[i + 1].name}` : 'Save & continue'"
                  icon="pi pi-arrow-right" icon-pos="right" size="small"
                  @click="finishArea(i)"
                  style="background:var(--brand-primary);border-color:var(--brand-primary)" />
              </div>
            </section>
          </transition>
        </template>

        <!-- 3) Availability — applied to every area created. -->
        <transition name="reveal">
          <section v-if="showAvailability" class="space-y-3">
            <p class="text-xl sm:text-2xl font-bold text-gray-900 leading-tight tracking-tight">When are these areas open?</p>
            <p class="text-sm text-gray-500">Same hours apply to every area. You can fine-tune each one later from its Availability tab.</p>
            <div class="flex flex-col gap-2">
              <button type="button"
                class="text-left px-4 py-3 rounded-xl border-2 transition-all"
                :class="form.availability_mode === 'ALWAYS'
                  ? 'border-primary bg-primary/5 text-gray-900'
                  : 'border-gray-200 hover:border-gray-300 text-gray-700'"
                @click="onAlwaysOpen">
                <p class="text-sm font-semibold">Always open</p>
                <p class="text-xs text-gray-500 mt-0.5">Bookable any day, any time.</p>
              </button>
              <button type="button"
                class="text-left px-4 py-3 rounded-xl border-2 transition-all"
                :class="form.availability_mode === 'SCHEDULED'
                  ? 'border-primary bg-primary/5 text-gray-900'
                  : 'border-gray-200 hover:border-gray-300 text-gray-700'"
                @click="form.availability_mode = 'SCHEDULED'">
                <p class="text-sm font-semibold">Set opening hours</p>
                <p class="text-xs text-gray-500 mt-0.5">Choose days and times.</p>
              </button>
            </div>

            <transition name="reveal">
              <div v-if="form.availability_mode === 'SCHEDULED'" class="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                <div>
                  <p class="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Days</p>
                  <div class="flex gap-1.5 flex-wrap">
                    <button v-for="(d, i) in dayLabels" :key="i" type="button"
                      class="px-3 py-1.5 text-xs rounded-full border-2 transition-colors"
                      :class="form.days.includes(i)
                        ? 'bg-primary border-primary text-white'
                        : 'border-gray-200 text-gray-600 hover:border-gray-400'"
                      @click="toggleDay(i)">
                      {{ d }}
                    </button>
                  </div>
                </div>
                <div>
                  <p class="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Hours</p>
                  <div class="flex items-center gap-2 flex-wrap">
                    <Select v-model="form.time_from" :options="timeSlots" option-label="label" option-value="value"
                      placeholder="From" class="w-32" />
                    <span class="text-gray-400 text-sm">to</span>
                    <Select v-model="form.time_to" :options="timeSlots" option-label="label" option-value="value"
                      placeholder="To" class="w-32" />
                  </div>
                </div>
                <div v-if="revealedUpTo === 3" class="pt-1">
                  <Button label="Continue" icon="pi pi-arrow-right" icon-pos="right" size="small"
                    @click="advance()" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
                </div>
              </div>
            </transition>
          </section>
        </transition>

        <!-- 4) Club photo — single shared image, lives on the club row. -->
        <transition name="reveal">
          <section v-if="showImage" class="space-y-3">
            <p class="text-xl sm:text-2xl font-bold text-gray-900 leading-tight tracking-tight">
              Add a photo of {{ clubLabel || 'your club' }}?
            </p>
            <p class="text-sm text-gray-500">Optional. A nice photo makes the booker page feel real.</p>
            <div v-if="!form.main_image"
              class="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center gap-2 hover:border-primary transition-colors cursor-pointer max-w-sm"
              @click="imageInput?.click()">
              <i class="pi pi-image text-2xl text-gray-300" />
              <Button label="Upload image" severity="secondary" outlined size="small" icon="pi pi-upload" />
            </div>
            <div v-else class="relative rounded-xl overflow-hidden w-64">
              <img :src="form.main_image" class="w-full h-40 object-cover" />
              <div v-if="uploadingImage" class="absolute inset-0 bg-black/40 flex items-center justify-center">
                <i class="pi pi-spin pi-spinner text-white text-xl" />
              </div>
              <Button v-else icon="pi pi-times" severity="danger" rounded size="small"
                class="absolute top-2 right-2" @click="form.main_image = ''" />
            </div>
            <input ref="imageInput" type="file" accept="image/*" class="hidden" @change="handleImageUpload" />
            <div v-if="revealedUpTo === 4" class="pt-1 flex items-center gap-3">
              <Button label="Continue" icon="pi pi-arrow-right" icon-pos="right" size="small"
                @click="advance()" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
              <button type="button" class="text-xs text-gray-500 hover:text-gray-800"
                @click="form.main_image = ''; advance()">Skip</button>
            </div>
          </section>
        </transition>

        <!-- Summary + Create button -->
        <transition name="reveal">
          <section v-if="canCreate" class="!mt-16">
            <div class="rounded-2xl bg-primary text-white p-6 shadow-xl">
              <p class="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 mb-3">Summary</p>
              <p class="text-base leading-relaxed">{{ summarySentence }}</p>
              <ul class="mt-4 space-y-1 text-sm text-white/80">
                <li v-for="(area, i) in form.areas" :key="i" class="flex items-baseline gap-2">
                  <i class="pi pi-check text-[10px] text-emerald-300" />
                  <span>
                    <span class="font-semibold text-white">{{ area.count > 1 ? `${area.count} ` : '' }}{{ area.name }}{{ area.count > 1 ? 's' : '' }}</span>
                    <span v-if="area.modes.length"> with {{ area.modes.length }} booking type{{ area.modes.length === 1 ? '' : 's' }}</span>
                  </span>
                </li>
              </ul>
              <Button :label="createButtonLabel"
                icon="pi pi-check" icon-pos="right" size="large"
                :loading="creating" @click="submit"
                class="mt-5 w-full"
                style="background:white;color:var(--brand-primary);border-color:white;font-weight:600" />
            </div>
          </section>
        </transition>

      </div>
    </main>

    <Toast />

    <ModeWizard
      v-model:visible="modeWizardOpen"
      :activity-name="modeWizardActivityName"
      @done="onModeCaptured" />
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import type { ModePayload } from '~/components/ModeWizard.vue'

definePageMeta({ layout: 'default' })

const db = useDb()
const { orgId } = useOrg()
const route = useRoute()
const toast = useToast()

const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const timeSlots = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2)
  const m = (i % 2) * 30
  const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  const label = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`
  return { value, label }
})

// Each area in form.areas becomes one nested venue (or N siblings if
// count>1) under the club. Modes attach to one auto-named activity per
// area at submit time.
type Area = {
  name: string
  count: number
  max_concurrent: number
  modes: ModePayload[]
}

const form = reactive({
  // Stage 0 only used the first time someone creates a venue against a
  // fresh org. We bundle a top-level "club" venue at submit time and
  // nest every area underneath it.
  club_name: '',
  parent_id: (route.query.parent as string) || null,
  areas: [] as Area[],
  // Shared availability — applied to every area. Per-area overrides
  // live in the area's Availability tab afterward.
  availability_mode: 'ALWAYS' as 'ALWAYS' | 'SCHEDULED',
  days: [0, 1, 2, 3, 4, 5, 6],
  time_from: '09:00',
  time_to: '21:00',
  // Photo — lives on the club row (or first area if no club).
  main_image: '',
})

const creating = ref(false)
const allBookables = ref<any[]>([])
const parentsLoaded = ref(false)

// ── Stage gates ───────────────────────────────────────────────────────
// Stage numbers:
//   0 Club setup (only when needsClub) · 1 Capture areas ·
//   2 Per-area config loop · 3 Availability · 4 Photo · 5 Summary
const revealedUpTo = ref(0)
// Inside stage 2 we walk through areas one at a time. This index is
// the highest area card the user has revealed so far.
const stage2Index = ref(0)

const venueOptions = computed(() => allBookables.value.filter(b => b.type === 'VENUE' && b.status !== 'ARCHIVED' && b.status !== 'DELETED'))
const topLevelVenues = computed(() => venueOptions.value.filter(v => !v.parent_id))
const needsClub = computed(() => parentsLoaded.value && topLevelVenues.value.length === 0)

const clubNameFilled = computed(() => form.club_name.trim().length > 0)
// Friendly label used in question wording. Falls back to "your club"
// when we're nesting under an existing venue.
const clubLabel = computed(() => {
  if (form.club_name.trim()) return form.club_name.trim()
  if (form.parent_id) {
    return allBookables.value.find(b => b.id === form.parent_id)?.name ?? ''
  }
  return ''
})

const showClub        = computed(() => parentsLoaded.value && needsClub.value && revealedUpTo.value >= 0)
const showAreas       = computed(() => parentsLoaded.value && revealedUpTo.value >= 1)
function showArea(i: number) { return revealedUpTo.value >= 2 && stage2Index.value >= i }
function isCurrentArea(i: number) { return revealedUpTo.value === 2 && stage2Index.value === i }
const showAvailability = computed(() => revealedUpTo.value >= 3)
const showImage       = computed(() => revealedUpTo.value >= 4)

const allAreasValid = computed(() =>
  form.areas.length > 0 && form.areas.every(a => a.name.trim().length > 0 && a.count >= 1),
)
const canCreate = computed(() =>
  revealedUpTo.value >= 5
    && allAreasValid.value
    && (!needsClub.value || clubNameFilled.value),
)

const createButtonLabel = computed(() => {
  const total = form.areas.reduce((sum, a) => sum + a.count, 0)
  if (form.club_name.trim()) {
    return `Create ${form.club_name.trim()} with ${total} venue${total === 1 ? '' : 's'}`
  }
  return total === 1 ? 'Create venue' : `Create ${total} venues`
})

// Sentence-style summary the user reads before hitting Create.
const summarySentence = computed(() => {
  const parts: string[] = []
  const venuePart = form.club_name.trim()
    ? `Setting up "${form.club_name.trim()}"`
    : 'Adding to your club'
  parts.push(venuePart)
  if (form.areas.length) parts.push(`with ${form.areas.length} area${form.areas.length === 1 ? '' : 's'}`)
  if (form.availability_mode === 'ALWAYS') parts.push(`open 24/7`)
  else parts.push(`open ${form.days.length} day${form.days.length === 1 ? '' : 's'}/week ${formatTime(form.time_from)}–${formatTime(form.time_to)}`)
  return parts.join(', ') + '.'
})

function formatTime(v: string) {
  return timeSlots.find(s => s.value === v)?.label ?? v
}

// ── Reveal control ───────────────────────────────────────────────────
async function advance() {
  let next = revealedUpTo.value + 1
  // Skip the per-area loop if no areas were captured (impossible with
  // the Continue gate but defensive)
  if (next === 2 && form.areas.length === 0) next = 3
  revealedUpTo.value = Math.max(revealedUpTo.value, next)
  await nextTick()
  focusForSection()
}

// "Save & next area" inside stage 2. Bumps to the next card in the
// per-area loop, or jumps to stage 3 (Availability) when on the last.
async function finishArea(i: number) {
  if (i < form.areas.length - 1) {
    stage2Index.value = i + 1
    await nextTick()
    // Could focus the new area's count input — left as-is for now;
    // PrimeVue's InputNumber doesn't expose a clean focus call.
  } else {
    advance()
  }
}

function onAlwaysOpen() {
  form.availability_mode = 'ALWAYS'
  advance()
}

// Refs we focus when their stage reveals.
const clubInput = ref<any>(null)
const areaInput = ref<any>(null)

function focusForSection() {
  const targets: Record<number, any> = {
    0: clubInput.value,
    1: areaInput.value,
  }
  const inst = targets[revealedUpTo.value]
  if (!inst) return
  const el = inst.$el ?? inst
  const input: HTMLInputElement | null = el?.querySelector?.('input') ?? (el?.tagName === 'INPUT' ? el : null)
  input?.focus?.()
  input?.select?.()
}

// ── Area capture ─────────────────────────────────────────────────────
const newAreaName = ref('')
function addArea() {
  const name = newAreaName.value.trim()
  if (!name) return
  form.areas.push({ name, count: 1, max_concurrent: 1, modes: [] })
  newAreaName.value = ''
}
function removeArea(i: number) {
  form.areas.splice(i, 1)
  // Walk stage2Index back if we just removed the area we were on.
  if (stage2Index.value >= form.areas.length && form.areas.length > 0) {
    stage2Index.value = form.areas.length - 1
  }
}

function toggleDay(i: number) {
  const idx = form.days.indexOf(i)
  if (idx >= 0) form.days.splice(idx, 1)
  else form.days.push(i)
  form.days.sort((a, b) => a - b)
}

// ── Mode wizard wiring ──────────────────────────────────────────────
const modeWizardOpen = ref(false)
const modeWizardAreaIndex = ref<number | null>(null)
const modeWizardActivityName = computed(() => {
  const i = modeWizardAreaIndex.value
  return i !== null ? form.areas[i]?.name ?? '' : ''
})
function openModeWizard(areaIndex: number) {
  modeWizardAreaIndex.value = areaIndex
  modeWizardOpen.value = true
}
function onModeCaptured(mode: ModePayload) {
  const i = modeWizardAreaIndex.value
  if (i === null) return
  form.areas[i]?.modes.push(mode)
}

// ── Image upload ────────────────────────────────────────────────────
const imageInput = ref<HTMLInputElement | null>(null)
const uploadingImage = ref(false)
const { uploadFile } = useUpload()
async function handleImageUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  form.main_image = URL.createObjectURL(file)
  uploadingImage.value = true
  try { form.main_image = await uploadFile(file) } finally { uploadingImage.value = false }
}

// ── Data load ───────────────────────────────────────────────────────
async function loadParents() {
  if (!orgId.value) return
  const { data } = await (db.from as any)('bookables').select('id, name, type, parent_id, status').eq('org_id', orgId.value)
  allBookables.value = data ?? []
  parentsLoaded.value = true
  if (needsClub.value) {
    revealedUpTo.value = 0
  } else {
    if (topLevelVenues.value.length === 1 && !form.parent_id) {
      form.parent_id = topLevelVenues.value[0].id
    }
    if (revealedUpTo.value < 1) revealedUpTo.value = 1
  }
}

watch(orgId, () => { loadParents() }, { immediate: true })

// ── Submit ──────────────────────────────────────────────────────────
// Wraps everything into one logical create:
//   1) club bookable (top-level VENUE) when form.club_name is set
//   2) for each area: count siblings + 1 activity + N modes + N
//      activity_bookables joins + N availability rules
async function submit() {
  if (!orgId.value) {
    toast.add({ severity: 'error', summary: 'Not ready', detail: 'Org not loaded', life: 3000 })
    return
  }
  creating.value = true
  try {
    // 1) Club row, if first-time setup. Holds the photo so sub-venues
    //    inherit it on the booker page.
    let parentId: string | null = form.parent_id || null
    if (form.club_name.trim()) {
      const { data: club, error: clubErr } = await (db.from as any)('bookables').insert({
        org_id: orgId.value,
        name: form.club_name.trim(),
        type: 'VENUE',
        status: 'ACTIVE',
        parent_id: null,
        max_concurrent: 1,
        is_public: true,
        is_master: true,
        main_image: form.main_image || null,
      }).select('id').single()
      if (clubErr || !club?.id) throw clubErr ?? new Error('Could not create club')
      parentId = club.id
    }

    // 2) For every area: create one master venue + (count-1) linked
    //    siblings, an activity matching the area name, the area's
    //    captured modes (or a default "Default" mode if none), the
    //    join row per sibling, and one OPEN availability rule per
    //    sibling so the booker has slots to render.
    const isAlways = form.availability_mode === 'ALWAYS'
    const days = isAlways ? [0, 1, 2, 3, 4, 5, 6] : form.days
    const fromTime = isAlways ? '00:00' : form.time_from
    const toTime = isAlways ? '23:59' : form.time_to

    for (const area of form.areas) {
      const baseName = area.name.trim()
      const count = Math.max(1, area.count || 1)
      const venueIds: string[] = []
      for (let i = 0; i < count; i++) {
        const isMaster = i === 0
        const name = count === 1 ? baseName : `${baseName} ${i + 1}`
        const { data, error } = await (db.from as any)('bookables').insert({
          org_id: orgId.value,
          name,
          type: 'VENUE',
          status: 'ACTIVE',
          parent_id: parentId,
          max_concurrent: area.max_concurrent || 1,
          is_public: true,
          is_master: isMaster,
          master_id: isMaster ? null : venueIds[0],
        }).select('id').single()
        if (error || !data?.id) throw error ?? new Error(`Could not create ${baseName}`)
        venueIds.push(data.id)
      }

      // One activity per area, named after the area.
      const { data: act, error: actErr } = await (db.from as any)('activities').insert({
        org_id: orgId.value,
        name: baseName,
        status: 'ACTIVE',
      }).select('id').single()
      if (actErr || !act?.id) throw actErr ?? new Error(`Could not create activity for ${baseName}`)

      // Modes — captured ones if any, otherwise a single "Default" so
      // the activity is bookable end-to-end without a follow-up trip
      // to the editor.
      const modeRows = area.modes.length
        ? area.modes.map((m, sort_order) => ({
            activity_id: act.id,
            name: m.name,
            description: m.description || null,
            color: m.color,
            min_people: m.min_people,
            max_people: m.max_people,
            allow_visitors: m.allow_visitors,
            pricing: m.default_price != null ? { default: m.default_price } : {},
            sort_order,
          }))
        : [{ activity_id: act.id, name: 'Default' }]
      await (db.from as any)('activity_modes').insert(modeRows)

      // Activity ↔ bookable joins.
      await (db.from as any)('activity_bookables').insert(
        venueIds.map(vid => ({ activity_id: act.id, bookable_id: vid })),
      )

      // Availability — one OPEN row per sibling so the calendar has
      // something to render. Without this, the scheduler sees zero
      // slots and the venue is effectively unbookable.
      await (db.from as any)('availability_rules').insert(
        venueIds.map(vid => ({
          bookable_id: vid,
          name: isAlways ? 'Always open' : 'Open hours',
          rule_type: 'OPEN',
          days_of_week: days,
          time_slots: [{ from: fromTime, to: toTime }],
          time_from: fromTime,
          time_to: toTime,
          is_active: true,
        })),
      )
    }

    const totalVenues = form.areas.reduce((sum, a) => sum + a.count, 0)
    toast.add({
      severity: 'success',
      summary: form.club_name.trim() ? 'Club created' : `${totalVenues} venue${totalVenues === 1 ? '' : 's'} created`,
      life: 2500,
    })
    await navigateTo('/bookables')
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Could not create', detail: e?.message ?? 'Unknown error', life: 4000 })
  } finally {
    creating.value = false
  }
}
</script>

<style scoped>
.reveal-enter-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.reveal-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
.reveal-enter-to {
  opacity: 1;
  transform: translateY(0);
}
</style>
