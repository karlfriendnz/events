<!--
  <FormRenderer> — the LIVE, fillable counterpart to the FormDesigner preview.

  Reusable across the platform: the same registration_forms.config drives event
  registrations, group registrations, competition entries, website enquiries, etc.
  This component is context-agnostic — it reads a form `config` + a `context`
  ({ type, id, orgId }) and renders real, editable inputs for every subject /
  instance / field the builder defined, validates them, collects a normalised
  payload, and emits `@submit`. WHAT happens to that payload (persons, invitees,
  registrations, memberships…) is decided server-side by context_type.

  It deliberately does NOT fetch anything — the host page loads the form + context
  (and, for events, sessions + fee line items) and passes them in. That keeps the
  same renderer usable behind /r/event/:id, a group page, an enquiry widget, etc.

  Mirrors the builder's semantics:
    • subjects = config.groupProfiles[groupId]; fields = config.groupFields[groupId] (by `target`)
    • answers keyed by field LABEL per instance (matches evtPersonValues)
    • core identity fields carry `account` (first/last/email) → mapped to person cols
    • visibility_conditions evaluated per instance (same operators as the builder)
    • design.style === 'tabs' → step wizard; else single page
-->
<script setup lang="ts">
const props = defineProps<{
  config: any
  groupId?: string
  context: { type: string; id?: string | null; orgId: string }
  sessions?: any[]              // [{ id, title, start_at, fee, required, display }]
  feeLineItems?: { name: string; amount: number }[]
  currency?: string
  submitting?: boolean
  staff?: boolean               // staff-side: enables the "pick a member" control
  event?: any                   // drives the designed header chrome (banner/info/description)
}>()
const emit = defineEmits<{ (e: 'submit', payload: any): void }>()

const CORE_ACCOUNTS = ['first', 'last', 'email']

// ── Which group to render ────────────────────────────────────────────────────
const groups = computed<any[]>(() => props.config?.groups ?? [])
const activeGroupId = computed(() => {
  if (props.groupId) return props.groupId
  // Prefer a public/all-audience group, else the first.
  const pub = groups.value.find((g: any) => g.audience === 'public' || g.audience === 'all')
  return (pub ?? groups.value[0])?.id ?? ''
})

const design = computed(() => props.config?.designs?.[activeGroupId.value] ?? {})
const isWizard = computed(() => design.value?.style === 'tabs')
const formHeading = computed(() => design.value?.formHeading || 'Fill in the form to register')

// Designed header chrome — banner / info-icons / description / background, the same
// pieces the builder preview shows, so the live form looks like what was designed.
const showBanner = computed(() => design.value?.header === 'custom' ? !!design.value?.headerImage : !!(props.event?.banner_url || props.event?.title))
const hasInfoIcons = computed(() => {
  const ic = design.value?.icons || {}
  return !!props.event && (ic.date || ic.time || ic.cost || ic.location || ic.criteria)
})
const hasDescription = computed(() => {
  const d = design.value?.description
  return (d === 'event' && !!props.event?.description) || (d === 'custom' && !!design.value?.customDescription)
})
const bgStyle = computed(() => {
  const d = design.value
  if (d?.background === 'custom' && d?.backgroundImage) return { backgroundImage: `url('${d.backgroundImage}')`, backgroundSize: 'cover', backgroundPosition: 'center' }
  if (d?.background === 'colour' && d?.backgroundColor) return { background: d.backgroundColor }
  return {}
})
// Real cost label for the info row (no fake placeholder on a live form).
const costLabel = computed(() => !hasFees.value ? 'Free' : (baseFee.value > 0 ? money(baseFee.value) : 'Varies'))

// ── Subjects ─────────────────────────────────────────────────────────────────
const subjects = computed<any[]>(() => {
  const list = props.config?.groupProfiles?.[activeGroupId.value] ?? []
  return list.filter((p: any) => p && (p.label || p.key))
})
function subjectBounds(s: any) {
  const lo = Math.max(0, Number(s.min ?? 1) || 0)
  const hiRaw = s.max == null || s.max === '' ? null : Number(s.max)
  const hi = hiRaw && hiRaw > 0 ? hiRaw : null
  return { lo: lo || 1, hi }
}
const isEntity = (s: any) => (s.kind ?? '') === 'entity'

// Per-subject instance count (starts at min, clamped to max).
const counts = reactive<Record<string, number>>({})
function ensureCount(s: any) {
  const { lo } = subjectBounds(s)
  if (counts[s.key] == null) counts[s.key] = lo
}
watchEffect(() => { subjects.value.forEach(ensureCount) })
const count = (key: string) => counts[key] ?? 1
function canAdd(s: any) { const { hi } = subjectBounds(s); return !hi || count(s.key) < hi }
function addInstance(s: any) { if (canAdd(s)) counts[s.key] = count(s.key) + 1 }
function removeInstance(s: any, inst: number) {
  const { lo } = subjectBounds(s)
  if (count(s.key) <= lo) return
  // Splice this instance's answers out so the others keep their data.
  const arr = answers[s.key] ?? []
  arr.splice(inst - 1, 1)
  const sarr = sessionSel[s.key] ?? []
  sarr.splice(inst - 1, 1)
  counts[s.key] = count(s.key) - 1
}

// ── Fields for a subject ─────────────────────────────────────────────────────
const ELEMENT_TYPES = ['section', 'image', 'textblock', 'button']
function allFields(key: string): any[] {
  const fields = props.config?.groupFields?.[activeGroupId.value] ?? []
  return fields.filter((f: any) => (f.target || '') === key)
}
// Pinned (first/last name) lead; the rest follow in saved order.
function leadFields(key: string) { return allFields(key).filter((f: any) => f.pinned && !ELEMENT_TYPES.includes(f.field_type)) }
function bodyItems(key: string) {
  return allFields(key).filter((f: any) => !f.pinned && !f.parent_section)
}
function sectionChildren(key: string, sectionId: string) {
  return allFields(key).filter((f: any) => f.parent_section === sectionId)
}

// ── Answers (answers[subjectKey][inst-1][fieldLabel] = value) ─────────────────
const answers = reactive<Record<string, Record<string, any>[]>>({})
function instAnswers(key: string, inst: number) {
  if (!answers[key]) answers[key] = []
  if (!answers[key][inst - 1]) answers[key][inst - 1] = {}
  return answers[key][inst - 1]
}
function getVal(key: string, inst: number, label: string) { return instAnswers(key, inst)[label] }
function setVal(key: string, inst: number, label: string, v: any) { instAnswers(key, inst)[label] = v }

// ── Visibility conditions (same operators as the builder) ─────────────────────
function condPasses(conds: any[], key: string, inst: number) {
  return (conds ?? []).every((c: any) => {
    const val = getVal(key, inst, c.field) ?? ''
    if (c.operator === 'Is Empty') return !val
    if (c.operator === 'Is Not Empty') return !!val
    if (c.operator === 'Equals') return val === c.value
    if (c.operator === 'Is Not') return val !== c.value
    if (c.operator === 'Contains') return String(val).includes(c.value)
    return true
  })
}
function fieldVisible(field: any, key: string, inst: number) {
  return condPasses(field.visibility_conditions ?? [], key, inst)
}

// ── Sessions / fees ──────────────────────────────────────────────────────────
const choosers = computed(() => {
  const list = subjects.value.filter((s: any) => s.selectsOptions && !isEntity(s))
  return list.length ? list : subjects.value.filter((s: any) => !isEntity(s)).slice(0, 1)
})
const isChooser = (key: string) => choosers.value.some((s: any) => s.key === key)
const visibleSessions = computed<any[]>(() =>
  (props.sessions ?? []).filter((s: any) => s.display !== false)
)
function sessionSelected(key: string, inst: number, sid: string) {
  return !!(sessionSel[key]?.[inst - 1]?.[sid])
}
const sessionSel = reactive<Record<string, Record<string, boolean>[]>>({})
function toggleSession(key: string, inst: number, sid: string, on: boolean) {
  if (!sessionSel[key]) sessionSel[key] = []
  if (!sessionSel[key][inst - 1]) sessionSel[key][inst - 1] = {}
  sessionSel[key][inst - 1][sid] = on
}
const baseFee = computed(() => (props.feeLineItems ?? []).reduce((s, f) => s + (Number(f.amount) || 0), 0))
function instanceTotal(key: string, inst: number) {
  let total = baseFee.value
  for (const s of visibleSessions.value) {
    if (s.required || sessionSelected(key, inst, s.id)) total += Number(s.fee) || 0
  }
  return total
}
const grandTotal = computed(() => {
  let t = 0
  for (const s of choosers.value) for (let i = 1; i <= count(s.key); i++) t += instanceTotal(s.key, i)
  return t
})
const hasFees = computed(() => baseFee.value > 0 || visibleSessions.value.length > 0)
const cur = computed(() => props.currency || 'NZD')
function money(n: number) {
  try { return new Intl.NumberFormat('en-NZ', { style: 'currency', currency: cur.value }).format(n) }
  catch { return '$' + n.toFixed(2) }
}

// ── Payment + terms ──────────────────────────────────────────────────────────
const payment = computed(() => props.config?.payment ?? {})
const paymentMethods = computed(() => {
  const p = payment.value
  const out: { key: string; label: string }[] = []
  if (p.invoice?.enabled) out.push({ key: 'invoice', label: 'Pay by invoice' })
  if (p.credit_card?.enabled) out.push({ key: 'credit_card', label: 'Credit card' })
  if (p.plan?.enabled) out.push({ key: 'plan', label: 'Payment plan' })
  if (p.coupon?.enabled) out.push({ key: 'coupon', label: 'Coupon' })
  return out
})
const selectedPayment = ref('')
watchEffect(() => { if (!selectedPayment.value && paymentMethods.value.length) selectedPayment.value = paymentMethods.value[0].key })

const termsList = computed<string[]>(() => props.config?.terms ?? [])
const termsAccepted = ref(false)

// ── Step wizard ──────────────────────────────────────────────────────────────
const steps = computed(() => {
  const s = subjects.value.map((sub: any) => ({ kind: 'subject', subject: sub }))
  s.push({ kind: 'terms' } as any)
  return s
})
const step = ref(0)
watchEffect(() => { if (step.value > steps.value.length - 1) step.value = Math.max(0, steps.value.length - 1) })
const isTermsStep = (i: number) => steps.value[i]?.kind === 'terms'

// ── Validation ───────────────────────────────────────────────────────────────
const error = ref('')
function emailOk(v: string) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) }
function validate(): boolean {
  error.value = ''
  for (const s of subjects.value) {
    for (let inst = 1; inst <= count(s.key); inst++) {
      for (const f of allFields(s.key)) {
        if (ELEMENT_TYPES.includes(f.field_type) || f.system) continue
        if (!fieldVisible(f, s.key, inst)) continue
        const v = getVal(s.key, inst, f.label)
        if (f.is_required && (v == null || v === '' || v === false)) {
          error.value = `Please complete “${f.label}” for ${s.label}${count(s.key) > 1 ? ' ' + inst : ''}.`
          return false
        }
        if (f.field_type === 'email' && v && !emailOk(String(v))) {
          error.value = `“${f.label}” needs a valid email address.`
          return false
        }
      }
    }
  }
  if (termsList.value.length && !termsAccepted.value) { error.value = 'Please accept the terms to continue.'; return false }
  return true
}

// ── Build the normalised payload ─────────────────────────────────────────────
function instanceIdentity(key: string, inst: number) {
  // Map core (account-tagged / well-known) fields to person columns.
  const a = instAnswers(key, inst)
  const byAccount: Record<string, string> = {}
  for (const f of allFields(key)) if (f.account) byAccount[f.account] = a[f.label]
  return {
    first_name: byAccount.first ?? a['First Name'] ?? '',
    last_name: byAccount.last ?? a['Last Name'] ?? '',
    email: byAccount.email ?? a['Email'] ?? a['Email Address'] ?? '',
    phone: a['Phone'] ?? a['Phone Number'] ?? '',
  }
}
function buildPayload() {
  const subjectsOut = subjects.value.map((s: any) => ({
    key: s.key,
    label: s.label,
    kind: s.kind ?? 'person',
    instances: Array.from({ length: count(s.key) }, (_, i) => {
      const inst = i + 1
      const identity = isEntity(s) ? {} : instanceIdentity(s.key, inst)
      const fieldsOut: Record<string, any> = {}
      for (const f of allFields(s.key)) {
        if (ELEMENT_TYPES.includes(f.field_type)) continue
        const val = getVal(s.key, inst, f.label)
        if (val !== undefined) fieldsOut[f.label] = val
      }
      const sess = isChooser(s.key)
        ? visibleSessions.value.filter(x => x.required || sessionSelected(s.key, inst, x.id)).map(x => x.id)
        : []
      return { ...identity, fields: fieldsOut, sessions: sess, fee: isChooser(s.key) ? instanceTotal(s.key, inst) : 0 }
    }),
  }))
  const primary = subjectsOut.find(s => s.kind !== 'entity')?.instances?.[0]
  return {
    formId: props.config?._formId ?? null,
    context: props.context,
    groupId: activeGroupId.value,
    subjects: subjectsOut,
    payment: { method: selectedPayment.value || null },
    termsAccepted: termsList.value.length ? termsAccepted.value : null,
    totals: { total: grandTotal.value, currency: cur.value },
    submitter: primary
      ? { name: [primary.first_name, primary.last_name].filter(Boolean).join(' '), email: primary.email, phone: primary.phone }
      : null,
  }
}

// ── Identify the registrant → prefill their saved profile ─────────────────────
// The form opens with a chooser (continue as guest / sign in / staff member-pick).
// Guests get a blank form. Once a person is IDENTIFIED (verified sign-in or a
// staff member-pick — never raw email typing), we pull their full record and
// pre-fill every field they've already populated, not just their name.
const db = useDb()
const { resolveFields } = useOrgFieldPolicy()
const authResolved = ref(false)         // false → show the chooser; true → show the form
const identifiedName = ref('')          // non-empty → "Registering as …" banner
const labelToDefId = ref<Record<string, string>>({})

// Map answers ← person record. Person columns cover the core identity fields; the
// rest live in custom_fields keyed by field-definition id (with a label fallback).
const GENDER_FROM_DB: Record<string, string> = { MALE: 'Male', FEMALE: 'Female', NON_BINARY: 'Non-binary', UNSPECIFIED: 'Prefer not to say' }
function prefillPrimary(person: any) {
  const subject = subjects.value.find((s: any) => !isEntity(s))
  if (!subject || !person) return
  const cf = person.custom_fields ?? {}
  for (const f of allFields(subject.key)) {
    if (ELEMENT_TYPES.includes(f.field_type)) continue
    let v: any
    const label = f.label
    if (f.account === 'first' || label === 'First Name') v = person.first_name
    else if (f.account === 'last' || label === 'Last Name') v = person.last_name
    else if (f.account === 'email' || label === 'Email' || label === 'Email Address') v = person.email
    else if (label === 'Phone' || label === 'Phone Number') v = person.phone
    else if (label === 'Date of Birth') v = person.dob
    else if (label === 'Gender') v = GENDER_FROM_DB[person.gender] ?? person.gender
    else v = cf[labelToDefId.value[label]] ?? cf[label]
    if (v != null && v !== '') setVal(subject.key, 1, label, v)
  }
  identifiedName.value = [person.first_name, person.last_name].filter(Boolean).join(' ').trim()
}

async function onGuest() { authResolved.value = true }
async function onSignedIn(payload: { email: string; firstName: string; lastName: string; phone: string | null; subjectPersonId?: string | null }) {
  authResolved.value = true
  if (!props.context?.orgId) return
  const cols = 'first_name, last_name, email, phone, dob, gender, custom_fields'
  // If the member chose to register someone they look after, prefill the
  // primary registrant from THAT person; otherwise from the signed-in member.
  if (payload.subjectPersonId) {
    const { data } = await (db.from as any)('persons').select(cols)
      .eq('org_id', props.context.orgId).eq('id', payload.subjectPersonId).maybeSingle()
    if (data) { prefillPrimary(data); return }
  }
  const email = (payload?.email || '').trim().toLowerCase()
  if (email) {
    // Re-fetch the full person (the chooser only carries name/email/phone) so we
    // can prefill DOB, gender and custom fields too.
    const { data } = await (db.from as any)('persons').select(cols)
      .eq('org_id', props.context.orgId).ilike('email', email).maybeSingle()
    if (data) prefillPrimary(data)
    else identifiedName.value = [payload.firstName, payload.lastName].filter(Boolean).join(' ').trim()
  }
}
function changeIdentity() { authResolved.value = false; identifiedName.value = '' }

onMounted(async () => {
  if (!props.context?.orgId) return
  try {
    const defs = await resolveFields(props.context.orgId)
    const m: Record<string, string> = {}
    for (const d of defs) m[d.label] = d.id
    labelToDefId.value = m
  } catch { /* field engine optional */ }
})

function onNext() { if (step.value < steps.value.length - 1) step.value++ }
function onBack() { if (step.value > 0) step.value-- }
function onSubmit() { if (validate()) emit('submit', buildPayload()) }
</script>

<template>
  <div class="form-renderer" :style="bgStyle">
    <!-- ── Designed header chrome (banner / info / description), as on the builder preview ── -->
    <FormPreviewBanner v-if="showBanner" :design="design" :event="event || {}" />
    <FormPreviewInfoIcons v-if="hasInfoIcons" :design="design" :event="event" live :cost="costLabel" />
    <FormPreviewDescription v-if="hasDescription" :design="design" :event="event" readonly />

    <div class="px-4 sm:px-6 py-6">
    <!-- Identify step: continue as guest, sign in, or (staff) pick a member -->
    <BookingAuthChooser v-if="!authResolved"
      :staff="staff"
      :org-id="context.orgId"
      :can-go-back="false"
      subject-mode="register"
      title="How would you like to register?"
      subtitle="Sign in to auto-fill your details, or continue as a guest."
      guest-label="Continue as guest"
      guest-description="Fill in the form yourself."
      @select-guest="onGuest"
      @signed-in="onSignedIn" />

    <template v-else>
    <!-- Identified-registrant banner -->
    <div v-if="identifiedName" class="flex items-center justify-between gap-3 mb-4 rounded-lg bg-green-50 border border-green-100 px-3 py-2">
      <span class="text-sm text-green-800 inline-flex items-center gap-2"><i class="pi pi-check-circle text-green-500" />Registering as <span class="font-semibold">{{ identifiedName }}</span></span>
      <button type="button" class="text-xs font-semibold text-gray-500 hover:text-gray-700" @click="changeIdentity">Change</button>
    </div>

    <h2 class="text-lg font-bold text-gray-900 mb-4">{{ formHeading }}</h2>

    <!-- Step indicator -->
    <div v-if="isWizard" class="flex items-center gap-2 mb-5 flex-wrap">
      <template v-for="(st, i) in steps" :key="i">
        <button type="button" class="flex items-center gap-1.5 text-xs font-semibold transition-colors"
          :class="i === step ? 'text-primary' : 'text-gray-400'" @click="step = i">
          <span class="w-5 h-5 rounded-full flex items-center justify-center text-[11px]"
            :class="i === step ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'">{{ i + 1 }}</span>
          {{ st.kind === 'terms' ? 'Terms' : st.subject.label }}
        </button>
        <span v-if="i < steps.length - 1" class="text-gray-300">›</span>
      </template>
    </div>

    <!-- Subjects -->
    <template v-for="(s, si) in subjects" :key="s.key">
      <section v-if="!isWizard || (steps[step] && steps[step].kind === 'subject' && steps[step].subject.key === s.key)"
        class="mb-7">
        <h3 class="text-base font-semibold text-gray-800">{{ s.heading || (s.label + ' register') }}</h3>
        <div v-if="s.intro" class="text-sm text-gray-500 mt-1 mb-2" v-html="s.intro" />

        <!-- Instances -->
        <div v-for="inst in count(s.key)" :key="inst"
          class="rounded-xl border border-gray-200 p-4 mt-3 bg-white">
          <div class="flex items-center justify-between mb-3">
            <p class="text-sm font-semibold text-gray-700">
              {{ s.label }}<span v-if="count(s.key) > 1"> {{ inst }}</span>
            </p>
            <button v-if="inst > subjectBounds(s).lo" type="button"
              class="text-gray-300 hover:text-red-500 transition-colors" @click="removeInstance(s, inst)">
              <i class="pi pi-times text-sm" />
            </button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <!-- Pinned (name) -->
            <FormRendererField v-for="f in leadFields(s.key)" :key="f.id"
              :field="f" :value="getVal(s.key, inst, f.label)"
              @update="v => setVal(s.key, inst, f.label, v)" />
            <!-- Body items + sections -->
            <template v-for="f in bodyItems(s.key)" :key="f.id">
              <div v-if="f.field_type === 'section'" class="col-span-2 mt-2">
                <p class="text-sm font-bold text-gray-700">{{ f.label }}</p>
                <p v-if="f.placeholder" class="text-xs text-gray-400 mb-2">{{ f.placeholder }}</p>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormRendererField v-for="c in sectionChildren(s.key, f.id)" :key="c.id"
                    v-show="fieldVisible(c, s.key, inst)"
                    :field="c" :value="getVal(s.key, inst, c.label)"
                    @update="v => setVal(s.key, inst, c.label, v)" />
                </div>
              </div>
              <FormRendererField v-else v-show="fieldVisible(f, s.key, inst)"
                :field="f" :value="getVal(s.key, inst, f.label)"
                @update="v => setVal(s.key, inst, f.label, v)" />
            </template>
          </div>

          <!-- Sessions (chooser subjects only) -->
          <div v-if="isChooser(s.key) && visibleSessions.length" class="mt-4 border-t border-gray-100 pt-3">
            <p class="text-sm font-semibold text-gray-700 mb-2">Choose sessions</p>
            <label v-for="sess in visibleSessions" :key="sess.id"
              class="flex items-center justify-between gap-3 py-1.5 text-sm cursor-pointer">
              <span class="flex items-center gap-2">
                <input type="checkbox" class="w-4 h-4 accent-primary"
                  :checked="sess.required || sessionSelected(s.key, inst, sess.id)" :disabled="sess.required"
                  @change="toggleSession(s.key, inst, sess.id, ($event.target as any).checked)" />
                <span class="text-gray-700">{{ sess.title || 'Session' }}</span>
              </span>
              <span v-if="Number(sess.fee)" class="text-gray-500">{{ money(Number(sess.fee)) }}</span>
            </label>
          </div>

          <!-- Per-instance order summary -->
          <div v-if="isChooser(s.key) && hasFees" class="mt-3 bg-gray-50 rounded-lg px-3 py-2 text-sm">
            <div class="flex justify-between font-semibold text-gray-800">
              <span>Subtotal</span><span>{{ money(instanceTotal(s.key, inst)) }}</span>
            </div>
          </div>
        </div>

        <!-- Add another -->
        <div class="mt-3 flex items-center gap-3">
          <button type="button" :disabled="!canAdd(s)"
            class="inline-flex items-center gap-1.5 text-sm font-semibold transition-colors"
            :class="canAdd(s) ? 'text-primary hover:underline' : 'text-gray-300 cursor-not-allowed'"
            @click="addInstance(s)">
            <i class="pi pi-plus text-xs" />Add another {{ s.label }}
          </button>
          <span v-if="!canAdd(s)" class="text-xs text-gray-400">Maximum of {{ subjectBounds(s).hi }} reached</span>
        </div>
      </section>
    </template>

    <!-- Terms + payment + total (single-page: always; wizard: terms step) -->
    <section v-if="!isWizard || isTermsStep(step)" class="mb-6">
      <div v-if="hasFees" class="bg-gray-50 rounded-xl px-4 py-3 mb-4">
        <div class="flex justify-between text-base font-bold text-gray-900">
          <span>Total</span><span>{{ money(grandTotal) }}</span>
        </div>
      </div>

      <div v-if="paymentMethods.length" class="mb-4">
        <p class="text-sm font-semibold text-gray-700 mb-2">Payment</p>
        <label v-for="m in paymentMethods" :key="m.key" class="flex items-center gap-2 py-1.5 text-sm cursor-pointer">
          <input type="radio" class="accent-primary" :value="m.key" v-model="selectedPayment" />
          <span class="text-gray-700">{{ m.label }}</span>
        </label>
      </div>

      <label v-if="termsList.length" class="flex items-start gap-2 text-sm cursor-pointer">
        <input type="checkbox" class="w-4 h-4 mt-0.5 accent-primary" v-model="termsAccepted" />
        <span class="text-gray-700">I accept the <span class="font-medium">terms &amp; conditions</span> and privacy policy.</span>
      </label>
    </section>

    <p v-if="error" class="text-sm text-red-600 mb-3">{{ error }}</p>

    <!-- Footer -->
    <div class="flex items-center justify-between gap-3 pt-2">
      <button v-if="isWizard && step > 0" type="button"
        class="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900" @click="onBack">Back</button>
      <span v-else />
      <button v-if="isWizard && !isTermsStep(step)" type="button"
        class="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-primary hover:opacity-90 transition" @click="onNext">
        Next
      </button>
      <button v-else type="button" :disabled="submitting"
        class="px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-primary hover:opacity-90 transition disabled:opacity-50"
        @click="onSubmit">
        <i v-if="submitting" class="pi pi-spin pi-spinner mr-1.5" />{{ submitting ? 'Submitting…' : 'Submit registration' }}
      </button>
    </div>
    </template>
    </div>
  </div>
</template>
