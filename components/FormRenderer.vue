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
  // Pick-ONE fee choices (group fee options, migration 204): each chooser instance
  // selects how they'd like to pay. label = human price ("$40 / month"),
  // total = the numeric used in the running total.
  feeOptions?: { id: string; name: string; label: string; total: number; description?: string | null }[]
  // Class choices (form context — registration_form_targets, migration 228):
  // each chooser instance picks which class(es) to join. A full class with a
  // waitlist stays pickable (the registrant queues); full without one is disabled.
  groupOptions?: { id: string; name: string; section?: string | null; spaces: number | null; full: boolean; waitlistable: boolean; feeOptions: { id: string; name: string; label: string; total: number; description?: string | null }[] }[]
  currency?: string
  submitting?: boolean
  staff?: boolean               // staff-side: enables the "pick a member" control
  event?: any                   // drives the designed header chrome (banner/info/description)
  preview?: boolean             // builder preview: skip the auth chooser + don't really submit
  discounts?: any[]             // active discounts, shown on the landing to encourage registration
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
// Age restriction → the header "Invitee Restrictions" line + submit validation.
const ageCriteria = computed(() => {
  const lo = props.event?.age_min ?? null
  const hi = props.event?.age_max ?? null
  if (lo != null && hi != null) return `Ages ${lo}–${hi}`
  if (lo != null) return `Ages ${lo}+`
  if (hi != null) return `Up to age ${hi}`
  return ''
})
const displayEvent = computed(() => {
  const e = props.event
  if (!e || e.criteria || !ageCriteria.value) return e
  return { ...e, criteria: ageCriteria.value }
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

// ── Date-table layout (programmes): dates × session-type grid ──────────────────
function isoWeekOf(d: Date) {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  return Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}
const isDateTable = computed(() => design.value?.sessionsLayout === 'date-table')
const sessionDateTable = computed(() => {
  const visible = visibleSessions.value.filter((s: any) => s.start_at)
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })
  const timeKeyOf = (s: any) => fmtTime(s.start_at)
  const uniqueTimeKeys = [...new Set(visible.map(timeKeyOf))]
  const dateKeys = [...new Set(visible.map((s: any) => new Date(s.start_at).toDateString()))]
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
  const columns = uniqueTimeKeys.map(tk => {
    const inCol = visible.filter((s: any) => timeKeyOf(s) === tk)
    const titles = [...new Set(inCol.map((s: any) => s.title || 'Session'))]
    const fees = [...new Set(inCol.map((s: any) => Number(s.fee) || 0))]
    return { key: tk, title: titles.length === 1 ? titles[0] : null, startTime: inCol[0] ? fmtTime(inCol[0].start_at) : null, fee: fees.length === 1 ? fees[0] : null }
  })
  let weekSeq = 0, prevWeek: number | null = null
  const rows = dateKeys.map(dk => {
    const date = new Date(dk)
    const week = isoWeekOf(date)
    const newWeek = prevWeek !== null && week !== prevWeek
    if (prevWeek === null || newWeek) weekSeq++
    prevWeek = week
    return {
      weekday: date.toLocaleDateString('en-AU', { weekday: 'long' }),
      dayMonth: date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
      date, week, weekSeq, newWeek,
      cells: uniqueTimeKeys.map(tk => visible.find((s: any) => timeKeyOf(s) === tk && new Date(s.start_at).toDateString() === dk) ?? null),
    }
  })
  return { columns, rows }
})
function dtSelSet(key: string, inst: number): Record<string, boolean> { return sessionSel[key]?.[inst - 1] ?? {} }
function dtSel(key: string, inst: number, s: any) { return !!(s?.required || dtSelSet(key, inst)[s?.id]) }
function dtSetMany(key: string, inst: number, list: any[], on: boolean) { for (const s of list) toggleSession(key, inst, s.id, on) }
function dtRowSessions(row: any) { return (row?.cells ?? []).filter((s: any) => s && !s.required) }
function dtRowFull(key: string, inst: number, row: any) { const r = dtRowSessions(row); return r.length > 0 && r.every((s: any) => dtSelSet(key, inst)[s.id]) }
function dtToggleRow(key: string, inst: number, row: any) { dtSetMany(key, inst, dtRowSessions(row), !dtRowFull(key, inst, row)) }
function dtColSessions(ci: number) { return sessionDateTable.value.rows.map(r => r.cells[ci]).filter((s: any) => s && !s.required) }
function dtColFull(key: string, inst: number, ci: number) { const c = dtColSessions(ci); return c.length > 0 && c.every((s: any) => dtSelSet(key, inst)[s.id]) }
function dtToggleCol(key: string, inst: number, ci: number) { dtSetMany(key, inst, dtColSessions(ci), !dtColFull(key, inst, ci)) }
function dtWeekSessions(weekSeq: number) { return sessionDateTable.value.rows.filter(r => r.weekSeq === weekSeq).flatMap(r => r.cells).filter((s: any) => s && !s.required) }
function dtWeekFull(key: string, inst: number, weekSeq: number) { const w = dtWeekSessions(weekSeq); return w.length > 0 && w.every((s: any) => dtSelSet(key, inst)[s.id]) }
function dtToggleWeek(key: string, inst: number, weekSeq: number) { dtSetMany(key, inst, dtWeekSessions(weekSeq), !dtWeekFull(key, inst, weekSeq)) }
function dtRowFee(row: any): number | null {
  const cells = (row?.cells ?? []).filter((s: any) => !!s)
  if (!cells.length) return null
  return cells.reduce((sum: number, s: any) => sum + (Number(s.fee) || 0), 0)
}
// Flat-list label — include the date so multi-day sessions aren't all "Morning".
function sessListLabel(s: any) {
  if (!s.start_at) return s.title || 'Session'
  const d = new Date(s.start_at)
  return `${s.title || 'Session'} · ${d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}`
}
const baseFee = computed(() => (props.feeLineItems ?? []).reduce((s, f) => s + (Number(f.amount) || 0), 0))

// Fee options — a pick-one "How would you like to pay?" per chooser instance.
const feeOptions = computed(() => props.feeOptions ?? [])
const feeSel = reactive<Record<string, (string | null)[]>>({})
function feeOptionSelected(key: string, inst: number): string | null {
  const stored = feeSel[key]?.[inst - 1]
  if (stored) return stored
  return feeOptions.value.length === 1 ? feeOptions.value[0].id : null
}
function selectFeeOption(key: string, inst: number, id: string) {
  if (!feeSel[key]) feeSel[key] = []
  feeSel[key][inst - 1] = id
}

// Class choices — pick class(es) to join + per-class fee option.
const groupOptions = computed(() => props.groupOptions ?? [])
const groupSel = reactive<Record<string, Record<string, boolean>[]>>({})
const groupFeeSel = reactive<Record<string, Record<string, string>[]>>({})
function groupSelected(key: string, inst: number, gid: string) {
  return !!(groupSel[key]?.[inst - 1]?.[gid])
}
function toggleGroup(key: string, inst: number, gid: string, on: boolean) {
  if (!groupSel[key]) groupSel[key] = []
  if (!groupSel[key][inst - 1]) groupSel[key][inst - 1] = {}
  groupSel[key][inst - 1][gid] = on
}
function groupFeeSelected(key: string, inst: number, gid: string): string | null {
  const stored = groupFeeSel[key]?.[inst - 1]?.[gid]
  if (stored) return stored
  const g = groupOptions.value.find(x => x.id === gid)
  return g?.feeOptions.length === 1 ? g.feeOptions[0].id : null
}
function selectGroupFee(key: string, inst: number, gid: string, optId: string) {
  if (!groupFeeSel[key]) groupFeeSel[key] = []
  if (!groupFeeSel[key][inst - 1]) groupFeeSel[key][inst - 1] = {}
  groupFeeSel[key][inst - 1][gid] = optId
}

function instanceTotal(key: string, inst: number) {
  let total = baseFee.value
  for (const s of visibleSessions.value) {
    if (s.required || sessionSelected(key, inst, s.id)) total += Number(s.fee) || 0
  }
  const optId = feeOptionSelected(key, inst)
  if (optId) total += Number(feeOptions.value.find(o => o.id === optId)?.total) || 0
  for (const g of groupOptions.value) {
    if (!groupSelected(key, inst, g.id)) continue
    const gOpt = groupFeeSelected(key, inst, g.id)
    if (gOpt) total += Number(g.feeOptions.find(o => o.id === gOpt)?.total) || 0
  }
  return total
}
// Itemized order lines for a subject instance (shared collapse logic with the builder).
function orderLines(key: string, inst: number): { label: string; amount: number }[] {
  const rows: { label: string; amount: number }[] = []
  for (const f of (props.feeLineItems ?? [])) rows.push({ label: f.name || 'Registration Fee', amount: Number(f.amount) || 0 })
  rows.push(...collapseSessionRows({
    sessions: visibleSessions.value,
    isSelected: (s: any) => s.required || sessionSelected(key, inst, s.id),
    feeOf: (s: any) => Number(s.fee) || 0,
    dateTable: isDateTable.value,
  }))
  const optId = feeOptionSelected(key, inst)
  if (optId) { const o = feeOptions.value.find(x => x.id === optId); if (o) rows.push({ label: o.name || o.label, amount: Number(o.total) || 0 }) }
  for (const g of groupOptions.value) {
    if (!groupSelected(key, inst, g.id)) continue
    if (g.feeOptions.length > 1) { const gid = groupFeeSelected(key, inst, g.id); const o = g.feeOptions.find(x => x.id === gid); rows.push({ label: `${g.name}${o ? ' · ' + o.name : ''}`, amount: Number(o?.total) || 0 }) }
    else rows.push({ label: g.name, amount: Number(g.feeOptions[0]?.total) || 0 })
  }
  return rows
}
const grandTotal = computed(() => {
  let t = 0
  for (const s of choosers.value) for (let i = 1; i <= count(s.key); i++) t += instanceTotal(s.key, i)
  return t
})
// Full itemized summary across every subject + instance, for the Summary step.
const fullOrderLines = computed(() => {
  const out: { heading: boolean; label: string; amount: number }[] = []
  for (const s of choosers.value) {
    for (let i = 1; i <= count(s.key); i++) {
      const lines = orderLines(s.key, i)
      if (!lines.length) continue
      const id = instanceIdentity(s.key, i)
      const nm = [id.first_name, id.last_name].filter(Boolean).join(' ').trim()
      out.push({ heading: true, label: nm || `${s.label}${count(s.key) > 1 ? ' ' + i : ''}`, amount: 0 })
      for (const ln of lines) out.push({ heading: false, label: ln.label, amount: ln.amount })
    }
  }
  return out
})
const hasFees = computed(() => baseFee.value > 0 || visibleSessions.value.length > 0 || feeOptions.value.length > 0
  || groupOptions.value.some(g => g.feeOptions.length > 0))
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
  // Age restriction: each registrant with a Date of Birth must fall in the event's
  // allowed range (aged at the event's start date, else today).
  const amin = props.event?.age_min ?? null
  const amax = props.event?.age_max ?? null
  if (amin != null || amax != null) {
    const refDate = props.event?.start_at ? new Date(props.event.start_at) : new Date()
    for (const s of subjects.value) {
      for (let inst = 1; inst <= count(s.key); inst++) {
        const dobRaw = getVal(s.key, inst, 'Date of Birth')
        if (!dobRaw) continue
        const dob = new Date(dobRaw as any)
        if (isNaN(dob.getTime())) continue
        let age = refDate.getFullYear() - dob.getFullYear()
        const mo = refDate.getMonth() - dob.getMonth()
        if (mo < 0 || (mo === 0 && refDate.getDate() < dob.getDate())) age--
        const who = `${s.label}${count(s.key) > 1 ? ' ' + inst : ''}`
        if (amin != null && age < amin) { error.value = `${who} must be at least ${amin} year${amin === 1 ? '' : 's'} old for this event.`; return false }
        if (amax != null && age > amax) { error.value = `${who} must be ${amax} or younger for this event.`; return false }
      }
    }
  }
  if (feeOptions.value.length > 1) {
    for (const s of choosers.value) {
      for (let inst = 1; inst <= count(s.key); inst++) {
        if (!feeOptionSelected(s.key, inst)) {
          error.value = `Please choose how you'd like to pay for ${s.label}${count(s.key) > 1 ? ' ' + inst : ''}.`
          return false
        }
      }
    }
  }
  if (groupOptions.value.length) {
    for (const s of choosers.value) {
      for (let inst = 1; inst <= count(s.key); inst++) {
        const picked = groupOptions.value.filter(g => groupSelected(s.key, inst, g.id))
        if (!picked.length) {
          error.value = `Please choose a class for ${s.label}${count(s.key) > 1 ? ' ' + inst : ''}.`
          return false
        }
        for (const g of picked) {
          if (g.feeOptions.length > 1 && !groupFeeSelected(s.key, inst, g.id)) {
            error.value = `Please choose how you'd like to pay for ${g.name}.`
            return false
          }
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
      const groupsOut = isChooser(s.key)
        ? groupOptions.value.filter(g => groupSelected(s.key, inst, g.id))
            .map(g => ({ group_id: g.id, fee_option_id: groupFeeSelected(s.key, inst, g.id) }))
        : []
      return {
        ...identity, fields: fieldsOut, sessions: sess,
        fee: isChooser(s.key) ? instanceTotal(s.key, inst) : 0,
        fee_option_id: isChooser(s.key) ? feeOptionSelected(s.key, inst) : null,
        groups: groupsOut,
      }
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
const authResolved = ref(!!props.preview)  // false → show the landing; true → show the form (preview skips it)
const authModalOpen = ref(false)           // "Register" opens the auth chooser in a modal
function onGuestFromModal() { authModalOpen.value = false; onGuest() }
function onSignedInFromModal(p: any) { authModalOpen.value = false; onSignedIn(p) }

// Session prices shown on the landing (before registering).
const priceList = computed<{ label: string; fee: number | null }[]>(() => {
  const out: { label: string; fee: number | null }[] = []
  for (const f of (props.feeLineItems ?? [])) out.push({ label: f.name || 'Registration', fee: Number(f.amount) || 0 })
  if (isDateTable.value && sessionDateTable.value.columns.length) {
    const cols = sessionDateTable.value.columns.map(c => ({ label: c.title || c.startTime || 'Session', fee: c.fee }))
    for (const c of cols) out.push(c)
    const fullDay = cols.reduce((s, c) => s + (c.fee || 0), 0)
    if (cols.length > 1 && fullDay > 0) out.push({ label: 'Full day', fee: fullDay })
  } else {
    const seen = new Set<string>()
    for (const s of visibleSessions.value) {
      const label = s.title || 'Session'
      if (seen.has(label)) continue
      seen.add(label)
      out.push({ label, fee: Number(s.fee) || 0 })
    }
  }
  return out
})

// Active discounts for the landing "save when you book" nudge.
const activeDiscounts = computed(() => props.discounts ?? [])
function discountLabel(d: any): string {
  const v = Number(d.modifier_value) || 0
  if (d.modifier_type === 'PERCENT') return `${v}% off`
  if (d.modifier_type === 'REPLACE') return money(v)
  return `${money(v)} off`
}

// One summary row per week for the landing (dates · day count · from-price).
const fmtDayMon = (d: Date) => d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
const weekSummary = computed(() => {
  const rows = sessionDateTable.value.rows
  if (!rows.length) return [] as { weekSeq: number; range: string; days: number; from: number | null; perDay: number | null }[]
  const byWeek = new Map<number, any[]>()
  for (const r of rows) { if (!byWeek.has(r.weekSeq)) byWeek.set(r.weekSeq, []); byWeek.get(r.weekSeq)!.push(r) }
  return [...byWeek.entries()].map(([weekSeq, wrows]) => {
    const first = wrows[0].date, last = wrows[wrows.length - 1].date
    const cells = wrows.flatMap((r: any) => r.cells).filter((c: any) => c)
    const fees = cells.map((c: any) => Number(c.fee) || 0).filter((f: number) => f > 0)
    // "from" = cheapest single session; per-day = a full day's total (all sessions that day)
    const from = fees.length ? Math.min(...fees) : null
    const perDay = wrows[0] ? (wrows[0].cells.filter((c: any) => c).reduce((s: number, c: any) => s + (Number(c.fee) || 0), 0) || null) : null
    return { weekSeq, range: `${fmtDayMon(first)} – ${fmtDayMon(last)}`, days: wrows.length, from, perDay }
  })
})
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
function onSubmit() { if (props.preview) return; if (validate()) emit('submit', buildPayload()) }
</script>

<template>
  <div class="form-renderer" :style="bgStyle">
    <!-- ── Designed header chrome (banner / info / description) ── -->
    <FormPreviewBanner v-if="showBanner" :design="design" :event="event || {}" />
    <FormPreviewInfoIcons v-if="hasInfoIcons" :design="design" :event="displayEvent" live :cost="costLabel" />
    <FormPreviewDescription v-if="hasDescription" :design="design" :event="event" readonly />

    <div class="px-4 sm:px-6 py-6">
    <!-- LANDING: details + sessions (data table) → "Register" opens the auth modal -->
    <div v-if="!authResolved">
      <h2 class="text-lg font-bold text-gray-900 mb-3">{{ formHeading }}</h2>

      <!-- What's on offer, as a table — one row per week, a column per session type -->
      <div v-if="weekSummary.length" class="rounded-xl border border-gray-200 overflow-x-auto">
        <table class="w-full text-sm border-collapse min-w-[520px]">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-200 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">
              <th class="px-4 py-2.5">Week</th>
              <th class="px-4 py-2.5">Dates</th>
              <th class="px-3 py-2.5 text-center">Days</th>
              <th v-for="col in sessionDateTable.columns" :key="col.key" class="px-3 py-2.5 text-right">
                {{ col.title || col.startTime }}<span v-if="col.startTime && col.title" class="block font-normal normal-case text-gray-400">{{ col.startTime }}</span>
              </th>
              <th class="px-4 py-2.5 text-right">Full day</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="w in weekSummary" :key="w.weekSeq">
              <td class="px-4 py-2.5 font-semibold text-gray-800 whitespace-nowrap">Week {{ w.weekSeq }}</td>
              <td class="px-4 py-2.5 text-gray-600 whitespace-nowrap">{{ w.range }}</td>
              <td class="px-3 py-2.5 text-center text-gray-600 tabular-nums">{{ w.days }}</td>
              <td v-for="col in sessionDateTable.columns" :key="col.key" class="px-3 py-2.5 text-right text-gray-700 tabular-nums whitespace-nowrap">{{ col.fee != null ? money(col.fee) : '—' }}</td>
              <td class="px-4 py-2.5 text-right font-semibold text-primary tabular-nums whitespace-nowrap">{{ w.perDay ? money(w.perDay) : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Fallback: simple price list -->
      <div v-else-if="priceList.length" class="rounded-xl border border-gray-200 overflow-hidden">
        <div class="px-4 py-2 bg-gray-50 text-[11px] font-bold uppercase tracking-wide text-gray-500">Sessions &amp; pricing</div>
        <div v-for="p in priceList" :key="p.label" class="flex items-center justify-between px-4 py-2 text-sm border-t border-gray-100 first:border-t-0">
          <span class="text-gray-700">{{ p.label }}</span>
          <span class="font-semibold text-gray-800 tabular-nums">{{ p.fee != null ? money(p.fee) : '—' }}</span>
        </div>
      </div>

      <!-- Discounts — nudge to register -->
      <div v-if="activeDiscounts.length" class="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <p class="text-sm font-bold text-emerald-800 flex items-center gap-1.5"><i class="pi pi-tag" /> Save when you register</p>
        <ul class="mt-2 space-y-1.5">
          <li v-for="(d, di) in activeDiscounts" :key="di" class="flex items-center justify-between gap-3 text-sm text-emerald-800">
            <span class="min-w-0 truncate">{{ d.form_text || d.name }}</span>
            <span class="font-bold whitespace-nowrap">{{ discountLabel(d) }}</span>
          </li>
        </ul>
      </div>

      <Button label="Register" icon="pi pi-arrow-right" icon-pos="right" class="w-full mt-5"
        @click="authModalOpen = true" style="background:var(--brand-primary); border-color:var(--brand-primary)" />
    </div>

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
          {{ st.kind === 'terms' ? 'Summary &amp; payment' : st.subject.label }}
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

            <!-- Programme date table: dates (rows) × session types (columns) + Full day / whole week -->
            <div v-if="isDateTable && sessionDateTable.rows.length" class="rounded-xl border border-gray-200 overflow-x-auto">
              <div class="min-w-[520px]">
                <!-- Header -->
                <div class="grid border-b border-gray-200 bg-gray-50"
                  :style="`grid-template-columns: repeat(${sessionDateTable.columns.length + 2}, minmax(0,1fr))`">
                  <div class="px-3 py-2 text-xs font-semibold text-gray-500">Date</div>
                  <div v-for="(col, ci) in sessionDateTable.columns" :key="col.key" class="px-3 py-2 border-l border-gray-200">
                    <div class="flex items-start gap-2">
                      <input type="checkbox" class="w-4 h-4 accent-primary mt-0.5" :checked="dtColFull(s.key, inst, ci)" @change="dtToggleCol(s.key, inst, ci)" />
                      <div>
                        <p class="text-xs font-semibold text-gray-800">{{ col.title || col.startTime }}<span v-if="col.fee" class="ml-1.5 font-normal text-primary">{{ money(col.fee) }}</span></p>
                        <p v-if="col.startTime" class="text-[11px] text-gray-400 mt-0.5">{{ col.startTime }}</p>
                      </div>
                    </div>
                  </div>
                  <div class="px-3 py-2 border-l border-gray-200">
                    <p class="text-xs font-semibold text-gray-800">Full day</p>
                    <p class="text-[11px] text-gray-400 mt-0.5">All sessions</p>
                  </div>
                </div>
                <!-- Rows (a header row per week) -->
                <template v-for="(row, ri) in sessionDateTable.rows" :key="ri">
                  <div v-if="ri === 0 || row.newWeek" class="grid bg-gray-100 border-y border-gray-200"
                    :style="`grid-template-columns: repeat(${sessionDateTable.columns.length + 2}, minmax(0,1fr))`">
                    <div class="px-3 py-1.5 flex items-center gap-2" :style="`grid-column: 1 / ${sessionDateTable.columns.length + 2}`">
                      <span class="text-xs font-semibold text-gray-600">Week {{ row.weekSeq }}</span>
                      <span class="text-[11px] text-gray-400">— select the whole week</span>
                    </div>
                    <div class="border-l border-gray-200 px-3 py-1.5 flex items-center">
                      <input type="checkbox" class="w-4 h-4 accent-primary" :checked="dtWeekFull(s.key, inst, row.weekSeq)" @change="dtToggleWeek(s.key, inst, row.weekSeq)" />
                    </div>
                  </div>
                  <div class="grid border-b border-gray-100 last:border-b-0"
                    :style="`grid-template-columns: repeat(${sessionDateTable.columns.length + 2}, minmax(0,1fr))`">
                    <div class="px-3 py-2.5 flex items-center"><p class="text-sm font-medium text-gray-800">{{ row.weekday }}, {{ row.dayMonth }}</p></div>
                    <div v-for="(cell, ci) in row.cells" :key="ci" class="border-l border-gray-100 px-3 py-2 flex items-center">
                      <input v-if="cell" type="checkbox" class="w-4 h-4 accent-primary" :checked="dtSel(s.key, inst, cell)" :disabled="cell.required" @change="toggleSession(s.key, inst, cell.id, ($event.target as any).checked)" />
                    </div>
                    <div class="border-l border-gray-100 px-3 py-2 flex items-center gap-2">
                      <input type="checkbox" class="w-4 h-4 accent-primary" :checked="dtRowFull(s.key, inst, row)" @change="dtToggleRow(s.key, inst, row)" />
                      <span v-if="dtRowFee(row)" class="text-[11px] text-primary font-medium">{{ money(dtRowFee(row)!) }}</span>
                    </div>
                  </div>
                </template>
              </div>
            </div>

            <!-- Flat list (default) -->
            <template v-else>
              <label v-for="sess in visibleSessions" :key="sess.id"
                class="flex items-center justify-between gap-3 py-1.5 text-sm cursor-pointer">
                <span class="flex items-center gap-2">
                  <input type="checkbox" class="w-4 h-4 accent-primary"
                    :checked="sess.required || sessionSelected(s.key, inst, sess.id)" :disabled="sess.required"
                    @change="toggleSession(s.key, inst, sess.id, ($event.target as any).checked)" />
                  <span class="text-gray-700">{{ sessListLabel(sess) }}</span>
                </span>
                <span v-if="Number(sess.fee)" class="text-gray-500">{{ money(Number(sess.fee)) }}</span>
              </label>
            </template>
          </div>

          <!-- Class choices (form connected to groups) — pick class(es) to join -->
          <div v-if="isChooser(s.key) && groupOptions.length" class="mt-4 border-t border-gray-100 pt-3">
            <p class="text-sm font-semibold text-gray-700 mb-2">Choose your class{{ groupOptions.length > 1 ? '(es)' : '' }}</p>
            <div v-for="(g, gi) in groupOptions" :key="g.id" class="py-1">
              <!-- Programme (code) section header -->
              <p v-if="g.section && (gi === 0 || groupOptions[gi - 1].section !== g.section)"
                class="text-xs font-bold uppercase tracking-wide text-gray-400 mt-2 mb-1">{{ g.section }}</p>
              <label class="flex items-center justify-between gap-3 py-1 text-sm"
                :class="g.full && !g.waitlistable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'">
                <span class="flex items-center gap-2">
                  <input type="checkbox" class="w-4 h-4 accent-primary"
                    :checked="groupSelected(s.key, inst, g.id)"
                    :disabled="g.full && !g.waitlistable"
                    @change="toggleGroup(s.key, inst, g.id, ($event.target as any).checked)" />
                  <span class="text-gray-700">{{ g.name }}</span>
                  <span v-if="g.full && g.waitlistable" class="text-[11px] font-semibold text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">Full — joins the waitlist</span>
                  <span v-else-if="g.full" class="text-[11px] font-semibold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">Full</span>
                  <span v-else-if="g.spaces != null" class="text-[11px] font-semibold text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5">{{ g.spaces }} {{ g.spaces === 1 ? 'space' : 'spaces' }}</span>
                </span>
                <span v-if="g.feeOptions.length === 1" class="text-gray-500 whitespace-nowrap">{{ g.feeOptions[0].label }}</span>
              </label>
              <!-- Per-class fee choice when the picked class offers several -->
              <div v-if="groupSelected(s.key, inst, g.id) && g.feeOptions.length > 1" class="ml-6 mt-1 mb-1.5 space-y-0.5">
                <label v-for="o in g.feeOptions" :key="o.id" class="flex items-center justify-between gap-3 py-1 text-sm cursor-pointer">
                  <span class="flex items-center gap-2">
                    <input type="radio" class="accent-primary" :name="`gfee-${s.key}-${inst}-${g.id}`"
                      :checked="groupFeeSelected(s.key, inst, g.id) === o.id"
                      @change="selectGroupFee(s.key, inst, g.id, o.id)" />
                    <span class="text-gray-600">{{ o.name }}</span>
                  </span>
                  <span class="text-gray-500 whitespace-nowrap">{{ o.label }}</span>
                </label>
              </div>
            </div>
          </div>

          <!-- Fee options (pick one) — group "how do you want to pay?" -->
          <div v-if="isChooser(s.key) && feeOptions.length" class="mt-4 border-t border-gray-100 pt-3">
            <p class="text-sm font-semibold text-gray-700 mb-2">How would you like to pay?</p>
            <label v-for="o in feeOptions" :key="o.id"
              class="flex items-start justify-between gap-3 py-1.5 text-sm cursor-pointer">
              <span class="flex items-start gap-2">
                <input type="radio" class="accent-primary mt-0.5" :name="`fee-${s.key}-${inst}`"
                  :checked="feeOptionSelected(s.key, inst) === o.id"
                  @change="selectFeeOption(s.key, inst, o.id)" />
                <span>
                  <span class="text-gray-700">{{ o.name }}</span>
                  <span v-if="o.description" class="block text-xs text-gray-400">{{ o.description }}</span>
                </span>
              </span>
              <span class="text-gray-500 whitespace-nowrap">{{ o.label }}</span>
            </label>
          </div>

          <!-- Per-instance order summary (itemized, collapses full-day/whole-week) -->
          <div v-if="isChooser(s.key) && hasFees" class="mt-3 bg-gray-50 rounded-lg px-3 py-2 text-sm space-y-1">
            <div v-for="(ln, li) in orderLines(s.key, inst)" :key="li" class="flex justify-between text-gray-600">
              <span class="truncate pr-2">{{ ln.label }}</span>
              <span class="whitespace-nowrap tabular-nums">{{ money(ln.amount) }}</span>
            </div>
            <div class="flex justify-between font-semibold text-gray-800 pt-1 border-t border-gray-200">
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

    <!-- Summary + payment + terms (single-page: always at the end; wizard: its own step) -->
    <section v-if="!isWizard || isTermsStep(step)" class="mb-6">
      <div v-if="hasFees" class="bg-gray-50 rounded-xl px-4 py-3 mb-4 text-sm">
        <p class="text-sm font-semibold text-gray-700 mb-2">Summary</p>
        <template v-for="(ln, li) in fullOrderLines" :key="li">
          <p v-if="ln.heading" class="text-xs font-bold uppercase tracking-wide text-gray-400 mt-2 first:mt-0">{{ ln.label }}</p>
          <div v-else class="flex justify-between text-gray-600 py-0.5">
            <span class="truncate pr-2">{{ ln.label }}</span><span class="tabular-nums whitespace-nowrap">{{ money(ln.amount) }}</span>
          </div>
        </template>
        <p v-if="!fullOrderLines.length" class="text-gray-400">Nothing selected yet.</p>
        <div class="flex justify-between text-base font-bold text-gray-900 pt-2 mt-1 border-t border-gray-200">
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

    <!-- Register / sign-in modal (opened by the "Register" button on the landing) -->
    <Dialog v-model:visible="authModalOpen" modal :dismissable-mask="true" header="Register or sign in" :style="{ width: '95vw', maxWidth: '720px' }">
      <BookingAuthChooser
        :staff="staff" :org-id="context.orgId" :can-go-back="false" subject-mode="register"
        title="How would you like to register?"
        subtitle="Sign in to auto-fill your details, or continue as a guest."
        guest-label="Continue as guest" guest-description="Fill in the form yourself."
        @select-guest="onGuestFromModal" @signed-in="onSignedInFromModal" />
    </Dialog>
  </div>
</template>
