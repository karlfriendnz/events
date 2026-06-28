<template>
  <div class="flex-1 flex flex-col bg-[#F5F8FA] min-h-0">
    <div class="flex-1 overflow-y-auto px-4 sm:px-6 py-6"
      :class="props.embedded ? '' : 'max-w-6xl mx-auto w-full'">

      <!-- Header -->
      <div class="flex items-center gap-3 mb-5 shrink-0">
        <button v-if="showBackToPicker" type="button"
          class="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors shrink-0"
          aria-label="Back to picker"
          @click="emit('back')">
          <i class="pi pi-arrow-left text-sm" />
        </button>
        <div class="flex-1 min-w-0">
          <h1 class="text-lg sm:text-xl font-bold text-gray-900 leading-tight tracking-tight">
            Hire {{ activityName || 'an item' }}
          </h1>
          <p class="text-xs text-gray-500 mt-0.5">Pick a rate, choose when, and confirm.</p>
        </div>
      </div>

      <div v-if="loading" class="text-sm text-gray-400 py-8 text-center">Loading…</div>
      <div v-else-if="!modes.length" class="text-sm text-gray-400 py-8 text-center">
        No rental rates configured for this activity yet.
      </div>

      <!-- ── Two-column body ── left = booking config, right = person + total ── -->
      <div v-else class="flex flex-col lg:flex-row gap-5 items-start">

        <!-- ─────── LEFT: rate / when / which one ─────── -->
        <div class="flex-1 min-w-0 space-y-5 w-full">
          <!-- Step 1: rate cards -->
          <section class="bg-white rounded-xl border border-gray-200 p-5">
            <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.14em] mb-3">1 · Pick a rate</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button v-for="m in modes" :key="m.id" type="button"
                class="text-left flex flex-col gap-1.5 px-4 py-3 rounded-xl border-2 transition-all"
                :class="pickedMode?.id === m.id
                  ? 'border-primary bg-primary/[0.04]'
                  : 'border-gray-100 hover:border-gray-200 bg-white'"
                @click="pickMode(m)">
                <div class="flex items-baseline gap-2">
                  <span class="text-base font-bold text-gray-900">{{ m.name }}</span>
                  <span v-if="m.term_type === 'recurring'"
                    class="text-[10px] font-bold uppercase tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-1.5 py-0.5">
                    Rolling
                  </span>
                </div>
                <p class="text-sm text-gray-500">
                  <span class="font-semibold text-gray-800">${{ m.period_price ?? 0 }}</span>
                  <span> / {{ periodLabel(m, true) }}</span>
                </p>
                <p v-if="m.term_type === 'recurring'" class="text-[11px] text-gray-400">
                  Renews every {{ periodLabel(m, false) }} until you cancel.
                </p>
                <p v-else class="text-[11px] text-gray-400">
                  One-off rental — pick how many.
                </p>
              </button>
            </div>
          </section>

          <!-- Step 2: when -->
          <section v-if="pickedMode" class="bg-white rounded-xl border border-gray-200 p-5">
            <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.14em] mb-3">2 · When</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="text-xs font-semibold text-gray-600 mb-1.5 block">
                  Start {{ pickedMode.period_unit === 'hour' ? 'date & time' : 'date' }}
                </label>
                <DatePicker v-model="startAt"
                  :show-time="pickedMode.period_unit === 'hour'"
                  :hour-format="'12'"
                  :min-date="today"
                  date-format="d M yy" class="w-full" />
              </div>
              <div v-if="pickedMode.term_type === 'fixed'">
                <label class="text-xs font-semibold text-gray-600 mb-1.5 block">
                  Number of {{ periodLabel(pickedMode, false) }}s
                </label>
                <InputNumber v-model="periods" :min="1" :max="52" show-buttons button-layout="horizontal"
                  decrement-button-class="!h-9 !w-9" increment-button-class="!h-9 !w-9"
                  input-class="!h-9 !w-16 !text-center !text-sm !font-semibold" class="w-full" />
              </div>
            </div>

            <div v-if="endAt" class="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 leading-relaxed">
              <span class="font-semibold text-gray-500 uppercase tracking-wider mr-2 text-[10px]">Period</span>
              <span>{{ formatDate(startAt) }} → {{ formatDate(endAt) }}</span>
              <span v-if="pickedMode.term_type === 'recurring'" class="text-emerald-600 ml-2">(rolls forward)</span>
            </div>
          </section>

          <!-- Step 3: which unit -->
          <section v-if="pickedMode && unitOptions.length > 1" class="bg-white rounded-xl border border-gray-200 p-5">
            <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.14em] mb-3">3 · Which one</p>

            <p v-if="assignmentMode === 'member'" class="text-xs text-gray-500 mb-2">
              Pick the {{ activityNoun.toLowerCase() }} you want.
            </p>
            <p v-else class="text-xs text-gray-500 mb-2">
              We'll assign one automatically, or pick a specific {{ activityNoun.toLowerCase() }}.
            </p>

            <Select v-model="pickedUnitId" :options="unitOptions" option-label="label" option-value="id"
              placeholder="Choose…" class="w-full sm:w-72" />

            <p v-if="pickedUnitId && pickedUnitId !== AUTO_UNIT_ID && !isUnitAvailable(pickedUnitId)"
              class="text-xs text-red-500 mt-2">
              This {{ activityNoun.toLowerCase() }} is already booked for that period.
            </p>
          </section>
        </div>

        <!-- ─────── RIGHT: auth chooser → details + total + confirm ─────── -->
        <aside class="w-full lg:w-96 lg:shrink-0 lg:sticky lg:top-6 space-y-5">
          <!-- AUTH step: the reusable chooser is the universal entry
               point. Staff land on it too and typically pick "Continue
               as guest" to type the member's details directly. -->
          <section v-if="panelStep === 'auth'" class="bg-white rounded-xl border border-gray-200 p-5">
            <BookingAuthChooser ref="authChooserRef"
              :org-id="orgId"
              :staff="staff"
              :can-go-back="false"
              :guest-label="staff ? 'Type member details' : 'Continue as guest'"
              :guest-description="staff ? 'Fill in the member\'s name and email.' : 'Just fill in a quick form.'"
              title="How would you like to book?"
              subtitle="Sign in for faster checkout, or carry on as a guest."
              @select-guest="panelStep = 'details'"
              @signed-in="onSignedIn" />
          </section>

          <!-- DETAILS step: contact form + total + confirm. -->
          <template v-if="panelStep === 'details'">
            <section class="bg-white rounded-xl border border-gray-200 p-5">
              <div class="flex items-center justify-between gap-3 mb-1">
                <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.14em]">
                  {{ staff ? 'Member details' : 'Your details' }}
                </p>
                <button type="button"
                  class="text-[11px] font-semibold text-gray-400 hover:text-gray-600 transition-colors"
                  @click="backToAuth">
                  Change
                </button>
              </div>
              <div v-if="signedInEmail"
                class="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 flex items-center gap-2 mb-3 mt-2">
                <i class="pi pi-check-circle text-emerald-600 text-sm" />
                <p class="text-xs text-emerald-700">Signed in as <span class="font-semibold">{{ signedInEmail }}</span></p>
              </div>
              <p v-else-if="staff" class="text-xs text-gray-500 mb-3">
                Who is renting this {{ activityNoun.toLowerCase() }}?
              </p>
              <p v-else class="text-xs text-gray-500 mb-3">
                So we know who the {{ activityNoun.toLowerCase() }} belongs to.
              </p>

              <!-- Pulls in the picked mode's `form_id` form when set;
                   otherwise renders a default First/Last/Email/Phone. -->
              <BookingFormFields ref="formFieldsRef"
                :form-id="pickedMode?.form_id ?? null"
                :prefill="formPrefill"
                @change="onFormChange" />
            </section>

            <section class="bg-white rounded-xl border border-gray-200 p-5">
              <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.14em] mb-1">Total</p>
              <p v-if="pickedMode" class="text-2xl font-bold text-gray-900 tracking-tight">
                ${{ totalPrice.toFixed(2) }}
                <span v-if="pickedMode.term_type === 'recurring'"
                  class="text-sm font-medium text-gray-400">/ {{ periodLabel(pickedMode, false) }}</span>
              </p>
              <p v-else class="text-sm text-gray-400 mt-1">Pick a rate to see your total.</p>

              <button type="button"
                class="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white shadow-sm transition-all"
                :class="canConfirm
                  ? 'bg-primary hover:bg-[#161A45] hover:shadow-md'
                  : 'bg-gray-300 cursor-not-allowed'"
                :disabled="!canConfirm || submitting"
                @click="submit">
                <i v-if="submitting" class="pi pi-spin pi-spinner text-[11px]" />
                <span>{{ submitting ? 'Booking…' : 'Confirm rental' }}</span>
                <i v-if="!submitting" class="pi pi-arrow-right text-[11px]" />
              </button>
            </section>
          </template>
        </aside>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  activityId: string
  staff?: boolean
  showBackToPicker?: boolean
  embedded?: boolean
}>()
const emit = defineEmits<{
  (e: 'back'): void
  (e: 'cancel'): void
  (e: 'done', payload: { bookingId: string }): void
}>()

const db = useDb()
const { orgId } = useOrg()
const toast = useToast()

// ── Data ─────────────────────────────────────────────────────────────────
const loading = ref(true)
const submitting = ref(false)
const activity = ref<any | null>(null)
const modes = ref<any[]>([])
// Bookables linked to this activity. For multi-unit items (lockers) the
// children carry the rentable rows; for single-unit items (projector) the
// parent itself is the bookable.
const linkedBookables = ref<any[]>([])
const childBookables = ref<any[]>([])
const existingBookings = ref<any[]>([])

const activityName = computed(() => activity.value?.name ?? '')
const activityNoun = computed(() => activity.value?.area_name_singular || 'item')
const assignmentMode = computed<'system' | 'member' | 'either'>(() => activity.value?.assignment_mode ?? 'either')

// ── Selection state ──────────────────────────────────────────────────────
const pickedMode = ref<any | null>(null)
const startAt = ref<Date | null>(null)
const periods = ref(1)
const pickedUnitId = ref<string | null>(null)
// Contact answers are owned by <BookingFormFields> (the activity mode's
// `form_id` form, or a default First/Last/Email/Phone fallback). We keep
// a flat snapshot of the resolved core values + the form's validity to
// drive the Confirm button + the booking insert payload.
const formCoreValues = ref<Record<string, any>>({})
const formIsValid = ref(false)
const formFieldsRef = ref<{ coreValues: () => Record<string, any>; isValid: () => boolean; rawAnswers: () => Record<string, any> } | null>(null)

const contactName = computed(() => {
  const c = formCoreValues.value
  const composite = [c.first_name, c.last_name].filter(Boolean).join(' ').trim()
  return composite || (c.full_name ?? '')
})
const contactEmail = computed(() => formCoreValues.value.email ?? '')
const contactPhone = computed(() => formCoreValues.value.phone ?? '')

// Prefill object passed into BookingFormFields. Updated when the user
// signs in / picks a member so the resolved form fields land prefilled.
const formPrefill = ref<Record<string, string | null>>({})

function onFormChange(payload: { coreValues: Record<string, any>; isValid: boolean }) {
  formCoreValues.value = payload.coreValues
  formIsValid.value = payload.isValid
}

// Right-rail state machine — both staff and public start on 'auth' and
// move to 'details' once they pick guest or sign in. The chooser is the
// universal entry point so staff get the same affordance to sign in as a
// member if they're handing the screen over.
const panelStep = ref<'auth' | 'details'>('auth')
const signedInEmail = ref<string | null>(null)
// Who the rental is FOR (act-on-behalf) — set by the auth chooser's picker.
const subjectPersonId = ref<string | null>(null)
const authChooserRef = ref<{ reset: () => void } | null>(null)

function onSignedIn(payload: { email: string; firstName: string; lastName: string; phone: string | null; subjectPersonId?: string | null }) {
  signedInEmail.value = payload.email || null
  subjectPersonId.value = payload.subjectPersonId ?? null
  // Push prefill values into the form. Match the same core keys
  // BookingFormFields expects (first_name / last_name / email / phone).
  formPrefill.value = {
    first_name: payload.firstName ?? '',
    last_name: payload.lastName ?? '',
    email: payload.email ?? '',
    phone: payload.phone ?? '',
  }
  panelStep.value = 'details'
}

function backToAuth() {
  signedInEmail.value = null
  formPrefill.value = {}
  authChooserRef.value?.reset()
  panelStep.value = 'auth'
}

// (Member picker now lives inside <BookingAuthChooser> — picking a
//  member fires its built-in @signed-in event with the same shape used
//  by OTP / password sign-in, so onSignedIn handles all three paths.)

const today = computed(() => {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d
})

const AUTO_UNIT_ID = '__auto__'

// All physically rentable rows. If the parent has children, those ARE the
// units; otherwise the parent itself is the unit.
const allUnits = computed<any[]>(() => {
  const out: any[] = []
  for (const parent of linkedBookables.value) {
    const kids = childBookables.value.filter(c => c.parent_id === parent.id)
    if (kids.length) out.push(...kids)
    else out.push(parent)
  }
  return out
})

// Dropdown options — driven by activity.assignment_mode.
const unitOptions = computed(() => {
  const opts: { id: string; label: string }[] = []
  if (assignmentMode.value !== 'member') {
    opts.push({ id: AUTO_UNIT_ID, label: 'Assign me one' })
  }
  if (assignmentMode.value !== 'system') {
    for (const u of allUnits.value) opts.push({ id: u.id, label: u.name })
  }
  return opts
})

// ── Period maths ─────────────────────────────────────────────────────────
function periodLabel(m: any, plural: boolean): string {
  const unit = m?.period_unit ?? 'day'
  const count = m?.period_count ?? 1
  const base = unit === 'hour' ? 'hour' : unit === 'day' ? 'day' : unit === 'week' ? 'week' : unit === 'month' ? 'month' : 'year'
  if (count === 1) return plural ? base : base
  return plural ? `${count} ${base}s` : `${count}-${base}`
}

const endAt = computed<Date | null>(() => {
  if (!pickedMode.value || !startAt.value) return null
  const m = pickedMode.value
  const n = m.term_type === 'fixed' ? (periods.value || 1) : 1
  const totalUnits = (m.period_count ?? 1) * n
  const d = new Date(startAt.value)
  switch (m.period_unit) {
    case 'hour':  d.setHours(d.getHours() + totalUnits); break
    case 'day':   d.setDate(d.getDate() + totalUnits); break
    case 'week':  d.setDate(d.getDate() + 7 * totalUnits); break
    case 'month': d.setMonth(d.getMonth() + totalUnits); break
    case 'year':  d.setFullYear(d.getFullYear() + totalUnits); break
  }
  return d
})

const totalPrice = computed(() => {
  if (!pickedMode.value) return 0
  const rate = Number(pickedMode.value.period_price ?? 0)
  const n = pickedMode.value.term_type === 'fixed' ? (periods.value || 1) : 1
  return rate * n
})

// ── Availability check (per unit) ────────────────────────────────────────
function unitOverlapsExisting(unitId: string): boolean {
  if (!startAt.value || !endAt.value) return false
  const s = startAt.value.getTime()
  const e = endAt.value.getTime()
  for (const b of existingBookings.value) {
    if (b.bookable_id !== unitId) continue
    const bs = new Date(b.start_at).getTime()
    const be = new Date(b.end_at).getTime()
    if (bs < e && be > s) return true
  }
  return false
}
function isUnitAvailable(unitId: string): boolean {
  return !unitOverlapsExisting(unitId)
}
function pickAutoUnit(): any | null {
  for (const u of allUnits.value) {
    if (!unitOverlapsExisting(u.id)) return u
  }
  return null
}

const canConfirm = computed(() => {
  if (!pickedMode.value || !startAt.value || !endAt.value) return false
  if (unitOptions.value.length > 1 && !pickedUnitId.value) return false
  if (pickedUnitId.value && pickedUnitId.value !== AUTO_UNIT_ID && !isUnitAvailable(pickedUnitId.value)) return false
  if (pickedUnitId.value === AUTO_UNIT_ID && !pickAutoUnit()) return false
  // Contact details — defer to the form's own validity (handles required
  // fields whether the mode has a custom form or the default fallback).
  if (panelStep.value !== 'details') return false
  if (!formIsValid.value) return false
  return true
})

// ── Loaders ──────────────────────────────────────────────────────────────
async function load() {
  if (!props.activityId) return
  loading.value = true
  try {
    const [{ data: act }, { data: ms }, { data: ab }] = await Promise.all([
      (db.from as any)('activities')
        .select('id, name, color, icon, area_name_singular, area_name_plural, assignment_mode, booking_flow, org_id')
        .eq('id', props.activityId).single(),
      (db.from as any)('activity_modes')
        .select('id, name, color, period_unit, period_count, term_type, period_price, sort_order, form_id')
        .eq('activity_id', props.activityId)
        .not('period_unit', 'is', null)
        .order('sort_order'),
      (db.from as any)('activity_bookables')
        .select('bookable_id')
        .eq('activity_id', props.activityId),
    ])
    activity.value = act ?? null
    modes.value = ms ?? []
    const parentIds = (ab ?? []).map((r: any) => r.bookable_id)
    if (parentIds.length) {
      const { data: pb } = await (db.from as any)('bookables')
        .select('id, name, parent_id, max_concurrent, status')
        .in('id', parentIds)
      linkedBookables.value = (pb ?? []).filter((b: any) => b.status !== 'ARCHIVED')
      const { data: cb } = await (db.from as any)('bookables')
        .select('id, name, parent_id, status')
        .in('parent_id', parentIds)
      childBookables.value = (cb ?? []).filter((b: any) => b.status !== 'ARCHIVED')
    } else {
      linkedBookables.value = []
      childBookables.value = []
    }
    // Default unit selection — pre-pick the only option for single-unit
    // setups (no dropdown needed) so the user goes straight to confirm.
    if (unitOptions.value.length === 1) pickedUnitId.value = unitOptions.value[0].id
  } finally {
    loading.value = false
  }
}

// Re-load existing bookings whenever the time window changes — used to
// validate the dropdown options + auto-assign.
async function loadBookingsForWindow() {
  if (!startAt.value || !endAt.value) { existingBookings.value = []; return }
  const ids = allUnits.value.map(u => u.id)
  if (!ids.length) return
  const winStart = new Date(startAt.value); winStart.setHours(0, 0, 0, 0)
  const winEnd = new Date(endAt.value); winEnd.setDate(winEnd.getDate() + 1)
  const { data } = await (db.from as any)('bookings')
    .select('id, bookable_id, start_at, end_at, status')
    .in('bookable_id', ids)
    .lt('start_at', winEnd.toISOString())
    .gt('end_at', winStart.toISOString())
    .neq('status', 'CANCELLED')
  existingBookings.value = data ?? []
}

watch([startAt, endAt], () => { loadBookingsForWindow() })

watch(() => props.activityId, () => {
  pickedMode.value = null; startAt.value = null; periods.value = 1; pickedUnitId.value = null
  load()
}, { immediate: true })

function pickMode(m: any) {
  pickedMode.value = m
  // Default start = today at next round hour for hourly modes, midnight
  // otherwise, so the picker has something sane on first open.
  if (!startAt.value) {
    const d = new Date()
    if (m.period_unit === 'hour') {
      d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1)
    } else {
      d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 1)
    }
    startAt.value = d
  }
}

function formatDate(d: Date | null): string {
  if (!d) return ''
  return d.toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

// ── Submit ───────────────────────────────────────────────────────────────
async function submit() {
  if (!canConfirm.value || !pickedMode.value || !startAt.value || !endAt.value || !orgId.value) return
  submitting.value = true
  try {
    // Resolve which physical unit gets booked.
    let unit: any | null = null
    if (pickedUnitId.value === AUTO_UNIT_ID || (unitOptions.value.length === 1 && pickedUnitId.value === AUTO_UNIT_ID)) {
      unit = pickAutoUnit()
    } else if (pickedUnitId.value) {
      unit = allUnits.value.find(u => u.id === pickedUnitId.value) ?? null
    } else if (allUnits.value.length === 1) {
      unit = allUnits.value[0]
    }
    if (!unit) {
      toast.add({ severity: 'error', summary: 'Sold out', detail: 'No available unit for that period.', life: 4000 })
      return
    }
    // Belt-and-braces overlap check — re-fetch right before insert in case
    // another booking landed during the user's selection.
    await loadBookingsForWindow()
    if (unitOverlapsExisting(unit.id)) {
      toast.add({ severity: 'error', summary: 'Just taken', detail: 'Someone booked that unit while you were deciding.', life: 4000 })
      return
    }

    const payload: any = {
      // bookings is scoped via bookable_id → bookables.org_id, no org_id
      // column on the bookings table itself.
      activity_id: activity.value.id,
      activity_mode_id: pickedMode.value.id,
      bookable_id: unit.id,
      // type enum: 'ONE_OFF' is the right value even for our recurring
      // rentals — the existing 'RECURRING' enum means a recurrence_rule-
      // driven schedule (weekly standing bookings), which is a different
      // concept. is_recurring is the flag for rolling rentals.
      type: 'ONE_OFF',
      start_at: startAt.value.toISOString(),
      end_at: endAt.value.toISOString(),
      status: 'CONFIRMED',
      is_recurring: pickedMode.value.term_type === 'recurring',
      contact_name: contactName.value || null,
      contact_email: contactEmail.value || null,
      contact_phone: contactPhone.value || null,
      subject_person_id: subjectPersonId.value,
    }
    const { data, error } = await (db.from as any)('bookings').insert(payload).select('id').single()
    if (error) throw error
    if (data?.id) {
      $fetch('/api/finalize-access', { method: 'POST', body: { bookingId: data.id } }).catch(() => {})
    }
    toast.add({ severity: 'success', summary: 'Booked', detail: `${activity.value.name} · ${unit.name}`, life: 4000 })
    emit('done', { bookingId: data.id })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Could not book', detail: e?.data?.message ?? e?.message ?? 'Unknown error', life: 6000 })
  } finally {
    submitting.value = false
  }
}
</script>
