<template>
  <!--
    Reusable "How would you like to book?" auth chooser. Encapsulates the
    four-button picker (guest / mobile app / OTP / password) plus all the
    sub-steps so any booking flow can drop it in and just listen for
    @select-guest or @signed-in.

    The parent still owns the contact / booking form that follows — fields
    differ between schedulers, item bookers, event registrations, etc.
  -->
  <div class="space-y-4">
    <!-- ── Top: chooser ── -->
    <template v-if="step === 'choose'">
      <button v-if="canGoBack" type="button"
        class="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors"
        @click="emit('back')">
        <i class="pi pi-arrow-left text-[10px]" /> Back
      </button>
      <div>
        <p class="text-base font-bold text-gray-900">{{ title }}</p>
        <p class="text-xs text-gray-500 mt-1">{{ subtitle }}</p>
      </div>
      <!-- Built-in: staff-only member picker. Always available when the
           parent passes `staff` so every booking form gets the same
           "find a person and prefill" affordance. AutoComplete searches
           the org's `persons` table by name or email. -->
      <div v-if="staff" class="rounded-lg border-2 border-gray-100 bg-gray-50/50 px-3 py-3">
        <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
          Pick a member
        </label>
        <AutoComplete v-model="memberQuery" :suggestions="memberSuggestions"
          option-label="label"
          placeholder="Search by name or email…"
          :delay="200"
          force-selection
          @complete="searchMembers"
          @option-select="onMemberPicked"
          @change="onMemberPicked"
          class="w-full"
          :pt="{ pcInputText: { root: { class: 'w-full !text-sm' } } }" />
        <p v-if="memberSearched && !memberSuggestions.length"
          class="text-[11px] text-gray-400 mt-1.5">
          No matches. Use one of the options below instead.
        </p>
      </div>
      <!-- Slot for parents to inject ADDITIONAL options above the standard
           guest/app/OTP/password buttons. Built-in member picker covers
           the common staff case; this slot is for anything bespoke. -->
      <slot name="extra-options" />
      <div class="space-y-2">
        <button v-if="!hideGuest" type="button"
          class="w-full flex items-center gap-3 px-3 py-3 rounded-lg border-2 border-gray-100 hover:border-gray-200 bg-white text-left transition-colors"
          @click="emit('select-guest')">
          <div class="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
            <i class="pi pi-user-edit text-gray-600 text-sm" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-gray-900">{{ guestLabel }}</p>
            <p class="text-xs text-gray-500">{{ guestDescription }}</p>
          </div>
          <i class="pi pi-chevron-right text-gray-300 text-xs" />
        </button>

        <button v-if="appDeepLink" type="button"
          class="w-full flex items-center gap-3 px-3 py-3 rounded-lg border-2 border-gray-100 hover:border-gray-200 bg-white text-left transition-colors"
          @click="step = 'app'">
          <div class="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
            <i class="pi pi-mobile text-gray-600 text-sm" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-gray-900">Open in mobile app</p>
            <p class="text-xs text-gray-500">Sign in instantly with the FriendlyManager app.</p>
          </div>
          <i class="pi pi-chevron-right text-gray-300 text-xs" />
        </button>

        <button type="button"
          class="w-full flex items-center gap-3 px-3 py-3 rounded-lg border-2 border-gray-100 hover:border-gray-200 bg-white text-left transition-colors"
          @click="step = 'otp-email'">
          <div class="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
            <i class="pi pi-envelope text-gray-600 text-sm" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-gray-900">Email me a one-time code</p>
            <p class="text-xs text-gray-500">No password needed.</p>
          </div>
          <i class="pi pi-chevron-right text-gray-300 text-xs" />
        </button>

        <button type="button"
          class="w-full flex items-center gap-3 px-3 py-3 rounded-lg border-2 border-gray-100 hover:border-gray-200 bg-white text-left transition-colors"
          @click="step = 'password'">
          <div class="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
            <i class="pi pi-key text-gray-600 text-sm" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-gray-900">Sign in with password</p>
            <p class="text-xs text-gray-500">For existing FriendlyManager accounts.</p>
          </div>
          <i class="pi pi-chevron-right text-gray-300 text-xs" />
        </button>
      </div>
    </template>

    <!-- ── OTP — email entry ── -->
    <template v-else-if="step === 'otp-email'">
      <button type="button" class="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors"
        @click="step = 'choose'">
        <i class="pi pi-arrow-left text-[10px]" /> Back
      </button>
      <div>
        <p class="text-base font-bold text-gray-900">Email me a code</p>
        <p class="text-xs text-gray-500 mt-1">We'll send a 6-digit login code to your inbox.</p>
      </div>
      <div>
        <label class="text-xs font-semibold text-gray-600 mb-1 block">Email</label>
        <input v-model="otpEmail" type="email" placeholder="you@example.com"
          class="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3]" />
      </div>
      <p v-if="otpError" class="text-xs text-red-500">{{ otpError }}</p>
      <Button :loading="otpSending" :disabled="!otpEmail.trim()" label="Send code" icon="pi pi-send" class="w-full"
        @click="sendOtp"
        style="background:var(--brand-primary); border-color:var(--brand-primary)" />
    </template>

    <!-- ── OTP — code entry ── -->
    <template v-else-if="step === 'otp-code'">
      <button type="button" class="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors"
        @click="step = 'otp-email'">
        <i class="pi pi-arrow-left text-[10px]" /> Back
      </button>
      <div>
        <p class="text-base font-bold text-gray-900">Enter the 6-digit code</p>
        <p class="text-xs text-gray-500 mt-1">Sent to <span class="font-semibold">{{ otpEmail }}</span>. Check your inbox.</p>
      </div>
      <div>
        <label class="text-xs font-semibold text-gray-600 mb-1 block">Code</label>
        <input v-model="otpCode" inputmode="numeric" maxlength="6" placeholder="000000"
          class="w-full h-12 px-3 text-center text-xl font-mono tracking-[0.4em] border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3]" />
      </div>
      <p v-if="otpError" class="text-xs text-red-500">{{ otpError }}</p>
      <Button :loading="otpVerifying" :disabled="otpCode.length !== 6" label="Verify & continue" icon="pi pi-check" class="w-full"
        @click="verifyOtp"
        style="background:var(--brand-primary); border-color:var(--brand-primary)" />
      <button type="button" class="text-xs font-semibold text-primary hover:underline mx-auto block"
        @click="sendOtp">Resend code</button>
    </template>

    <!-- ── Password ── -->
    <template v-else-if="step === 'password'">
      <button type="button" class="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors"
        @click="step = 'choose'">
        <i class="pi pi-arrow-left text-[10px]" /> Back
      </button>
      <div>
        <p class="text-base font-bold text-gray-900">Sign in with password</p>
        <p class="text-xs text-gray-500 mt-1">Use your existing FriendlyManager account.</p>
      </div>
      <div class="space-y-3">
        <div>
          <label class="text-xs font-semibold text-gray-600 mb-1 block">Email</label>
          <input v-model="pwEmail" type="email" placeholder="you@example.com" autocomplete="email"
            class="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3]" />
        </div>
        <div>
          <label class="text-xs font-semibold text-gray-600 mb-1 block">Password</label>
          <input v-model="pwPassword" type="password" placeholder="••••••••" autocomplete="current-password"
            class="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3]" />
        </div>
      </div>
      <p v-if="pwError" class="text-xs text-red-500">{{ pwError }}</p>
      <Button :loading="pwSubmitting" :disabled="!pwEmail.trim() || !pwPassword" label="Sign in & continue" icon="pi pi-sign-in" class="w-full"
        @click="signInWithPasswordFn"
        style="background:var(--brand-primary); border-color:var(--brand-primary)" />
    </template>

    <!-- ── App ── -->
    <template v-else-if="step === 'app'">
      <button type="button" class="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors"
        @click="step = 'choose'">
        <i class="pi pi-arrow-left text-[10px]" /> Back
      </button>
      <div>
        <p class="text-base font-bold text-gray-900">Open in mobile app</p>
        <p class="text-xs text-gray-500 mt-1">Scan the code with your phone, or tap below if you're already on your phone.</p>
      </div>
      <div class="flex justify-center py-3">
        <div class="rounded-xl border border-gray-200 bg-white p-3">
          <img v-if="appQrUrl" :src="appQrUrl" alt="Booking QR code" class="w-44 h-44" />
          <div v-else class="w-44 h-44 flex items-center justify-center text-gray-300">
            <i class="pi pi-spin pi-spinner text-xl" />
          </div>
        </div>
      </div>
      <a :href="appDeepLink"
        class="block w-full text-center px-4 py-2.5 rounded-lg text-white text-sm font-semibold"
        style="background:var(--brand-primary)">
        <i class="pi pi-external-link mr-1.5 text-xs" /> Open the app
      </a>
      <p class="text-xs text-gray-400 text-center">
        Don't have the app?
        <button type="button" class="text-primary font-semibold hover:underline"
          @click="step = 'choose'">Use email instead</button>
      </p>
    </template>

    <!-- ── Act-on-behalf: who is this booking for? ── -->
    <template v-else-if="step === 'subject'">
      <div>
        <p class="text-base font-bold text-gray-900">Who is this for?</p>
        <p class="text-xs text-gray-500 mt-1">You can book for yourself or someone you look after.</p>
      </div>
      <div class="space-y-2">
        <button v-for="o in subjectOptions" :key="o.id" type="button"
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border-2 text-left transition-colors"
          :class="chosenSubjectId === o.id ? 'border-primary bg-primary/5' : 'border-gray-100 hover:border-gray-200 bg-white'"
          @click="chosenSubjectId = o.id">
          <div class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
            <i class="pi text-gray-500 text-xs" :class="o.kind === 'self' ? 'pi-user' : o.kind === 'dependent' ? 'pi-users' : 'pi-share-alt'" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-gray-900 truncate">{{ o.name }}</p>
            <p class="text-[11px] text-gray-400 capitalize">{{ o.kind === 'self' ? 'Myself' : o.kind }}</p>
          </div>
          <i v-if="chosenSubjectId === o.id" class="pi pi-check text-primary text-xs" />
        </button>
      </div>
      <button type="button"
        class="block w-full text-center px-4 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
        style="background:var(--brand-primary)" :disabled="!chosenSubjectId" @click="confirmSubject">
        Continue
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  /** Org id is needed to look up an existing member's phone/name when
   *  prefilling after sign-in. Pass null for non-org-scoped flows. */
  orgId?: string | null
  /** Optional deep-link URL — when supplied, the "Open in mobile app"
   *  option is shown and a QR code is generated for it. Omit (or pass
   *  empty string) to hide the app option entirely. */
  appDeepLink?: string
  /** When true the chooser shows a back button on the top step that
   *  emits @back so the parent can return to the previous panel. */
  canGoBack?: boolean
  /** Hide the "Continue as guest" option — useful when a flow requires
   *  authentication. */
  hideGuest?: boolean
  /** Header copy (override per flow). */
  title?: string
  subtitle?: string
  /** Guest button copy. */
  guestLabel?: string
  guestDescription?: string
  /** When true, show the staff-only member picker at the top of the
   *  chooser. Picking a member emits `@signed-in` with their details so
   *  parents don't need separate handling for staff-vs-public flows. */
  staff?: boolean
  /** When true (default), a signed-in member who can act for others
   *  (family dependents / circle co-members) is shown a "Who is this for?"
   *  picker before the form opens. Set false to always book as self. */
  actOnBehalf?: boolean
  /** Which capability gates the act-on-behalf list — resource bookings use
   *  'book' (can_book_for); event/class sign-ups use 'register' (can_register). */
  subjectMode?: 'book' | 'register'
}>(), {
  orgId: null,
  appDeepLink: '',
  canGoBack: true,
  hideGuest: false,
  title: 'How would you like to book?',
  subtitle: 'Pick whichever is easiest — all options end with the same booking.',
  guestLabel: 'Continue as guest',
  guestDescription: 'Just fill in a quick form.',
  staff: false,
  actOnBehalf: true,
  subjectMode: 'book',
})
const emit = defineEmits<{
  /** User clicked the back button on the top chooser — parent should
   *  pop back to whatever step came before. */
  (e: 'back'): void
  /** User picked "Continue as guest" — parent should advance to its
   *  contact / booking form, no prefill. */
  (e: 'select-guest'): void
  /** User authenticated successfully (OTP or password). Payload carries
   *  the prefill data the parent should drop into its form. Phone is
   *  best-effort — only present when the user has an org_members row. */
  (e: 'signed-in', payload: { email: string; firstName: string; lastName: string; phone: string | null; personId: string | null; subjectPersonId: string | null }): void
}>()

type Step = 'choose' | 'otp-email' | 'otp-code' | 'password' | 'app' | 'subject'
const step = ref<Step>('choose')

const db = useDb()
const supabase = useSupabaseClient()
const { subjectOptionsFor } = usePeopleLinks()

// ── OTP state ────────────────────────────────────────────────────────────
const otpEmail = ref('')
const otpCode = ref('')
const otpSending = ref(false)
const otpVerifying = ref(false)
const otpError = ref('')

async function sendOtp() {
  otpError.value = ''
  if (!otpEmail.value.trim()) { otpError.value = 'Enter your email first.'; return }
  otpSending.value = true
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: otpEmail.value.trim(),
      options: { shouldCreateUser: true },
    })
    if (error) { otpError.value = error.message; return }
    step.value = 'otp-code'
  } finally {
    otpSending.value = false
  }
}

async function verifyOtp() {
  otpError.value = ''
  if (otpCode.value.length !== 6) { otpError.value = 'Code must be 6 digits.'; return }
  otpVerifying.value = true
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email: otpEmail.value.trim(),
      token: otpCode.value.trim(),
      type: 'email',
    })
    if (error) { otpError.value = error.message; return }
    if (data.user) await emitSignedIn(data.user)
  } finally {
    otpVerifying.value = false
  }
}

// ── Password state ───────────────────────────────────────────────────────
const pwEmail = ref('')
const pwPassword = ref('')
const pwSubmitting = ref(false)
const pwError = ref('')

async function signInWithPasswordFn() {
  pwError.value = ''
  if (!pwEmail.value.trim() || !pwPassword.value) {
    pwError.value = 'Enter email and password.'
    return
  }
  pwSubmitting.value = true
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: pwEmail.value.trim(),
      password: pwPassword.value,
    })
    if (error) { pwError.value = error.message; return }
    if (data.user) await emitSignedIn(data.user)
  } finally {
    pwSubmitting.value = false
  }
}

// ── Prefill + emit ───────────────────────────────────────────────────────
async function emitSignedIn(user: { id: string; email?: string | null; user_metadata?: Record<string, any> | null }) {
  let firstName = ''
  let lastName = ''
  let phone: string | null = null
  const email = user.email ?? ''
  const fullName: string | undefined = user.user_metadata?.full_name
  if (fullName) {
    const parts = fullName.trim().split(/\s+/)
    firstName = parts[0] ?? ''
    lastName = parts.slice(1).join(' ')
  }
  // Best-effort: pull phone + canonical name from org_members.
  if (props.orgId) {
    const { data } = await (db.from as any)('org_members')
      .select('phone, first_name, last_name')
      .eq('user_id', user.id)
      .eq('org_id', props.orgId)
      .maybeSingle()
    if (data) {
      if (data.first_name) firstName = data.first_name
      if (data.last_name) lastName = data.last_name
      if (data.phone) phone = data.phone
    }
  }
  // Resolve this person's record so we can (a) tag the booking subject and
  // (b) offer "book for my child / circle" when they can act for others.
  const personId = await resolvePersonId(email)
  const prefill = { email, firstName, lastName, phone, personId }
  if (props.actOnBehalf && personId && await offerSubjectPicker(personId, `${firstName} ${lastName}`.trim(), prefill)) return
  emit('signed-in', { ...prefill, subjectPersonId: personId })
}

// ── Act-on-behalf subject picker ─────────────────────────────────────────
interface PrefillPayload { email: string; firstName: string; lastName: string; phone: string | null; personId: string | null }
const pendingPrefill = ref<PrefillPayload | null>(null)
const subjectOptions = ref<{ id: string; name: string; kind: string }[]>([])
const chosenSubjectId = ref<string | null>(null)

async function resolvePersonId(email: string): Promise<string | null> {
  if (!email || !props.orgId) return null
  const { data } = await (db.from as any)('persons')
    .select('id').eq('org_id', props.orgId).ilike('email', email).maybeSingle()
  return data?.id ?? null
}

/** Loads the person's circles and, if they can act for others, shows the
 *  picker step. Returns true when it took over (caller must not emit). */
async function offerSubjectPicker(personId: string, name: string, prefill: PrefillPayload): Promise<boolean> {
  if (!props.orgId) return false
  const { data } = await (db.from as any)('circles')
    .select('id, name, kind, circle_members(person_id, role, can_book_for, can_view, can_register, is_lead, person:persons(id, first_name, last_name))')
    .eq('org_id', props.orgId)
  const circles = (data ?? [])
    .map((c: any) => ({ ...c, members: c.circle_members ?? [] }))
    .filter((c: any) => c.members.some((m: any) => m.person_id === personId))
  const opts = subjectOptionsFor(circles, personId, name, props.subjectMode)
  if (opts.length <= 1) return false
  subjectOptions.value = opts
  chosenSubjectId.value = personId
  pendingPrefill.value = prefill
  step.value = 'subject'
  return true
}

function confirmSubject() {
  const p = pendingPrefill.value
  if (!p) return
  emit('signed-in', { ...p, subjectPersonId: chosenSubjectId.value ?? p.personId })
  pendingPrefill.value = null
}

// ── App QR ───────────────────────────────────────────────────────────────
const appQrUrl = ref<string | null>(null)
watch([step, () => props.appDeepLink], async ([s, link]) => {
  if (s !== 'app' || !link) { appQrUrl.value = null; return }
  try {
    // @ts-expect-error — qrcode ships JS-only, no @types/qrcode in deps
    const QR = await import('qrcode')
    appQrUrl.value = await QR.toDataURL(link, { width: 240, margin: 1 })
  } catch {
    appQrUrl.value = null
  }
})

// ── Staff-only member picker ─────────────────────────────────────────────
// AutoComplete-driven search against the org's `persons` table. Picking
// a member is treated as a sign-in for downstream flows — the parent
// gets the same `@signed-in` event it would for OTP / password, with
// the member's contact details filled in. This keeps every booking form
// on the same "registration" pattern.
interface MemberSuggestion { id: string; label: string; firstName: string; lastName: string; email: string | null; phone: string | null }
const memberQuery = ref<string | MemberSuggestion>('')
const memberSuggestions = ref<MemberSuggestion[]>([])
const memberSearched = ref(false)

async function searchMembers(event: { query: string }) {
  if (!props.orgId || !props.staff) return
  const q = (event.query || '').trim()
  memberSearched.value = true
  const pattern = `%${q.replace(/[%_]/g, '\\$&')}%`
  const filterClause = q
    ? `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`
    : ''
  let query = (db.from as any)('persons')
    .select('id, first_name, last_name, email, phone')
    .eq('org_id', props.orgId)
    .order('first_name')
    .limit(20)
  if (filterClause) query = query.or(filterClause)
  const { data } = await query
  memberSuggestions.value = (data ?? []).map((p: any) => ({
    id: p.id,
    firstName: p.first_name ?? '',
    lastName: p.last_name ?? '',
    email: p.email,
    phone: p.phone,
    label: [p.first_name, p.last_name].filter(Boolean).join(' ').trim() + (p.email ? ` · ${p.email}` : ''),
  }))
}

// Both `@option-select` and `@change` route here — the exact event
// PrimeVue fires depends on whether the user clicked, hit enter, or
// focused out. The guard rejects strings / empty values.
function onMemberPicked(event: { value: unknown }) {
  const m = event?.value
  if (!m || typeof m !== 'object' || !('id' in (m as any))) return
  const member = m as MemberSuggestion
  // Staff picked the member directly — they ARE the subject of the booking.
  emit('signed-in', {
    email: member.email ?? '',
    firstName: member.firstName,
    lastName: member.lastName,
    phone: member.phone,
    personId: member.id,
    subjectPersonId: member.id,
  })
  // Reset so a follow-up search starts clean.
  memberQuery.value = ''
  memberSuggestions.value = []
  memberSearched.value = false
}

// Expose a reset for parents that want to start fresh (e.g. after the
// user clears their selection and comes back to the auth panel).
defineExpose({
  reset() {
    step.value = 'choose'
    otpEmail.value = ''
    otpCode.value = ''
    otpError.value = ''
    pwEmail.value = ''
    pwPassword.value = ''
    pwError.value = ''
    memberQuery.value = ''
    memberSuggestions.value = []
    memberSearched.value = false
  },
})
</script>
