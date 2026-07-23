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
import { conditionsPass, type ConditionCtx } from '~/composables/useFormConditions'
import Sortable from 'sortablejs'
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
  hideHeader?: boolean          // embed: hide the banner/info/description header
  registerToLogin?: boolean     // embed: "Register" sends the visitor to the system login, then back here
  edit?: boolean                // builder edit mode: fields are click-to-edit (inert inputs)
}>()
const emit = defineEmits<{
  (e: 'submit', payload: any): void
  (e: 'edit-field', id: string): void
  /** Edit mode: the top-level items of a subject were dragged into a new order. */
  (e: 'reorder', payload: { subjectKey: string; orderedIds: string[] }): void
}>()

// Edit mode: make each subject's top-level item row drag-sortable. onEnd reports the new
// DOM order of items (fields carry data-field-id, section holders data-section-id) so the
// host reorders its field array. Pinned name fields are filtered out (not draggable).
const editSortables: any[] = []
function registerEditSortable(el: any, subjectKey: string) {
  if (!el || !props.edit || el.__sortable) return
  el.__sortable = Sortable.create(el, {
    handle: '.field-drag-handle', filter: '[data-pinned]', draggable: '[data-field-id],[data-section-id]',
    animation: 150,
    onEnd() {
      const orderedIds = [...el.children]
        .map((c: any) => c.getAttribute?.('data-field-id') || c.getAttribute?.('data-section-id'))
        .filter(Boolean)
      emit('reorder', { subjectKey, orderedIds })
    },
  })
  editSortables.push(el.__sortable)
}
onBeforeUnmount(() => { editSortables.forEach(s => { try { s.destroy() } catch {} }) })

const CORE_ACCOUNTS = ['first', 'last', 'email']

// ── Which group to render ────────────────────────────────────────────────────
const groups = computed<any[]>(() => props.config?.groups ?? [])
const activeGroupId = computed(() => {
  if (props.groupId) return props.groupId
  // Prefer a public/all-audience group, else the first.
  const pub = groups.value.find((g: any) => g.audience === 'public' || g.audience === 'all')
  return (pub ?? groups.value[0])?.id ?? ''
})

// Fall back to the 'general' design (the builder's own default key) — a single-form
// event keeps its design under 'general', so reading strictly by group id returned {}
// and the preview lost its info-icons / description / wizard steps.
const design = computed(() => props.config?.designs?.[activeGroupId.value] ?? props.config?.designs?.general ?? {})
const isWizard = computed(() => design.value?.style === 'tabs')
// The club's own brand colours (Settings → General → Branding). A form inherits them
// so it looks like the club by default; Form Design can override per form.
const brand = ref<{ bg: string | null; text: string | null }>({ bg: null, text: null })
onMounted(async () => {
  const org = props.context?.orgId
  if (!org) return
  try {
    const o = await usePublicApi().org(org)
    brand.value = { bg: o?.brandColor ?? null, text: o?.brandTextColor ?? null }
  } catch { /* branding is decoration — never block the form */ }
})
const withHash = (c: string | null) => (c ? (c.startsWith('#') ? c : `#${c}`) : null)
// Explicit form setting wins, else the club's brand, else near-black.
const stepColor = computed(() => design.value?.stepColor || withHash(brand.value.bg) || '#111827')
const stepTextColor = computed(() => withHash(brand.value.text) || '#ffffff')
function stepLabel(st: any) {
  return st.kind === 'summary' ? 'Summary & payment' : st.kind === 'terms' ? 'Terms & conditions' : st.subject.label
}
// Rich heading: a plain-text value is wrapped in <h2> so it keeps the big/bold look;
// once it's real HTML (formatted in the builder) it's rendered as-is.
const formHeading = computed(() => {
  const h = String(design.value?.formHeading ?? '')
  if (h.includes('<')) return h
  const esc = (h || 'Fill in the form to register').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<h2>${esc}</h2>`
})

// Designed header chrome — banner / info-icons / description / background, the same
// pieces the builder preview shows, so the live form looks like what was designed.
// Show the header block when there's an image OR a title: with an image it's the
// banner, without one it's a plain title row. <FormPreviewBanner> picks which.
const showBanner = computed(() => (design.value?.header === 'custom'
  ? !!design.value?.headerImage
  : !!props.event?.banner_url) || !!props.event?.title)
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
const restrictionCriteria = computed(() => {
  const g = props.event?.gender_restriction ?? null
  return [ageCriteria.value, g ? genderRestrictionLabel(g) : ''].filter(Boolean).join(' · ')
})
const displayEvent = computed(() => {
  const e = props.event
  if (!e || e.criteria || !restrictionCriteria.value) return e
  return { ...e, criteria: restrictionCriteria.value }
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
function getVal(key: string, inst: number, fieldKey: string) { return instAnswers(key, inst)[fieldKey] }
function setVal(key: string, inst: number, fieldKey: string, v: any) { instAnswers(key, inst)[fieldKey] = v }
// Answers are keyed by the field's stable id (fkey), NOT its label, so two fields
// that happen to share a label can never overwrite each other. Label-based lookups
// (visibility conditions, the well-known DOB/Gender/core fields) resolve label →
// field → id first. fkey falls back to label for any field with no id (old configs).
function fkey(f: any) { return f?.id ?? f?.label }
function fieldByLabel(subjectKey: string, label: string) { return allFields(subjectKey).find((f: any) => f.label === label) }
function valByLabel(key: string, inst: number, label: string) { const fld = fieldByLabel(key, label); return fld ? getVal(key, inst, fkey(fld)) : undefined }

// ── Account (SSO) fields ─────────────────────────────────────────────────────
// A login needs all five overarching single-sign-on fields. First/Last always live
// on a person subject; Email/DOB/Gender are optional per type and may be REMOVED from
// a form. When a registrant turns ON "Create a login" for their instance, any of the
// five NOT already on the form are generated right there (required) so they're captured.
const SSO_SPECS = [
  { key: 'first', id: '__sso_first', label: 'First Name', field_type: 'text' },
  { key: 'last', id: '__sso_last', label: 'Last Name', field_type: 'text' },
  { key: 'email', id: '__sso_email', label: 'Email', field_type: 'email' },
  { key: 'dob', id: '__sso_dob', label: 'Date of Birth', field_type: 'date' },
  { key: 'gender', id: '__sso_gender', label: 'Gender', field_type: 'select', options: ['Male', 'Female', 'Non-binary', 'Prefer not to say'] },
] as { key: string; id: string; label: string; field_type: string; options?: string[] }[]
// The on-form field that already supplies an SSO value (by account tag or well-known label), else null.
function subjectSsoField(subjectKey: string, spec: any) {
  return allFields(subjectKey).find((f: any) => {
    if (spec.key === 'first') return f.account === 'first' || f.label === 'First Name'
    if (spec.key === 'last') return f.account === 'last' || f.label === 'Last Name'
    if (spec.key === 'email') return f.account === 'email' || f.label === 'Email' || f.label === 'Email Address'
    if (spec.key === 'dob') return f.label === 'Date of Birth'
    if (spec.key === 'gender') return f.label === 'Gender'
    return false
  }) ?? null
}
// Synthetic field defs for the SSO fields NOT already on this subject's form (ordered First→Gender).
function missingSsoFieldsFor(subjectKey: string) {
  return SSO_SPECS.filter(spec => !subjectSsoField(subjectKey, spec))
    .map(spec => ({ id: spec.id, label: spec.label, field_type: spec.field_type, options: spec.options, is_required: true }))
}
function accountFieldFor(subjectKey: string) { return allFields(subjectKey).find((f: any) => f.field_type === 'account') ?? null }
function accountLoginOn(subjectKey: string, inst: number) {
  const af = accountFieldFor(subjectKey)
  return af ? !!getVal(subjectKey, inst, fkey(af)) : false
}
// The captured SSO value — from the on-form field if present, else the injected synthetic input.
function ssoValueFor(subjectKey: string, inst: number, spec: any) {
  const onForm = subjectSsoField(subjectKey, spec)
  return onForm ? getVal(subjectKey, inst, fkey(onForm)) : getVal(subjectKey, inst, spec.id)
}
function instanceAccount(subjectKey: string, inst: number) {
  if (!accountLoginOn(subjectKey, inst)) return null
  // TODO: server forwards this to the SSO layer
  return {
    wantsLogin: true,
    sso: {
      first_name: ssoValueFor(subjectKey, inst, SSO_SPECS[0]) ?? '',
      last_name: ssoValueFor(subjectKey, inst, SSO_SPECS[1]) ?? '',
      email: ssoValueFor(subjectKey, inst, SSO_SPECS[2]) ?? '',
      dob: ssoValueFor(subjectKey, inst, SSO_SPECS[3]) ?? '',
      gender: ssoValueFor(subjectKey, inst, SSO_SPECS[4]) ?? '',
    },
  }
}

// ── Visibility conditions (same operators as the builder) ─────────────────────
// ── Conditions about the PERSON, not about an answer ─────────────────────────
// `person:member_status` / `person:person_type` need to know WHO is registering, which
// the form only knows once they've signed in (or staff picked them). Unknown person =
// condition FAILS, so a members-only question never shows to a stranger.
// `person:group` is different: when the form asks them to choose a class, the answer is
// their SELECTION on this form — no identity needed. It falls back to the classes they
// already belong to when the form has no chooser.
const identifiedPerson = ref<any>(null)
const identifiedGroupIds = ref<string[]>([])

// Conditions are evaluated by the SHARED pure evaluator (composables/useFormConditions),
// which the server imports too — the price shown here and the price stored on submit
// have to come from the same rules.
function condCtx(key: string, inst: number): ConditionCtx {
  const chosenGroups = Object.entries(groupSel[key]?.[inst - 1] ?? {}).filter(([, on]) => on).map(([id]) => id)
  const p: any = identifiedPerson.value
  return {
    answer: (label: string) => valByLabel(key, inst, label),
    // Age from the DOB answered on THIS form when it asks (works for a guest),
    // falling back to the person's stored date of birth.
    age: ageFromDob((valByLabel(key, inst, 'Date of Birth') as any) || p?.dob || null),
    // A form that asks them to pick a class answers "are they in X" itself.
    groupIds: groupOptions.value.length ? chosenGroups : (p ? identifiedGroupIds.value : undefined),
    personTypes: p ? (p.person_types ?? []) : undefined,
    memberStatus: p
      ? String(p.membership_status ?? (p.membership_type ? 'active_member' : 'non_member'))
      : '',
  }
}
function condPasses(conds: any[], key: string, inst: number) {
  return conditionsPass(conds, condCtx(key, inst))
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
  // ── Field-level financial rules ──
  // "Add $20 when they tick Needs a uniform." These were captured in the builder and
  // applied NOWHERE — the price a club designed and the price a registrant paid could
  // differ. A rule only counts when its own field is visible: a hidden question can't
  // charge you.
  for (const f of allFields(key)) {
    if (!f.has_financial_increase || !(f.financial_rules ?? []).length) continue
    if (!fieldVisible(f, key, inst)) continue
    for (const rule of f.financial_rules) {
      const amount = Number(rule.amount) || 0
      if (!amount) continue
      if (!condPasses(rule.conditions ?? [], key, inst)) continue
      // Add the fee (or subtract a discount) to the TOTAL — this used to push to a
      // nonexistent `rows`, so a field fee (e.g. "Gluten Free +$20") showed as a line
      // item but never reached the total (and threw when the block actually ran).
      total += rule.fee_type === 'discount' ? -amount : amount
    }
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
  // Field-level financial rules as line items (e.g. "Gluten Free +$20") — the builder
  // shows these inline, so the live form must too, or the two disagree.
  for (const f of allFields(key)) {
    if (!f.has_financial_increase || !(f.financial_rules ?? []).length) continue
    if (!fieldVisible(f, key, inst)) continue
    for (const rule of f.financial_rules) {
      const amount = Number(rule.amount) || 0
      if (!amount) continue
      if (!condPasses(rule.conditions ?? [], key, inst)) continue
      const signed = rule.fee_type === 'discount' ? -amount : amount
      rows.push({ label: rule.fee_name || (rule.fee_type === 'discount' ? `${f.label} discount` : f.label), amount: signed })
    }
  }
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

// ── Discounts: evaluate the event's discount rules against the live selection ──
const totalInstances = computed(() => choosers.value.reduce((n, s) => n + count(s.key), 0))
function instanceAge(key: string, inst: number): number | null {
  const dob = valByLabel(key, inst, 'Date of Birth')
  if (!dob) return null
  const d = new Date(dob as any); if (isNaN(d.getTime())) return null
  const ref = props.event?.start_at ? new Date(props.event.start_at) : new Date()
  let age = ref.getFullYear() - d.getFullYear()
  const m = ref.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && ref.getDate() < d.getDate())) age--
  return age
}
function instanceDiscountCtx(key: string, inst: number): DiscountCtx {
  const positiveAmounts = orderLines(key, inst).map(l => l.amount).filter(a => a > 0)
  const selected = visibleSessions.value.filter((s: any) => s.required || sessionSelected(key, inst, s.id))
  const dayKeys = new Set(selected.filter((s: any) => s.start_at).map((s: any) => new Date(s.start_at).toDateString()))
  const rows = sessionDateTable.value.rows
  const fullDay = rows.some(r => dtRowFull(key, inst, r))
  const weekSeqs = [...new Set(rows.map(r => r.weekSeq))]
  const fullWeek = weekSeqs.some(ws => dtWeekFull(key, inst, ws))
  return {
    personCount: totalInstances.value,
    personTotal: instanceTotal(key, inst),
    positiveAmounts,
    selectedSessionCount: selected.length,
    dayCount: dayKeys.size,
    fullDay, fullWeek,
    age: instanceAge(key, inst),
    selectedSessionDates: selected.filter((s: any) => s.start_at).map((s: any) => s.start_at),
    // This person's custom-field answers (keyed by field id/label) — for the 'custom_field' discount condition.
    fieldAnswers: { ...(answers[key]?.[inst - 1] ?? {}) },
  }
}
const oneDiscountOnly = computed(() => !!props.config?.discountSettings?.one_discount_only)
const discountLines = computed(() => {
  if (!(props.discounts ?? []).length) return [] as { formText: string; amount: number }[]
  const perPerson: { name: string; formText: string; amount: number }[][] = []
  for (const s of choosers.value) for (let i = 1; i <= count(s.key); i++) perPerson.push(applicableDiscounts(props.discounts ?? [], instanceDiscountCtx(s.key, i)))
  return aggregateDiscountLines(perPerson, oneDiscountOnly.value)
})
const totalDiscount = computed(() => discountLines.value.reduce((s, d) => s + Number(d.amount ?? 0), 0))
const netTotal = computed(() => Math.max(0, grandTotal.value - totalDiscount.value))

// Per-instance figures for the inline <OrderSummary> shown on each subject step — the
// live twin of the builder's inline summary (same shared component).
function instanceDiscountRows(key: string, inst: number) {
  let list = applicableDiscounts(props.discounts ?? [], instanceDiscountCtx(key, inst))
  if (oneDiscountOnly.value && list.length > 1) list = [list.reduce((a: any, b: any) => (a.amount >= b.amount ? a : b))]
  return list.map((d: any) => ({ label: d.formText || d.name || 'Discount', amount: Number(d.amount) || 0 }))
}
function instanceDiscountSum(key: string, inst: number) {
  return instanceDiscountRows(key, inst).reduce((s, d) => s + d.amount, 0)
}
function instanceNetTotal(key: string, inst: number) {
  return instanceTotal(key, inst) - instanceDiscountSum(key, inst)
}
// Show the inline summary whenever there's a real charge or discount — not only for
// session choosers — so a field fee (Gluten Free +$20) shows its line as soon as it's ticked.
function instanceHasCharges(key: string, inst: number) {
  return orderLines(key, inst).some(l => Number(l.amount) !== 0) || instanceDiscountRows(key, inst).length > 0
}
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
  if (termsList.value.length) s.push({ kind: 'terms' } as any)
  // Always last: the order summary, the payment method and Submit.
  s.push({ kind: 'summary' } as any)
  return s
})
const step = ref(0)
watchEffect(() => { if (step.value > steps.value.length - 1) step.value = Math.max(0, steps.value.length - 1) })
const isTermsStep = (i: number) => steps.value[i]?.kind === 'terms'
const isSummaryStep = (i: number) => steps.value[i]?.kind === 'summary'
const isLastStep = (i: number) => i >= steps.value.length - 1

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
        const v = getVal(s.key, inst, fkey(f))
        if (f.is_required && (v == null || v === '' || v === false || (Array.isArray(v) && !v.length))) {
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
  // Create-a-login: an instance with "Create a login" ON must supply all five SSO
  // fields — the ones on the form AND the injected ones generated beside the toggle.
  for (const s of subjects.value) {
    if (!accountFieldFor(s.key)) continue
    for (let inst = 1; inst <= count(s.key); inst++) {
      if (!accountLoginOn(s.key, inst)) continue
      for (const spec of SSO_SPECS) {
        const v = ssoValueFor(s.key, inst, spec)
        if (v == null || v === '') {
          error.value = `Please complete “${spec.label}” to create a login for ${s.label}${count(s.key) > 1 ? ' ' + inst : ''}.`
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
        const age = ageFromDob(valByLabel(s.key, inst, 'Date of Birth') as any, refDate)
        if (age == null) continue
        const who = `${s.label}${count(s.key) > 1 ? ' ' + inst : ''}`
        if (amin != null && age < amin) { error.value = `${who} must be at least ${amin} year${amin === 1 ? '' : 's'} old for this event.`; return false }
        if (amax != null && age > amax) { error.value = `${who} must be ${amax} or younger for this event.`; return false }
      }
    }
  }
  // Gender restriction: a registrant who states a Gender must match the event's.
  const genderReq = props.event?.gender_restriction ?? null
  if (genderReq) {
    const norm = (v: any) => String(v ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_')
    for (const s of subjects.value) {
      for (let inst = 1; inst <= count(s.key); inst++) {
        const g = norm(valByLabel(s.key, inst, 'Gender'))
        if (!g) continue
        if (g !== norm(genderReq)) {
          const who = `${s.label}${count(s.key) > 1 ? ' ' + inst : ''}`
          error.value = `This event is for ${genderRestrictionLabel(genderReq).toLowerCase()} — ${who} doesn't match.`
          return false
        }
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
  const byAccount: Record<string, string> = {}
  for (const f of allFields(key)) if (f.account) byAccount[f.account] = getVal(key, inst, fkey(f))
  return {
    first_name: byAccount.first ?? valByLabel(key, inst, 'First Name') ?? '',
    last_name: byAccount.last ?? valByLabel(key, inst, 'Last Name') ?? '',
    email: byAccount.email ?? valByLabel(key, inst, 'Email') ?? valByLabel(key, inst, 'Email Address') ?? '',
    phone: valByLabel(key, inst, 'Phone') ?? valByLabel(key, inst, 'Phone Number') ?? '',
  }
}
// ── Communication preferences data (for the shared <CommsPreferences>) ──
// The people a subject can receive club updates on behalf of = the other person
// registrants on this form (skip entities + emergency contacts, like the builder).
const commsRecipientOptions = computed(() => {
  const out: { id: string; label: string }[] = []
  for (const s of subjects.value) {
    if ((s.kind || 'person') === 'entity') continue
    if (/emergency|contact/i.test(s.key) || /emergency|contact/i.test(s.label)) continue
    for (let i = 1; i <= count(s.key); i++) {
      const id = instanceIdentity(s.key, i)
      const nm = [id.first_name, id.last_name].filter(Boolean).join(' ').trim()
      out.push({ id: s.key + '#' + i, label: nm || `${s.label}${count(s.key) > 1 ? ' ' + i : ''}` })
    }
  }
  return out
})
// The club's active communication topics (email/app channels). Optional — if the read
// isn't available (e.g. anonymous public page), the matrix just shows a "no topics" hint.
const commsTopics = ref<{ id: string; name: string; channels: string[] }[]>([])
onMounted(async () => {
  const org = props.context?.orgId
  if (!org) return
  try {
    const list = await useWaitlistsApi().activeTopics(org)
    commsTopics.value = (list ?? []).map((t: any) => ({ id: t.id, name: t.name, channels: t.channels ?? [] }))
  } catch { /* topics are optional decoration on the form */ }
})

function buildPayload() {
  const subjectsOut = subjects.value.map((s: any) => ({
    key: s.key,
    label: s.label,
    kind: s.kind ?? 'person',
    instances: Array.from({ length: count(s.key) }, (_, i) => {
      const inst = i + 1
      const identity = isEntity(s) ? {} : instanceIdentity(s.key, inst)
      // fields = label-keyed (human-readable record); fieldList = the authoritative
      // id-keyed answers the server maps from (so duplicate labels never merge).
      const fieldsOut: Record<string, any> = {}
      const fieldList: { id: string | null; label: string; connected_to: string | null; account: string | null; value: any }[] = []
      for (const f of allFields(s.key)) {
        if (ELEMENT_TYPES.includes(f.field_type)) continue
        const val = getVal(s.key, inst, fkey(f))
        if (val === undefined) continue
        fieldsOut[f.label] = val
        fieldList.push({ id: f.id ?? null, label: f.label, connected_to: f.connected_to ?? null, account: f.account ?? null, value: val })
      }
      const sess = isChooser(s.key)
        ? visibleSessions.value.filter(x => x.required || sessionSelected(s.key, inst, x.id)).map(x => x.id)
        : []
      const groupsOut = isChooser(s.key)
        ? groupOptions.value.filter(g => groupSelected(s.key, inst, g.id))
            .map(g => ({ group_id: g.id, fee_option_id: groupFeeSelected(s.key, inst, g.id) }))
        : []
      // Only when the toggle is on: the five SSO fields the login layer will receive.
      const account = isEntity(s) ? null : instanceAccount(s.key, inst)
      return {
        ...identity, fields: fieldsOut, fieldList, sessions: sess,
        fee: isChooser(s.key) ? instanceTotal(s.key, inst) : 0,
        fee_option_id: isChooser(s.key) ? feeOptionSelected(s.key, inst) : null,
        groups: groupsOut,
        ...(account ? { account } : {}),
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
    totals: { total: netTotal.value, discount: totalDiscount.value, currency: cur.value },
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
const peopleApi = usePeopleApi()
const { resolveFields } = useOrgFieldPolicy()

// The seam hands back a camelCase Person; prefillPrimary reads the snake_case shape
// the profile record used to have (first_name / custom_fields / …). Bridge it.
function toSnakePerson(p: any) {
  return {
    first_name: p.firstName, last_name: p.lastName, email: p.email, phone: p.phone,
    dob: p.dob, gender: p.gender, custom_fields: p.customFields ?? {},
  }
}
const authResolved = ref(!!props.preview || !!props.edit)  // false → show the landing; true → show the form (preview + edit skip it)
const authModalOpen = ref(false)           // "Register" opens the auth chooser in a modal
// Register: normally opens the modal; in an embed with registerToLogin, break out of
// the iframe to the system login page, which returns to this registration (?authed=1)
// so it opens inside the signed-in user's profile.
function onRegisterClick() {
  if (props.registerToLogin && import.meta.client) {
    const origin = window.location.origin
    const back = `/r/${props.context.type}/${props.context.id}?authed=1`
    ;(window.top || window).location.href = `${origin}/login?redirect=${encodeURIComponent(back)}`
    return
  }
  authModalOpen.value = true
}
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
    else v = cf[labelToDefId.value[label]] ?? cf[f.id] ?? cf[label]
    if (v != null && v !== '') setVal(subject.key, 1, fkey(f), v)
  }
  identifiedName.value = [person.first_name, person.last_name].filter(Boolean).join(' ').trim()
  // Kept for person-based visibility conditions (see personCondPasses).
  identifiedPerson.value = person
  loadIdentifiedGroups(person.id)
}

// The classes they already belong to — only needed when the form doesn't ask.
async function loadIdentifiedGroups(personId: string | null | undefined) {
  identifiedGroupIds.value = []
  if (!personId || !props.context?.orgId || groupOptions.value.length) return
  try {
    const rows = await useGroupsApi().membershipsForPerson(props.context?.orgId as string, personId)
    identifiedGroupIds.value = (rows ?? []).map((r: any) => r.groupId ?? r.group_id).filter(Boolean)
  } catch { /* no memberships → conditions simply don't match */ }
}

async function onGuest() { authResolved.value = true }
async function onSignedIn(payload: { email: string; firstName: string; lastName: string; phone: string | null; subjectPersonId?: string | null }) {
  authResolved.value = true
  if (!props.context?.orgId) return
  // If the member chose to register someone they look after, prefill the
  // primary registrant from THAT person; otherwise from the signed-in member.
  if (payload.subjectPersonId) {
    const data = await peopleApi.get(payload.subjectPersonId).catch(() => null)
    if (data) { prefillPrimary(toSnakePerson(data)); return }
  }
  const email = (payload?.email || '').trim().toLowerCase()
  if (email) {
    // Re-fetch the full person (the chooser only carries name/email/phone) so we
    // can prefill DOB, gender and custom fields too. The people search matches the
    // email column; take the exact match.
    const matches = await peopleApi.list(props.context.orgId, { q: email }).catch(() => [])
    const data = matches.find((p: any) => (p.email || '').trim().toLowerCase() === email)
    if (data) prefillPrimary(toSnakePerson(data))
    else identifiedName.value = [payload.firstName, payload.lastName].filter(Boolean).join(' ').trim()
  }
}
function changeIdentity() {
  authResolved.value = false
  identifiedName.value = ''
  identifiedPerson.value = null
  identifiedGroupIds.value = []
}

const rendererRoute = useRoute()
const rendererUser = useSupabaseUser()
onMounted(async () => {
  if (props.context?.orgId) {
    try {
      const defs = await resolveFields(props.context.orgId)
      const m: Record<string, string> = {}
      for (const d of defs) m[d.label] = d.id
      labelToDefId.value = m
    } catch { /* field engine optional */ }
  }
  // Returning from the system login (?authed=1) with a session → open the form
  // straight in the signed-in user's profile (skip the landing + auth modal).
  if (rendererRoute.query.authed === '1' && rendererUser.value?.email) {
    await onSignedIn({ email: rendererUser.value.email, firstName: '', lastName: '', phone: null })
  }
})

function onNext() { if (step.value < steps.value.length - 1) step.value++ }
function onBack() { if (step.value > 0) step.value-- }
function onSubmit() { if (props.preview) return; if (validate()) emit('submit', buildPayload()) }
</script>

<template>
  <div class="form-renderer" :style="bgStyle">
    <!-- ── Designed header chrome (banner / info / description) — hidden in embed when asked ── -->
    <template v-if="!hideHeader">
      <FormPreviewBanner v-if="showBanner" :design="design" :event="event || {}" />
      <FormPreviewInfoIcons v-if="hasInfoIcons" :design="design" :event="displayEvent" live :cost="costLabel" />
      <FormPreviewDescription v-if="hasDescription" :design="design" :event="event" readonly />
    </template>

    <div class="px-4 sm:px-6 py-6">
    <!-- LANDING: details + sessions (data table) → "Register" opens the auth modal -->
    <div v-if="!authResolved">
      <div class="prose prose-sm max-w-none text-gray-900 mb-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-gray-800 [&_h2]:mb-0" v-html="formHeading" />

      <!-- What's on offer, as a table (desktop) / stacked cards (mobile) -->
      <div v-if="weekSummary.length" class="sm:hidden space-y-2">
        <div v-for="w in weekSummary" :key="w.weekSeq" class="rounded-xl border border-gray-200 p-3">
          <p class="text-sm font-bold text-gray-800 mb-2">Week {{ w.weekSeq }}</p>
          <div class="text-sm divide-y divide-gray-100">
            <div class="flex justify-between gap-3 py-1"><span class="text-gray-500">Dates</span><span class="text-gray-800 text-right">{{ w.range }}</span></div>
            <div class="flex justify-between gap-3 py-1"><span class="text-gray-500">Days</span><span class="text-gray-800">{{ w.days }}</span></div>
            <div v-for="col in sessionDateTable.columns" :key="col.key" class="flex justify-between gap-3 py-1"><span class="text-gray-500">{{ col.title || col.startTime }}</span><span class="text-gray-800 tabular-nums">{{ col.fee != null ? money(col.fee) : '—' }}</span></div>
            <div class="flex justify-between gap-3 py-1"><span class="text-gray-500">Full day</span><span class="font-semibold text-primary tabular-nums">{{ w.perDay ? money(w.perDay) : '—' }}</span></div>
          </div>
        </div>
      </div>
      <div v-if="weekSummary.length" class="hidden sm:block rounded-xl border border-gray-200 overflow-x-auto">
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
        @click="onRegisterClick" style="background:var(--brand-primary); border-color:var(--brand-primary)" />
    </div>

    <template v-else>
    <!-- Identified-registrant banner -->
    <div v-if="identifiedName" class="flex items-center justify-between gap-3 mb-4 rounded-lg bg-green-50 border border-green-100 px-3 py-2">
      <span class="text-sm text-green-800 inline-flex items-center gap-2"><i class="pi pi-check-circle text-green-500" />Registering as <span class="font-semibold">{{ identifiedName }}</span></span>
      <button type="button" class="text-xs font-semibold text-gray-500 hover:text-gray-700" @click="changeIdentity">Change</button>
    </div>

    <div class="prose prose-sm max-w-none text-gray-900 mb-4 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-gray-800 [&_h2]:mb-0" v-html="formHeading" />

    <!-- Step indicator — segments, not a row of dots-and-chevrons: each step gets its
         number and its NAME, and the one you're on is filled with the form's own step
         colour (Form Design → Step colour). -->
    <div v-if="isWizard" class="mb-5 rounded-xl border border-gray-200 overflow-hidden flex divide-x divide-gray-200">
      <button v-for="(st, i) in steps" :key="i" type="button"
        class="flex-1 min-w-0 px-3 py-2.5 text-center transition-colors"
        :class="i === step ? 'text-white' : 'hover:bg-gray-50'"
        :style="i === step ? { background: stepColor, color: stepTextColor } : undefined"
        @click="step = i">
        <span class="block text-xs font-bold" :class="i === step ? '' : 'text-gray-700'">Step {{ i + 1 }}</span>
        <span class="block text-[11px] truncate" :class="i === step ? 'opacity-80' : 'text-gray-400'">{{ stepLabel(st) }}</span>
      </button>
    </div>

    <!-- Subjects -->
    <template v-for="(s, si) in subjects" :key="s.key">
      <section v-if="!isWizard || (steps[step] && steps[step].kind === 'subject' && steps[step].subject.key === s.key)"
        class="mb-7">
        <!-- Heading + description are one rich-text field (intro). Fall back to the
             legacy separate heading for forms built before the merge. -->
        <div v-if="s.intro && s.intro.trim()" class="prose prose-sm max-w-none text-gray-800 mb-2 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-gray-800 [&_h2]:mb-0" v-html="s.intro" />
        <h3 v-else class="text-base font-semibold text-gray-800">{{ s.heading || (s.label + ' register') }}</h3>

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

          <!-- ONE field per row, full width — on the live form and in Preview. A
               two-column form makes every field half a line long and reads as cramped
               at any width. -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3" :ref="el => registerEditSortable(el, s.key)">
            <!-- Pinned (name) -->
            <FormRendererField v-for="f in leadFields(s.key)" :key="f.id"
              :field="f" :value="getVal(s.key, inst, fkey(f))" :editable="edit"
              @update="v => setVal(s.key, inst, fkey(f), v)" @edit="emit('edit-field', f.id)" />
            <!-- Body items + sections -->
            <template v-for="f in bodyItems(s.key)" :key="f.id">
              <div v-if="f.field_type === 'section'" class="col-span-2 mt-2 relative group/sec" :data-section-id="edit ? f.id : undefined">
                <span v-if="edit" class="field-drag-handle absolute right-0 top-0 w-5 h-5 flex items-center justify-center cursor-grab active:cursor-grabbing text-gray-300 hover:text-primary opacity-0 group-hover/sec:opacity-100 transition-opacity z-10" @mousedown.stop><i class="pi pi-arrows-alt text-[11px]" /></span>
                <!-- Heading + description are one rich-text field (intro); fall back to
                     the legacy label/description for sections built before the merge. -->
                <div v-if="f.intro && f.intro.trim()" class="prose prose-sm max-w-none text-gray-800 mb-2 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-gray-800 [&_h2]:mb-0" v-html="f.intro" />
                <template v-else>
                  <p class="text-sm font-bold text-gray-700">{{ f.label }}</p>
                  <p v-if="f.placeholder" class="text-xs text-gray-400 mb-2">{{ f.placeholder }}</p>
                </template>
                <!-- ONE field per row, full width — on the live form and in Preview. A
               two-column form makes every field half a line long and reads as cramped
               at any width. -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormRendererField v-for="c in sectionChildren(s.key, f.id)" :key="c.id"
                    v-show="edit || fieldVisible(c, s.key, inst)"
                    :field="c" :value="getVal(s.key, inst, fkey(c))" :editable="edit"
                    :comms-people="commsRecipientOptions" :comms-topics="commsTopics" :subject-label="s.label"
                    @update="v => setVal(s.key, inst, fkey(c), v)" @edit="emit('edit-field', c.id)" />
                </div>
              </div>
              <FormRendererField v-else v-show="edit || fieldVisible(f, s.key, inst)"
                :field="f" :value="getVal(s.key, inst, fkey(f))" :editable="edit"
                :comms-people="commsRecipientOptions" :comms-topics="commsTopics" :subject-label="s.label"
                @update="v => setVal(s.key, inst, fkey(f), v)" @edit="emit('edit-field', f.id)" />
            </template>
          </div>

          <!-- Account details: the SSO fields a login needs that aren't already on the
               form. Shown only when this instance turned "Create a login" ON. -->
          <div v-if="accountLoginOn(s.key, inst) && missingSsoFieldsFor(s.key).length"
            class="mt-4 border-t border-gray-100 pt-3">
            <p class="text-sm font-semibold text-gray-700 mb-1">Account details</p>
            <p class="text-xs text-gray-400 mb-2">A login needs these details.</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormRendererField v-for="f in missingSsoFieldsFor(s.key)" :key="f.id"
                :field="f" :value="getVal(s.key, inst, fkey(f))"
                @update="v => setVal(s.key, inst, fkey(f), v)" />
            </div>
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

          <!-- Per-instance order summary — the SAME shared component the builder uses. -->
          <div v-if="instanceHasCharges(s.key, inst)" class="mt-3 pt-3 border-t border-gray-100">
            <OrderSummary
              :lines="orderLines(s.key, inst)"
              :discounts="instanceDiscountRows(s.key, inst)"
              :total="instanceNetTotal(s.key, inst)"
              :currency="cur" />
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

    <!-- Terms — its own wizard step (single page: inline, before the summary). -->
    <section v-if="(!isWizard || isTermsStep(step)) && termsList.length" class="mb-6">
      <label class="flex items-start gap-2 text-sm cursor-pointer">
        <input type="checkbox" class="w-4 h-4 mt-0.5 accent-primary" v-model="termsAccepted" />
        <span class="text-gray-700">I accept the <span class="font-medium">terms &amp; conditions</span> and privacy policy.</span>
      </label>
    </section>

    <!-- Summary & payment — the last step (single page: always at the end). -->
    <section v-if="!isWizard || isSummaryStep(step)" class="mb-6">
      <div v-if="hasFees" class="bg-gray-50 rounded-xl px-4 py-3 mb-4 text-sm">
        <p class="text-sm font-semibold text-gray-700 mb-2">Summary</p>
        <template v-for="(ln, li) in fullOrderLines" :key="li">
          <p v-if="ln.heading" class="text-xs font-bold uppercase tracking-wide text-gray-400 mt-2 first:mt-0">{{ ln.label }}</p>
          <div v-else class="flex justify-between text-gray-600 py-0.5">
            <span class="truncate pr-2">{{ ln.label }}</span><span class="tabular-nums whitespace-nowrap">{{ money(ln.amount) }}</span>
          </div>
        </template>
        <p v-if="!fullOrderLines.length" class="text-gray-400">Nothing selected yet.</p>
        <!-- Discounts applied -->
        <div v-for="(d, di) in discountLines" :key="'disc' + di" class="flex justify-between text-emerald-700 py-0.5">
          <span class="truncate pr-2 inline-flex items-center gap-1"><i class="pi pi-tag text-[10px]" />{{ d.formText }}</span>
          <span class="tabular-nums whitespace-nowrap">−{{ money(d.amount) }}</span>
        </div>
        <div class="flex justify-between text-base font-bold text-gray-900 pt-2 mt-1 border-t border-gray-200">
          <span>Total</span><span>{{ money(netTotal) }}</span>
        </div>
      </div>

      <div v-if="paymentMethods.length" class="mb-4">
        <p class="text-sm font-semibold text-gray-700 mb-2">Payment</p>
        <label v-for="m in paymentMethods" :key="m.key" class="flex items-center gap-2 py-1.5 text-sm cursor-pointer">
          <input type="radio" class="accent-primary" :value="m.key" v-model="selectedPayment" />
          <span class="text-gray-700">{{ m.label }}</span>
        </label>
      </div>

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
