<template>
  <Dialog :visible="visible" @update:visible="$emit('update:visible', $event)"
    modal :show-header="false" :dismissable-mask="!creating"
    :style="{ width: 'min(940px, 95vw)' }"
    :content-style="{ padding: 0 }"
    :pt="{ root: { class: 'coach-wizard-dialog' } }">
    <div class="flex flex-col sm:flex-row min-h-[680px]">

      <!-- LEFT: preset list -->
      <aside class="w-full sm:w-60 shrink-0 border-r border-gray-100 bg-gray-50/40 sm:py-5 py-3">
        <div class="px-5 pt-1 pb-4">
          <p class="text-base font-bold text-gray-900 leading-tight">Add a coach</p>
          <p class="text-xs text-gray-400 mt-0.5 leading-snug">
            Set up the staff member, their offerings, and rates in one go.
          </p>
        </div>
        <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-5 pb-2">Discipline</p>
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
            <p class="text-[11px] font-semibold text-primary uppercase tracking-[0.18em]">Coach setup</p>
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

          <!-- Section 1: contact -->
          <section>
            <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.14em] mb-2">1 · About the coach</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="text-xs font-semibold text-gray-600 mb-1.5 block">Full name <span class="text-red-400">*</span></label>
                <input v-model="coachName" type="text" placeholder="e.g. Sarah Smith"
                  class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-shadow" />
              </div>
              <div>
                <label class="text-xs font-semibold text-gray-600 mb-1.5 block">Email <span class="text-gray-300 font-normal">(optional)</span></label>
                <input v-model="coachEmail" type="email" placeholder="sarah@club.com"
                  class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-shadow" />
              </div>
              <div>
                <label class="text-xs font-semibold text-gray-600 mb-1.5 block">Phone <span class="text-gray-300 font-normal">(optional)</span></label>
                <input v-model="coachPhone" type="tel" placeholder="+64…"
                  class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-shadow" />
              </div>
              <div>
                <label class="text-xs font-semibold text-gray-600 mb-1.5 block">Service category</label>
                <input v-model="category" type="text" :placeholder="preset.defaultCategory"
                  class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-shadow" />
                <p class="text-[11px] text-gray-400 mt-1">
                  Drives the booker's "By service" filter. Edit individual modes later for finer-grained tagging.
                </p>
              </div>
            </div>
          </section>

          <!-- Section 2: rates -->
          <section>
            <div class="flex items-baseline justify-between mb-2">
              <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.14em]">2 · Offerings</p>
              <button type="button" class="text-xs font-medium text-primary hover:text-[#2a2f6e] flex items-center gap-1"
                @click="addRate">
                <i class="pi pi-plus text-[10px]" /> Add option
              </button>
            </div>
            <p class="text-xs text-gray-500 mb-3">What this coach can be booked for. Each row is a hireable session — edit prices and durations later if needed.</p>

            <div v-if="!rates.length" class="text-xs text-gray-400 py-4 text-center border border-dashed border-gray-200 rounded-lg">
              No options yet — pick a discipline on the left or add one manually.
            </div>
            <div v-else class="space-y-2">
              <div v-for="(r, i) in rates" :key="r.id"
                class="border border-gray-200 rounded-xl bg-white px-4 py-3">
                <div class="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-3 items-end">
                  <div>
                    <label class="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Name</label>
                    <input v-model="r.name" type="text"
                      class="w-full h-8 px-2 text-sm border border-gray-200 rounded-md outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
                  </div>
                  <div class="flex items-end gap-1">
                    <div>
                      <label class="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Every</label>
                      <InputNumber v-model="r.period_count" :min="1" :max="120"
                        input-class="!h-8 !w-12 !text-center !text-sm" class="w-12" />
                    </div>
                    <div>
                      <label class="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Unit</label>
                      <Select v-model="r.period_unit" :options="UNIT_OPTIONS" option-label="label" option-value="value"
                        size="small" class="w-24" />
                    </div>
                  </div>
                  <div>
                    <label class="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Price</label>
                    <div class="flex items-center gap-1">
                      <span class="text-sm text-gray-400">$</span>
                      <InputNumber v-model="r.period_price" :min="0" :max-fraction-digits="2"
                        input-class="!h-8 !w-20 !text-right !text-sm" class="w-20" />
                    </div>
                  </div>
                  <button type="button"
                    class="w-8 h-8 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center"
                    @click="removeRate(i)" aria-label="Remove option">
                    <i class="pi pi-times text-xs" />
                  </button>
                </div>
              </div>
            </div>
          </section>

          <!-- Section 3: summary -->
          <section class="rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
            <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.14em] mb-2">Plan</p>
            <ul class="text-sm space-y-1.5">
              <li class="flex items-start gap-2">
                <i class="pi pi-check-circle text-emerald-500 text-xs mt-0.5" />
                <span>Coach <span class="font-semibold text-gray-900">"{{ coachName || 'Untitled' }}"</span> created (PERSON bookable)</span>
              </li>
              <li class="flex items-start gap-2">
                <i class="pi pi-check-circle text-emerald-500 text-xs mt-0.5" />
                <span>Their owning activity is set up + linked, ready for bookings</span>
              </li>
              <li v-if="rates.length" class="flex items-start gap-2">
                <i class="pi pi-check-circle text-emerald-500 text-xs mt-0.5" />
                <span><span class="font-semibold text-gray-900">{{ rates.length }}</span> offering{{ rates.length === 1 ? '' : 's' }} ready to book{{ effectiveCategory ? ` under "${effectiveCategory}"` : '' }}</span>
              </li>
              <li v-else class="flex items-start gap-2 text-amber-700">
                <i class="pi pi-exclamation-circle text-amber-500 text-xs mt-0.5" />
                <span>Add at least one offering, or do it later from the coach's profile.</span>
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
            <span>{{ creating ? 'Creating…' : 'Create coach' }}</span>
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
  (e: 'done', payload: { bookableId: string; activityId: string }): void
}>()

const db = useDb()
const { orgId } = useOrg()
const toast = useToast()

// ── Catalogue ─────────────────────────────────────────────────────────────
type Unit = 'hour' | 'day' | 'week' | 'month' | 'year'
interface DraftRate { id: string; name: string; period_unit: Unit; period_count: number; period_price: number }
interface CoachPreset {
  type: string
  name: string
  icon: string
  description: string
  defaultCategory: string
  defaultRates: Omit<DraftRate, 'id'>[]
}

const PRESETS: CoachPreset[] = [
  {
    type: 'tennis', name: 'Tennis coach', icon: '🎾',
    description: 'Court-based coaching — typically 30-min or 60-min lessons.',
    defaultCategory: 'Tennis',
    defaultRates: [
      { name: '30-min lesson', period_unit: 'hour', period_count: 1, period_price: 60 },
      { name: '60-min lesson', period_unit: 'hour', period_count: 1, period_price: 100 },
    ],
  },
  {
    type: 'swim', name: 'Swimming coach', icon: '🏊',
    description: 'Pool-based coaching — needs a lane reserved alongside the booking.',
    defaultCategory: 'Swimming',
    defaultRates: [
      { name: 'Stroke clinic', period_unit: 'hour', period_count: 1, period_price: 70 },
      { name: 'Squad coaching', period_unit: 'hour', period_count: 1, period_price: 50 },
    ],
  },
  {
    type: 'pt', name: 'Personal trainer', icon: '💪',
    description: 'One-on-one or small group fitness sessions.',
    defaultCategory: 'Personal Training',
    defaultRates: [
      { name: '1-on-1 PT', period_unit: 'hour', period_count: 1, period_price: 80 },
      { name: 'Couples PT',  period_unit: 'hour', period_count: 1, period_price: 120 },
    ],
  },
  {
    type: 'yoga', name: 'Yoga / Pilates instructor', icon: '🧘',
    description: 'Class-based or private instruction.',
    defaultCategory: 'Yoga',
    defaultRates: [
      { name: 'Group class',     period_unit: 'hour', period_count: 1, period_price: 25 },
      { name: 'Private session', period_unit: 'hour', period_count: 1, period_price: 75 },
    ],
  },
  {
    type: 'football', name: 'Football coach', icon: '⚽',
    description: 'Field-based coaching — typically blocked alongside a pitch.',
    defaultCategory: 'Football',
    defaultRates: [
      { name: 'Skills session', period_unit: 'hour', period_count: 1, period_price: 50 },
      { name: 'Team training',  period_unit: 'hour', period_count: 1, period_price: 90 },
    ],
  },
  {
    type: 'custom', name: 'Custom', icon: '✨',
    description: 'Anything else — start blank and configure as you go.',
    defaultCategory: '',
    defaultRates: [
      { name: 'Session', period_unit: 'hour', period_count: 1, period_price: 0 },
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

// ── Local state ───────────────────────────────────────────────────────────
const selectedType = ref<string>('tennis')
const preset = computed(() => PRESETS.find(p => p.type === selectedType.value) ?? PRESETS[0])
const coachName = ref('')
const coachEmail = ref('')
const coachPhone = ref('')
const category = ref(PRESETS[0].defaultCategory)
const rates = ref<DraftRate[]>(PRESETS[0].defaultRates.map(r => ({ ...r, id: cryptoId() })))
const creating = ref(false)

const effectiveCategory = computed(() => category.value.trim() || preset.value.defaultCategory)

function cryptoId() {
  return Math.random().toString(36).slice(2, 10)
}
function selectPreset(t: string) {
  selectedType.value = t
  const p = PRESETS.find(x => x.type === t)
  if (!p) return
  category.value = p.defaultCategory
  rates.value = p.defaultRates.map(r => ({ ...r, id: cryptoId() }))
}
function addRate() {
  rates.value.push({ id: cryptoId(), name: 'New option', period_unit: 'hour', period_count: 1, period_price: 0 })
}
function removeRate(i: number) {
  rates.value.splice(i, 1)
}

const canCreate = computed(() =>
  !!coachName.value.trim() &&
  rates.value.every(r => r.name.trim() && r.period_price >= 0 && r.period_count >= 1),
)

// ── Apply ─────────────────────────────────────────────────────────────────
async function create() {
  if (!canCreate.value || !orgId.value) return
  creating.value = true
  try {
    // 1. PERSON bookable. Email + phone live in custom_fields for now —
    //    the bookables table itself has no dedicated contact columns
    //    yet; we can promote them later if it becomes load-bearing.
    const customFields: Record<string, any> = {}
    if (coachEmail.value.trim()) customFields.email = coachEmail.value.trim()
    if (coachPhone.value.trim()) customFields.phone = coachPhone.value.trim()

    const { data: bk, error: bkErr } = await (db.from as any)('bookables').insert({
      org_id: orgId.value,
      name: coachName.value.trim(),
      type: 'PERSON',
      status: 'ACTIVE',
      max_concurrent: 1,
      is_public: true,
      custom_fields: customFields,
    }).select('id').single()
    if (bkErr || !bk?.id) throw bkErr ?? new Error('Could not create coach bookable')
    const bookableId = bk.id as string

    // 2. Owning activity (one per coach — name = coach name).
    const { data: act, error: actErr } = await (db.from as any)('activities').insert({
      org_id: orgId.value,
      name: coachName.value.trim(),
      status: 'ACTIVE',
      bookings_enabled: true,
      booking_flow: 'wizard',
      require_mode: true,
      staff_bookable_id: bookableId,
    }).select('id').single()
    if (actErr || !act?.id) throw actErr ?? new Error('Could not create activity')
    const activityId = act.id as string

    // 3. Link the coach as the activity's bookable — no venue picker needed.
    await (db.from as any)('activity_bookables').insert({
      activity_id: activityId,
      bookable_id: bookableId,
    })

    // 4. Modes — each rate becomes one bookable mode under the activity.
    if (rates.value.length) {
      await (db.from as any)('activity_modes').insert(
        rates.value.map((r, i) => ({
          activity_id: activityId,
          name: r.name.trim(),
          period_unit: r.period_unit,
          period_count: r.period_count,
          term_type: 'fixed',
          period_price: r.period_price,
          category: effectiveCategory.value || null,
          sort_order: i,
        })),
      )
    }

    toast.add({
      severity: 'success',
      summary: 'Coach added',
      detail: `${coachName.value.trim()} is set up with ${rates.value.length} offering${rates.value.length === 1 ? '' : 's'}.`,
      life: 4000,
    })
    emit('done', { bookableId, activityId })
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
