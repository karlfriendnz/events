<!--
  FormDesigner — the reusable form builder, extracted from the events forms tab.
  Faithful extraction (Phase 2). Builds one event-linked registration form:
  Who is registering → field editor → live preview (instances, Steps) → Terms → Payment.
  Props: eventId, sessions, orgId, discounts, publicPreview. Self-loads on eventId.
-->
<script setup lang="ts">
import { useToast } from 'primevue/usetoast'

const props = withDefaults(defineProps<{ eventId: string | null; sessions?: any[]; orgId?: string | null; discounts?: any[]; publicPreview?: boolean; discountSettings?: any; feeLineItems?: any[]; ticketTypes?: any[]; hasTickets?: boolean }>(), { sessions: () => [], orgId: null, discounts: () => [], publicPreview: false, feeLineItems: () => [], ticketTypes: () => [], hasTickets: false })

const db = useDb()
const toast = useToast()
const { orgId } = useOrg()
const { uploadFile } = useUpload()
// External deps aliased so the moved code works unchanged.
const sessions = computed(() => props.sessions)
const eventDiscounts = computed(() => props.discounts)
const feeLineItems = computed(() => props.feeLineItems)   // order-summary preview total
const ticketTypes = computed(() => props.ticketTypes)     // payment preview ticket options
const hasTickets = computed(() => props.hasTickets)
const id = props.eventId
const event = ref<any>(null)
const evtDiscountSettings = props.discountSettings ?? reactive({ one_discount_only: false })

// ── moved form-builder script (from events/[id].vue 5308–7361) ──
// No default form is seeded — an event starts with NO forms (chooser/empty state),
// and the first form is created on demand. This is what makes "delete all forms"
// actually stay empty on reload (a saved empty groups list loads as empty).
const evtFormGroupsList = ref<{ id: string; name: string; person_type: string; audience: 'all' | 'members' | 'public' }[]>([])
const evtFormGroupModes = reactive<Record<string, string>>({})
// Which group's name is being inline-renamed (so it shows as a title, not a bare input).
const editingGroupNameId = ref<string | null>(null)
type SessionDisplayMode = 'select' | 'info' | 'hidden'
const evtFormGroupSessions = reactive<Record<string, Record<string, SessionDisplayMode>>>({
  'general': {},
})
const currentFormGroupSessions = computed(() => evtFormGroupSessions[selectedFormGroupId.value] ?? {})

// Per-subject session overrides: which sessions/options each subject type can
// choose, e.g. a Team picks 3 options while a Player picks 4 different ones.
// Falls back to the group-level config when a subject has no override.
// Shape: { [groupId]: { [subjectKey]: { [sessionId]: mode } } }
const evtFormSubjectSessions = reactive<Record<string, Record<string, Record<string, SessionDisplayMode>>>>({})
// Which subject the Sessions config section is currently editing ('' = all subjects / group default).
const evtSessionConfigSubject = ref<string>('')

function getSessionMode(sessionId: string, subjectKey = ''): SessionDisplayMode {
  if (subjectKey) {
    const ov = evtFormSubjectSessions[selectedFormGroupId.value]?.[subjectKey]?.[sessionId]
    if (ov) return ov
  }
  return currentFormGroupSessions.value[sessionId] ?? 'select'
}
function setSessionMode(sessionId: string, mode: SessionDisplayMode, subjectKey = '') {
  if (subjectKey) {
    if (!evtFormSubjectSessions[selectedFormGroupId.value]) evtFormSubjectSessions[selectedFormGroupId.value] = {}
    if (!evtFormSubjectSessions[selectedFormGroupId.value][subjectKey]) evtFormSubjectSessions[selectedFormGroupId.value][subjectKey] = {}
    evtFormSubjectSessions[selectedFormGroupId.value][subjectKey][sessionId] = mode
  } else {
    if (!evtFormGroupSessions[selectedFormGroupId.value]) evtFormGroupSessions[selectedFormGroupId.value] = {}
    evtFormGroupSessions[selectedFormGroupId.value][sessionId] = mode
  }
  persistEvtFormConfig?.()
}
// Set every session to one mode for the current config scope (the selected subject).
function evtSetAllSessions(mode: SessionDisplayMode) {
  const subj = evtSessionConfigSubject.value
  sessions.value.filter((s: any) => s.display_on_form !== false).forEach((s: any) => {
    const sid = s.id ?? s._savedId
    if (sid) setSessionMode(sid, mode, subj)
  })
}
function evtSelectAllFormSessions() {
  const map: Record<string, SessionDisplayMode> = {}
  sessions.value.filter((s: any) => s.display_on_form !== false).forEach((s: any) => {
    const sid = s.id ?? s._savedId
    if (sid) map[sid] = evtFormGroupSessions[selectedFormGroupId.value]?.[sid] ?? 'select'
  })
  evtFormGroupSessions[selectedFormGroupId.value] = map
}

const selectedFormGroupId = ref('')
const evtFormShowSections = ref(false)
const evtSelectedFormSection = ref('')
watch(
  () => evtSelectedFormSection.value,
  (section) => {
    if (section !== 'sessions') return
    if (!Object.keys(evtFormGroupSessions[selectedFormGroupId.value] ?? {}).length) evtSelectAllFormSessions()
  }
)
const evtFormFieldsTab = ref('existing')
const evtFormTermsSelections = ref<string[]>([])
// Preview interactivity
const evtPreviewSessionSelections = ref<Record<number, Record<string, boolean>>>({})
function isSessionSelected(personIdx: number, sessionId: string, required: boolean): boolean {
  if (required) return true
  return evtPreviewSessionSelections.value[personIdx]?.[sessionId] ?? false
}
function togglePreviewSession(personIdx: number, sessionId: string) {
  const personMap = { ...(evtPreviewSessionSelections.value[personIdx] ?? {}) }
  personMap[sessionId] = !personMap[sessionId]
  evtPreviewSessionSelections.value = { ...evtPreviewSessionSelections.value, [personIdx]: personMap }
}
function isDateFullySelected(personIdx: number, dateLabel: string): boolean {
  const sessionsForDate = sessions.value.filter((s: any) => {
    const dl = s.start_at ? new Date(s.start_at).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) : ''
    return dl === dateLabel && !s.required && s.display_on_form !== false && sessionVisibleOnForm(s) && getSessionMode(s.id ?? s._savedId) === 'select'
  })
  return sessionsForDate.length > 0 && sessionsForDate.every((s: any) => evtPreviewSessionSelections.value[personIdx]?.[s.id ?? s._savedId])
}
function toggleDateSessions(personIdx: number, dateLabel: string) {
  const sessionsForDate = sessions.value.filter((s: any) => {
    const dl = s.start_at ? new Date(s.start_at).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) : ''
    return dl === dateLabel && !s.required && s.display_on_form !== false && sessionVisibleOnForm(s) && getSessionMode(s.id ?? s._savedId) === 'select'
  })
  const allSelected = sessionsForDate.every((s: any) => evtPreviewSessionSelections.value[personIdx]?.[s.id ?? s._savedId])
  const personMap = { ...(evtPreviewSessionSelections.value[personIdx] ?? {}) }
  for (const s of sessionsForDate) personMap[s.id ?? s._savedId] = !allSelected
  evtPreviewSessionSelections.value = { ...evtPreviewSessionSelections.value, [personIdx]: personMap }
}
function isColumnFullySelected(personIdx: number, colIdx: number): boolean {
  const col = formSessionDateTable.value.columns[colIdx]
  if (!col) return false
  const colSessions = formSessionDateTable.value.rows
    .map(r => r.cells[colIdx])
    .filter((s): s is any => !!s && !s.required)
  return colSessions.length > 0 && colSessions.every((s: any) => evtPreviewSessionSelections.value[personIdx]?.[s.id ?? s._savedId])
}
function toggleAllColumnSessions(personIdx: number, colIdx: number) {
  const colSessions = formSessionDateTable.value.rows
    .map(r => r.cells[colIdx])
    .filter((s): s is any => !!s && !s.required)
  const allSelected = isColumnFullySelected(personIdx, colIdx)
  const personMap = { ...(evtPreviewSessionSelections.value[personIdx] ?? {}) }
  for (const s of colSessions) {
    personMap[s.id ?? s._savedId] = !allSelected
  }
  evtPreviewSessionSelections.value = { ...evtPreviewSessionSelections.value, [personIdx]: personMap }
}
const evtPreviewPayment = ref<string | null>(null)
const evtPreviewPlanFreq = ref<string>('')
const evtPreviewTermsAgreed = ref<Set<string>>(new Set())
const evtPreviewResponse = ref<string | null>(null)
const evtGroupPickerOpen = ref(false)
const evtGroupPickerHover = ref<string | null>(null)

function sessionFeeAmount(s: any): number | null {
  if (!s._feesConfig?.is_charged) return null
  if (s._feesConfig.all_charged_equally) {
    return (s._feesConfig.base_fees ?? []).reduce((sum: number, f: any) => sum + (f.amount ?? 0), 0)
  }
  const grp = s._feesConfig.groups?.[0]
  if (grp) return (grp.fees ?? []).reduce((sum: number, f: any) => sum + (f.amount ?? 0), 0)
  return null
}

const formSessionDateTable = computed(() => {
  const visible = sessions.value.filter((s: any) =>
    s.display_on_form !== false &&
    sessionVisibleOnForm(s) &&
    getSessionMode(s.id ?? s._savedId) !== 'hidden' &&
    s.start_at  // exclude sessions without a date/time (they'd create an empty column)
  )
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })

  // Key columns by time range so sessions at the same time are in the same column
  const timeKeyOf = (s: any) => `${fmtTime(s.start_at)}|${s.end_at ? fmtTime(s.end_at) : ''}`
  const uniqueTimeKeys = [...new Set(visible.map(timeKeyOf))]
  const dateKeys = [...new Set(
    visible.filter((s: any) => s.start_at).map((s: any) => new Date(s.start_at).toDateString())
  )].sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

  const columns = uniqueTimeKeys.map(tk => {
    const inCol = visible.filter((s: any) => timeKeyOf(s) === tk)
    const rep = inCol[0]
    const fee = rep ? sessionFeeAmount(rep) : null
    // Use a common title only if every session in this time slot shares the same title
    const titles = [...new Set(inCol.map((s: any) => s.title || 'Untitled'))]
    return {
      key: tk,
      title: titles.length === 1 ? titles[0] : null,
      startTime: rep?.start_at ? fmtTime(rep.start_at) : null,
      endTime: rep?.end_at ? fmtTime(rep.end_at) : null,
      fee,
    }
  })

  const isoWeek = (d: Date) => {
    const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7))
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
    return Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  }

  const rows = dateKeys.map((dk, i) => {
    const date = new Date(dk)
    const weekday = date.toLocaleDateString('en-AU', { weekday: 'long' })
    const dayMonth = date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
    const week = isoWeek(date)
    const prevWeek = i > 0 ? isoWeek(new Date(dateKeys[i - 1])) : week
    return {
      label: `${weekday} ${dayMonth}`,
      weekday,
      dayMonth,
      newWeek: i > 0 && week !== prevWeek,
      cells: uniqueTimeKeys.map(tk => {
        const s = visible.find((s: any) =>
          timeKeyOf(s) === tk &&
          s.start_at &&
          new Date(s.start_at).toDateString() === dk
        )
        return s ?? null
      }),
    }
  })

  return { columns, rows }
})

const formSessionGroupPicker = computed(() => {
  const visible = sessions.value.filter((s: any) =>
    s.display_on_form !== false &&
    sessionVisibleOnForm(s) &&
    getSessionMode(s.id ?? s._savedId) !== 'hidden'
  )
  const titleMap = new Map<string, any[]>()
  for (const s of visible) {
    const t = s.title || 'Untitled'
    if (!titleMap.has(t)) titleMap.set(t, [])
    titleMap.get(t)!.push(s)
  }
  return [...titleMap.entries()].map(([title, items]) => ({ title, items, hasChildren: items.length > 1 }))
})

const formPanelSessionsWithHeaders = computed(() => {
  const visible = sessions.value.filter((s: any) => s.display_on_form !== false && sessionVisibleOnForm(s))
  const result: Array<{ type: 'header'; label: string } | { type: 'session'; session: any }> = []
  let lastDate = ''
  for (const s of visible) {
    const dateLabel = s.start_at
      ? new Date(s.start_at).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
      : ''
    if (dateLabel && dateLabel !== lastDate) {
      result.push({ type: 'header', label: dateLabel })
      lastDate = dateLabel
    }
    result.push({ type: 'session', session: s })
  }
  return result
})

const simplePersonCount = ref(1)
const simpleOpenIdx = ref(0)
const simplePersonNames = ref<{ first: string; last: string }[]>([{ first: '', last: '' }])

watch(simplePersonCount, (n, prev) => {
  while (simplePersonNames.value.length < n) simplePersonNames.value.push({ first: '', last: '' })
  if (simplePersonNames.value.length > n) simplePersonNames.value.splice(n)
  if (n > prev) simpleOpenIdx.value = n - 1
})
function toggleEvtPreviewAgree(label: string) {
  const s = new Set(evtPreviewTermsAgreed.value)
  if (s.has(label)) s.delete(label); else s.add(label)
  evtPreviewTermsAgreed.value = s
}
const evtFormPayment = reactive({
  invoice: { enabled: false, bank_account: '' },
  plan: { enabled: false, frequencies: [] as string[], due_date: '', first_amount: 'scheduled', schedule_min: 'scheduled', schedule_min_value: '' },
  credit_card: { enabled: false },
  coupon: { enabled: false, quantity: 2 },
})

function toggleEvtPlanFrequency(f: string) {
  const idx = evtFormPayment.plan.frequencies.indexOf(f)
  if (idx >= 0) evtFormPayment.plan.frequencies.splice(idx, 1)
  else evtFormPayment.plan.frequencies.push(f)
}

watch(() => evtFormPayment.plan.frequencies, (freqs) => {
  if (freqs.length > 0 && !freqs.includes(evtPreviewPlanFreq.value)) evtPreviewPlanFreq.value = freqs[0]
  else if (freqs.length === 0) evtPreviewPlanFreq.value = ''
}, { immediate: true })


const evtPreviewPlanDay = ref('Monday')
const evtPreviewPlanDate = ref(1)
const weekDays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const monthDates = Array.from({ length: 28 }, (_, i) => i + 1)
function ordinal(n: number) {
  const s = ['th','st','nd','rd']; const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
const evtPlanScheduleRows = computed(() => {
  const freq = evtPreviewPlanFreq.value
  const today = new Date()
  const fmt = (d: Date) => d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
  const rows: Array<[string, string]> = [['Payment 1', 'Due today']]
  if (freq === 'weekly' || freq === 'fortnightly') {
    const dayIdx = weekDays.indexOf(evtPreviewPlanDay.value)
    const domIdx = dayIdx === 6 ? 0 : dayIdx + 1
    const current = today.getDay()
    let diff = domIdx - current; if (diff <= 0) diff += 7
    const step = freq === 'weekly' ? 7 : 14
    for (let i = 1; i < 4; i++) {
      const d = new Date(today); d.setDate(today.getDate() + diff + (i - 1) * step)
      rows.push([`Payment ${i + 1}`, fmt(d)])
    }
  } else {
    for (let i = 1; i < 4; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, evtPreviewPlanDate.value)
      rows.push([`Payment ${i + 1}`, fmt(d)])
    }
  }
  return rows
})

// ── Form Fields ─────────────────────────────────────────────────────────────

interface FieldCondition {
  id: string
  field: string
  operator: string
  value: string
}

interface FinancialRule {
  id: string
  conditions: FieldCondition[]
  account_code: string
  fee_name: string
  fee_type: 'increase' | 'discount'
  amount: string
}

interface FormField {
  id: string
  label: string
  field_type: string
  is_required: boolean
  placeholder: string
  options?: string[]
  col_span?: 1 | 2
  // Extended editor fields
  system_name?: string
  has_placeholder?: boolean
  has_helper_text?: boolean
  helper_text?: string
  min_length?: number | null
  max_length?: number | null
  connected_to?: string
  has_visibility_conditions?: boolean
  visibility_conditions: FieldCondition[]
  financial_rules: FinancialRule[]
  has_financial_increase?: boolean
  // Core/account fields, locking, pinning, subject target, and section nesting.
  core?: boolean
  pinned?: boolean
  account?: string | null
  locked?: boolean
  system?: boolean
  permission_group_id?: string
  target?: string
  // Marks an auto-seeded section bundle (e.g. the parent account/comms section).
  auto_section?: string
  // Id of the section element this item is nested inside (null/undefined = top level).
  parent_section?: string | null
}

interface OrderRow { label: string; amount: number }

const evtFieldMeta: Record<string, { field_type: string; icon: string; placeholder: string; options?: string[] }> = {
  'First Name':           { field_type: 'text',     icon: 'pi-user',       placeholder: 'John' },
  'Last Name':            { field_type: 'text',     icon: 'pi-user',       placeholder: 'Smith' },
  'Email Address':        { field_type: 'email',    icon: 'pi-envelope',   placeholder: 'john@example.com' },
  'Email':                { field_type: 'email',    icon: 'pi-envelope',   placeholder: 'john@example.com' },
  'Phone Number':         { field_type: 'tel',      icon: 'pi-phone',      placeholder: '+64 21 000 0000' },
  'Date of Birth':        { field_type: 'date',     icon: 'pi-calendar',   placeholder: '' },
  'Gender':               { field_type: 'select',   icon: 'pi-user',       placeholder: 'Select gender', options: ['Male','Female','Non-binary','Prefer not to say'] },
  'Member Number':        { field_type: 'text',     icon: 'pi-hashtag',    placeholder: 'e.g. M12345' },
  'Club':                 { field_type: 'text',     icon: 'pi-shield',     placeholder: 'Club name' },
  'Emergency Contact':    { field_type: 'text',     icon: 'pi-heart',      placeholder: 'Name and phone number' },
  'Medical Notes':        { field_type: 'textarea', icon: 'pi-file-edit',  placeholder: 'Any medical conditions we should know about' },
  'Dietary Requirements': { field_type: 'textarea', icon: 'pi-tag',        placeholder: 'e.g. Vegetarian, Gluten free' },
  'T-Shirt Size':         { field_type: 'select',   icon: 'pi-box',        placeholder: 'Select size', options: ['XS','S','M','L','XL','XXL'] },
  'Bus Pickup Location':  { field_type: 'select',   icon: 'pi-map-marker', placeholder: 'Select pickup location', options: ['City Centre','North Shore','South','West'] },
  'Team Name':            { field_type: 'text',     icon: 'pi-users',      placeholder: 'Team name' },
}

// ── Core identity fields ──────────────────────────────────────────────────────
// These five belong to the person's login ACCOUNT, not the form. The registrant
// signs in before reaching this form, so the account-known fields (name, email)
// render pre-filled + read-only; date of birth and gender are core to the person
// but captured here once. People only — entities (Team/Company) never get them.
// They auto-seed onto every person subject as locked-but-reorderable fields (like
// the global "Relationship to member"), so they can be moved anywhere but never
// removed or re-added. `account` names which signed-in value pre-fills the field.
const EVT_CORE_FIELDS: { label: string; field_type: string; account: string | null; pinned?: boolean; placeholder?: string; options?: string[] }[] = [
  { label: 'First Name',    field_type: 'text',   account: 'first',  pinned: true, placeholder: 'John' },
  { label: 'Last Name',     field_type: 'text',   account: 'last',   pinned: true, placeholder: 'Smith' },
  { label: 'Email',         field_type: 'email',  account: 'email',  placeholder: 'john@example.com' },
  { label: 'Date of Birth', field_type: 'date',   account: null,     placeholder: '' },
  { label: 'Gender',        field_type: 'select', account: null,     options: ['Male', 'Female', 'Non-binary', 'Prefer not to say'] },
]
// The preview shows the form as a fresh, NOT-signed-in registrant would see it:
// every field starts blank and editable. (We deliberately don't simulate a logged-in
// account pre-filling name/email — kept as empty stubs for any legacy references.)
const evtPreviewAccount: Record<string, string> = { first: '', last: '', email: '' }
function evtIsPrimaryRegistrant(_subjectKey: string, _inst: number) { return false }
function evtCoreReadOnly(_subjectKey: string, _inst: number, _field: any) { return false }
// Seed the core fields onto a (person) subject — mirrors evtEnsureGlobalFields.
function evtEnsureCoreFields(subject: any) {
  if (!subject?.key || (subject.kind ?? '') === 'entity') return
  const fields = ensureEvtGroupFields()
  // Insert core fields at the front (before required org fields) on first seed, so
  // a fresh subject reads name → email → … top-down; reordering is free afterwards.
  const seed: any[] = []
  for (const cf of EVT_CORE_FIELDS) {
    if (fields.some((f: any) => f.label === cf.label && (f.target || '') === subject.key)) continue
    seed.push({
      id: crypto.randomUUID(), label: cf.label, field_type: cf.field_type,
      is_required: true, locked: true, core: true, pinned: !!cf.pinned, account: cf.account,
      placeholder: cf.placeholder || '', options: cf.options || [],
      col_span: 1, visibility_conditions: [], financial_rules: [], target: subject.key,
    })
  }
  if (seed.length) fields.unshift(...seed)
}
// Core field labels are always-present (marked "Always" in the library, not
// re-addable, available as condition targets).
const evtAlwaysPresentFields = EVT_CORE_FIELDS.map(f => f.label)

const evtFormGroupFields = reactive<Record<string, FormField[]>>({})
const currentEvtFormFields = computed(() => evtFormGroupFields[selectedFormGroupId.value] ?? [])

// Who is registering — per-form subject-type profiles (people + entities) with
// per-form min/max limits. Edited via the reusable <FormProfilesEditor>.
const evtFormGroupProfiles = reactive<Record<string, { key: string; label: string; min: number; max: number | null; kind?: string }[]>>({})
const currentEvtFormProfiles = computed({
  get: () => evtFormGroupProfiles[selectedFormGroupId.value] ?? [],
  set: (v) => { evtFormGroupProfiles[selectedFormGroupId.value] = v; persistEvtFormConfig() },
})
// Active subject whose fields are being configured. Each subject (person/entity)
// owns its own slice of the form's fields via field.target === subject key.
const evtFieldTarget = ref<string>('')
const currentEvtSubject = computed(() => currentEvtFormProfiles.value.find(p => p.key === evtFieldTarget.value) ?? null)
function fieldTargetOf(f: any) { return f.target || '' }
// Memoised: fields bucketed by their resolved subject key (legacy untargeted →
// first subject). Built once per fields/profiles change, so per-subject reads in
// the render loops are O(1) instead of an O(fields) filter each time.
const evtFieldsBySubject = computed(() => {
  const firstKey = currentEvtFormProfiles.value[0]?.key ?? ''
  const map: Record<string, any[]> = {}
  for (const f of currentEvtFormFields.value) {
    const key = (f.target || '') || firstKey
    ;(map[key] ||= []).push(f)
  }
  return map
})
// Required NSO/club field defs bucketed by target ('' = applies to every subject).
function evtRequiredDefsFor(key: string) {
  // A shared field can be required for several subjects — include it for each it applies to.
  return evtOrgFieldDefs.value.filter((d: any) => d.is_required && evtDefApplies(d, key))
}
// Fields belonging to the active subject.
const evtVisibleFields = computed(() => evtFieldsBySubject.value[evtFieldTarget.value] || [])
function openEvtSubject(key: string) {
  evtFieldTarget.value = key
  evtSelectedFieldId.value = null
  evtSelectedFormSection.value = 'fields'
}
function patchEvtProfile(i: number, patch: Partial<{ min: number; max: number | null; selectsOptions: boolean; label: string; labelPlural: string; intro: string; heading: string }>) {
  const next = currentEvtFormProfiles.value.slice()
  next[i] = { ...next[i], ...patch }
  currentEvtFormProfiles.value = next
}
function evtSubjectIcon(p: { key: string; kind?: string }) {
  return (p.kind ?? '') === 'entity' ? 'pi-building' : 'pi-user'
}
// Keep the active field target pointing at a real subject (default = first).
watch([currentEvtFormProfiles, selectedFormGroupId], () => {
  const keys = currentEvtFormProfiles.value.map(p => p.key)
  if (!keys.includes(evtFieldTarget.value)) evtFieldTarget.value = keys[0] ?? ''
}, { immediate: true, deep: true })

// Subject types (people + entities), org + inherited from governing bodies.
const { resolvePersonTypes: _evtResolvePersonTypes, fieldAppliesTo: _evtFieldAppliesTo } = useOrgFieldPolicy()
// Does a field-def apply to subject `key`? Preserves the legacy "no target = applies to
// every subject" semantics, otherwise defers to the shared targets[] predicate.
function evtDefApplies(d: any, key: string) {
  const hasAny = (Array.isArray(d.targets) && d.targets.length) || d.target
  return !hasAny || _evtFieldAppliesTo(d, key)
}
const evtSubjectTypes = ref<{ key: string; label: string; kind: string; min_count: number; max_count: number | null }[]>([])
watch(orgId, async (id) => { evtSubjectTypes.value = id ? await _evtResolvePersonTypes(id) : [] }, { immediate: true })
const evtUnusedPeople = computed(() => evtSubjectTypes.value.filter(t => (t.kind || 'person') === 'person' && !currentEvtFormProfiles.value.some(p => p.key === t.key)))
const evtUnusedEntities = computed(() => evtSubjectTypes.value.filter(t => t.kind === 'entity' && !currentEvtFormProfiles.value.some(p => p.key === t.key)))
const evtShowAddSubject = ref(false)
const evtProfilePresets = PROFILE_PRESETS
// Short "Includes: 1–2 Parent / Guardian, 1–4 Child, …" summary of a preset's roles.
function evtPresetRoleSummary(id: string): string {
  const preset = PROFILE_PRESETS.find(p => p.id === id)
  if (!preset) return ''
  return preset.roles.map(r => {
    const count = r.max == null ? `${r.min}+` : (r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`)
    return `${count} ${r.label}`
  }).join(', ')
}
function applyEvtProfilePreset(preset: any) {
  if (!preset) return
  currentEvtFormProfiles.value = resolvePreset(evtSubjectTypes.value, preset)
  currentEvtFormProfiles.value.forEach(p => { evtEnsureCoreFields(p); evtAddRequiredFieldsFor(p.key); evtEnsureParentSectionFields(p) })
}
function addEvtProfile(t: { key: string; label: string; kind?: string; min_count?: number; max_count?: number | null }) {
  if (currentEvtFormProfiles.value.some(p => p.key === t.key)) return
  const profile = { key: t.key, label: t.label, min: t.min_count ?? 1, max: t.max_count ?? null, kind: t.kind }
  currentEvtFormProfiles.value = [...currentEvtFormProfiles.value, profile]
  evtEnsureCoreFields(profile)
  evtAddRequiredFieldsFor(t.key)
  evtEnsureParentSectionFields(profile)
  evtShowAddSubject.value = false
}
// NSO/club-required fields for a subject type are added to the form automatically
// when that subject is added (so a Member always carries its required fields).
function evtAddRequiredFieldsFor(key: string) {
  const fields = ensureEvtGroupFields()
  for (const d of evtRequiredDefsFor(key)) {
    // Core fields are rendered by the account block, not as dynamic fields.
    if (evtAlwaysPresentFields.includes(d.label)) continue
    if (fields.some((f: any) => f.label === d.label && (f.target || '') === key)) continue
    const meta = evtFieldMeta[d.label] ?? { field_type: 'text', icon: 'pi-minus', placeholder: '' }
    const inherited = inheritedFieldLabels.value.includes(d.label)
    fields.push({ id: crypto.randomUUID(), label: d.label, field_type: meta.field_type, is_required: true, placeholder: meta.placeholder, options: meta.options, col_span: 1, visibility_conditions: [], financial_rules: [], target: key, ...(inherited ? { connected_to: 'profile' } : {}) })
  }
}
// ── Global / locked fields ────────────────────────────────────────────────────
// Some fields are forced onto a subject by the platform itself (not the org's field
// definitions) and CANNOT be removed. E.g. a Parent/Guardian on a parent-child form
// must always declare their "Relationship to member". These auto-add and carry a
// `locked: true` flag the field editor respects (no delete, required stays on).
function evtIsParentSubject(s: any) {
  return /parent|guardian/i.test(s?.key || '') || /parent|guardian/i.test(s?.label || '')
}
function evtFormHasMemberSubject() {
  return currentEvtFormProfiles.value.some(p =>
    /member|child|player|student|swimmer|athlete/i.test(p.key) ||
    /member|child|player|student|swimmer|athlete/i.test(p.label))
}
const EVT_GLOBAL_FIELDS: { label: string; field_type: string; options?: string[]; placeholder?: string; applies: (s: any) => boolean }[] = [
  {
    label: 'Relationship to member', field_type: 'select',
    options: ['Mother', 'Father', 'Guardian', 'Grandparent', 'Caregiver', 'Other'],
    placeholder: 'Select…',
    applies: (s) => evtIsParentSubject(s) && evtFormHasMemberSubject(),
  },
]
function evtEnsureGlobalFields(subject: any) {
  if (!subject?.key) return
  const fields = ensureEvtGroupFields()
  for (const g of EVT_GLOBAL_FIELDS) {
    if (!g.applies(subject)) continue
    if (fields.some((f: any) => f.label === g.label && (f.target || '') === subject.key)) continue
    fields.push({
      id: crypto.randomUUID(), label: g.label, field_type: g.field_type,
      is_required: true, locked: true, placeholder: g.placeholder || '', options: g.options || [],
      col_span: 1, visibility_conditions: [], financial_rules: [], target: subject.key,
    })
  }
}
// By default, a Parent / Guardian subject gets a "login + communications" section:
// a section element holding the account (login) field and the communication-
// preferences field. Seeded once (on add/preset) so it stays removable — not in the
// deep watch, which would re-add it after the user removes it.
function evtEnsureParentSectionFields(subject: any) {
  if (!subject?.key || !evtIsParentSubject(subject)) return
  const fields = ensureEvtGroupFields()
  if (fields.some((f: any) => f.target === subject.key && f.auto_section === 'parent_account_comms')) return
  const sectionId = crypto.randomUUID()
  fields.push({
    id: sectionId, label: 'Login & communications', field_type: 'section',
    is_required: false, placeholder: 'Set up a login for this parent/guardian and choose which club updates they’d like to receive.',
    col_span: 2, visibility_conditions: [], financial_rules: [],
    target: subject.key, auto_section: 'parent_account_comms',
  } as any)
  fields.push({
    id: crypto.randomUUID(), label: 'Create a login', field_type: 'account',
    system: true, is_required: false, placeholder: '', options: [],
    col_span: 1, visibility_conditions: [], financial_rules: [], target: subject.key, parent_section: sectionId,
  } as any)
  fields.push({
    id: crypto.randomUUID(), label: 'Communication preferences', field_type: 'comms',
    system: true, is_required: false, placeholder: '', options: [],
    col_span: 1, visibility_conditions: [], financial_rules: [], target: subject.key, parent_section: sectionId,
  } as any)
}
// Keep global/locked fields present for every subject (covers add, preset, and load).
watch(currentEvtFormProfiles, () => {
  for (const p of currentEvtFormProfiles.value) { evtEnsureCoreFields(p); evtEnsureGlobalFields(p) }
}, { deep: true })

// True when a subject has required (NSO/club) fields that aren't on the form yet.
function evtSubjectMissingRequired(key: string) {
  const reqd = evtRequiredDefsFor(key)
  if (!reqd.length) return false
  const have = new Set((evtFieldsBySubject.value[key] || []).map((f: any) => f.label))
  return reqd.some(d => !have.has(d.label))
}
function removeEvtProfile(i: number) {
  const next = currentEvtFormProfiles.value.slice(); next.splice(i, 1); currentEvtFormProfiles.value = next
}
function evtTargetFieldCount(key: string) {
  return (evtFieldsBySubject.value[key] || []).length
}
// Fields belonging to one subject (memoised via evtFieldsBySubject).
function evtFieldsForSubject(key: string) {
  return evtFieldsBySubject.value[key] || []
}
// The subjects the preview renders as stacked blocks. Falls back to a single
// generic block for legacy forms that have no profiles yet.
const evtPreviewSubjects = computed(() => currentEvtFormProfiles.value.length
  ? currentEvtFormProfiles.value
  : [{ key: '', label: 'Registrant', kind: 'person', min: 1, max: 1, selectsOptions: true }])
// Desktop / mobile preview toggle — narrows the preview card to phone width.
const evtPreviewDevice = ref<'desktop' | 'mobile'>('desktop')
// Public preview — renders the form as a registrant sees it (no builder chrome:
// no Edit-form links, inline-edit heading/description, drag zones, etc.).
const evtPublicPreview = ref(false)
// Which subject(s) choose the sessions / classes / fees. Falls back to the first
// subject when none is explicitly flagged so the picker is never orphaned.
// The shared decision (anyFlagged + the fallback key) is memoised so the per-subject
// check is O(1) and evtChooserSubjects isn't O(subjects²).
const evtSelectsState = computed(() => ({
  empty: !currentEvtFormProfiles.value.length,
  anyFlagged: currentEvtFormProfiles.value.some(x => x.selectsOptions),
  firstKey: evtPreviewSubjects.value[0]?.key,
}))
function evtSubjectSelectsOptions(p: any) {
  const s = evtSelectsState.value
  if (s.empty) return true
  if (s.anyFlagged) return !!p.selectsOptions
  return p.key === s.firstKey
}
function toggleEvtProfileSelects(i: number) {
  const next = currentEvtFormProfiles.value.slice()
  next[i] = { ...next[i], selectsOptions: !next[i].selectsOptions }
  currentEvtFormProfiles.value = next
}
// Per-subject Settings — opens its own full left-panel view (like "Edit form").
const evtSettingsSubjectKey = ref<string>('')
const evtSettingsSubject = computed(() => currentEvtFormProfiles.value.find(p => p.key === evtSettingsSubjectKey.value) ?? null)
const evtSettingsSubjectIndex = computed(() => currentEvtFormProfiles.value.findIndex(p => p.key === evtSettingsSubjectKey.value))
function openEvtSubjectSettings(key: string) {
  evtFieldTarget.value = key
  evtSelectedFormSection.value = 'settings'
}
// Index of the subject currently being edited (drives the inline settings cards
// shown on the subject's page = the fields panel).
const currentEvtSubjectIndex = computed(() => currentEvtFormProfiles.value.findIndex(p => p.key === evtFieldTarget.value))
// The subject page has two tabs: Fields (what you collect) and Settings (how
// many, who chooses, … — room to grow per-subject settings).
const evtSubjectPageTab = ref<'fields' | 'settings'>('fields')
// Open the (per-subject) session/options config for one chooser subject.
function openEvtSubjectSessions(key: string) {
  evtSessionConfigSubject.value = key
  evtFieldTarget.value = key
  evtSelectedFormSection.value = 'sessions'
}
// Drag-to-reorder the subjects ("Who is registering" list) so staff control the
// order they appear in the form (e.g. Team details first).
const evtSubjectListEl = ref<HTMLElement | null>(null)
let evtSubjectSortable: any = null
watch(evtSubjectListEl, (el) => {
  if (evtSubjectSortable) { evtSubjectSortable.destroy(); evtSubjectSortable = null }
  if (!el) return
  evtSubjectSortable = Sortable.create(el, {
    handle: '.subject-drag-handle', animation: 150,
    onEnd: () => {
      const keys = Array.from(el.querySelectorAll<HTMLElement>('[data-subject-key]')).map(n => n.dataset.subjectKey!)
      const cur = currentEvtFormProfiles.value.slice()
      cur.sort((a, b) => keys.indexOf(a.key) - keys.indexOf(b.key))
      currentEvtFormProfiles.value = cur
    },
  })
})
onBeforeUnmount(() => { if (evtSubjectSortable) evtSubjectSortable.destroy() })
// Subjects that can choose options (used by the Sessions config subject tabs).
// Declared after evtPreviewSubjects to avoid a setup-time temporal-dead-zone.
const evtChooserSubjects = computed(() => evtPreviewSubjects.value.filter(p => evtSubjectSelectsOptions(p)))
// Session config is per-subject (no "overall" scope) — default to the first chooser.
watch(evtChooserSubjects, (list) => {
  if (!list.some(c => c.key === evtSessionConfigSubject.value)) evtSessionConfigSubject.value = list[0]?.key ?? ''
}, { immediate: true })

// Step wizard — when Form Style = "Steps" (design.style === 'tabs'), the registration
// preview becomes a wizard: one step per subject, then a Terms & Conditions step.
const evtIsWizard = computed(() => (currentEvtFormDesign.value?.style) === 'tabs')
// In mobile + Steps, the event details become a dedicated FIRST step (with a
// "Click here to register" button) before the subject steps. Gate on evtPreviewDevice
// only (declared earlier) — NOT evtIsWizard (→ currentEvtFormDesign, declared later)
// so the immediate watch below doesn't hit a TDZ at setup.
const evtWizardSteps = computed(() => [
  ...(evtPreviewDevice.value === 'mobile' ? [{ type: 'details', key: '__details', label: 'Details', kind: '' }] : []),
  ...evtPreviewSubjects.value.map(s => ({ type: 'subject', key: s.key, label: s.label, kind: (s as any).kind })),
  { type: 'terms', key: '__terms', label: 'Terms', kind: '' },
])
const evtWizardStep = ref(0)
const evtWizardTermsIdx = computed(() => evtWizardSteps.value.length - 1)
// Wizard step index offset for subjects when the mobile details step is present.
const evtMobileSteps = computed(() => evtIsWizard.value && evtPreviewDevice.value === 'mobile')
const evtSubjectStepOffset = computed(() => (evtMobileSteps.value ? 1 : 0))
const evtOnDetailsStep = computed(() => evtMobileSteps.value && evtWizardStep.value === 0)
// Mobile pill strip = previous / current / next only, with their real indices + position.
const evtMobilePills = computed(() => {
  const steps = evtWizardSteps.value
  const cur = evtWizardStep.value
  const out: { key: string; label: string; idx: number; pos: 'prev' | 'current' | 'next' }[] = []
  for (let i = cur - 1; i <= cur + 1; i++) {
    if (i < 0 || i >= steps.length) continue
    out.push({ key: steps[i].key, label: steps[i].label, idx: i, pos: i < cur ? 'prev' : i > cur ? 'next' : 'current' })
  }
  return out
})
// Source is evtWizardSteps only (NOT evtIsWizard, which references currentEvtFormDesign
// declared later — including it here would eval it at setup and crash with a TDZ).
watch(evtWizardSteps, () => {
  if (evtWizardStep.value > evtWizardSteps.value.length - 1) evtWizardStep.value = Math.max(0, evtWizardSteps.value.length - 1)
})
function evtWizardNext() { if (evtWizardStep.value < evtWizardSteps.value.length - 1) evtWizardStep.value++ }
function evtWizardBack() { if (evtWizardStep.value > 0) evtWizardStep.value-- }
const evtDropTarget = ref<string>('')
function onDropFieldTo(key: string, e: DragEvent) {
  e.preventDefault()
  evtFieldTarget.value = key
  const blockType = e.dataTransfer?.getData('application/x-block')
  if (blockType) evtAddBlockOfType(blockType, key)
  else {
    const label = e.dataTransfer?.getData('application/x-field')
    if (label) addEvtFormField(label)
  }
  isDraggingField.value = false
  dropZoneActive.value = false
  evtDropTarget.value = ''
}
// One Sortable per subject grid (keyed by personIdx:subjectKey). The top-level
// canvas and each section's drop-zone share a group so fields/elements can be
// dragged between them; any drop rebuilds the subject's order + section nesting
// from the canvas DOM. Pinned fields live outside the canvas and are untouched.
const subjectSortables = new Map<string, any>()
// Bumped after a drag so the canvas re-mounts from data, discarding SortableJS's DOM
// mutation cleanly (avoids the Vue + SortableJS duplicate-node problem).
const evtCanvasNonce = ref(0)
// Move a field/element within a subject's data: set its parent_section and slot it
// at newIndex among its destination siblings. Vue re-renders from the data — the
// caller reverts SortableJS's DOM mutation first so there's no duplicate node.
function evtMoveFieldInData(subjectKey: string, movedId: string, newParent: string | null, newIndex: number) {
  const gid = selectedFormGroupId.value
  const list = evtFormGroupFields[gid]
  if (!list) return
  const moved: any = list.find((f: any) => f.id === movedId)
  if (!moved) return
  // Sections can't nest inside sections.
  if (moved.field_type === 'section' && newParent) newParent = null
  const without = list.filter((f: any) => f !== moved)
  moved.parent_section = newParent
  const sibs = without.filter((f: any) =>
    (f.target || '') === subjectKey && !f.pinned && (f.parent_section || null) === (newParent || null))
  let idx: number
  const anchor = sibs[newIndex]
  if (anchor) idx = without.indexOf(anchor)
  else if (sibs.length) idx = without.indexOf(sibs[sibs.length - 1]) + 1
  else if (newParent) idx = without.findIndex((f: any) => f.id === newParent) + 1
  else idx = without.length
  without.splice(idx, 0, moved)
  evtFormGroupFields[gid] = without
  persistEvtFormConfig?.()
}
function evtMakeSortable(el: HTMLElement, sortKey: string, subjectKey: string) {
  return Sortable.create(el, {
    group: `evtf-${sortKey}`, handle: '.field-drag-handle', draggable: '[data-field-key]',
    animation: 150, fallbackOnBody: true,
    onEnd: (evt: any) => {
      const item = evt.item as HTMLElement
      const movedId = item.dataset.fieldKey
      const toEl = evt.to as HTMLElement
      const newIndex = evt.newIndex as number
      if (!movedId) return
      // Destination section = the drop-zone's section holder (else top level).
      const toSection = toEl.matches('[data-evt-dropzone]') ? toEl.closest('[data-field-key]') as HTMLElement | null : null
      evtMoveFieldInData(subjectKey, movedId, toSection ? toSection.dataset.fieldKey || null : null, newIndex)
      // Re-mount the canvas from data so SortableJS's DOM mutation is discarded
      // cleanly (no duplicate/orphan nodes).
      evtCanvasNonce.value++
    },
  })
}
function registerSubjectGrid(el: any, sortKey: string, subjectKey: string) {
  const existing = subjectSortables.get(sortKey)
  if (!el) { if (existing) { existing.destroy(); subjectSortables.delete(sortKey) } ; return }
  if (existing && existing.el === el) return
  if (existing) existing.destroy()
  const s: any = evtMakeSortable(el, sortKey, subjectKey)
  s.el = el
  subjectSortables.set(sortKey, s)
}
// Section drop-zones register under a distinct key (sortKey + section id) but share
// the canvas group, so dragging a field into a section nests it.
function registerSectionDropzone(el: any, sortKey: string, sectionId: string, subjectKey: string) {
  const key = sortKey + '::' + sectionId
  const existing = subjectSortables.get(key)
  if (!el) { if (existing) { existing.destroy(); subjectSortables.delete(key) } ; return }
  if (existing && existing.el === el) return
  if (existing) existing.destroy()
  const s: any = evtMakeSortable(el, sortKey, subjectKey)
  s.el = el
  subjectSortables.set(key, s)
}
onBeforeUnmount(() => { subjectSortables.forEach(s => s.destroy()); subjectSortables.clear() })

// All fields eligible as condition targets (always-present + added fields)
const evtConditionFieldOptions = computed(() => {
  const always = evtAlwaysPresentFields.map(label => ({ id: label, label }))
  const added = currentEvtFormFields.value.filter(f => !evtAlwaysPresentFields.includes(f.label))
  return [...always, ...added]
})

function ensureEvtGroupFields() {
  const gid = selectedFormGroupId.value
  if (!evtFormGroupFields[gid]) evtFormGroupFields[gid] = []
  return evtFormGroupFields[gid]
}

function isEvtFieldAdded(label: string) {
  // Scoped to the active subject so the same field (e.g. Date of Birth) can be
  // collected for more than one subject type on the same form.
  return evtAlwaysPresentFields.includes(label) || evtVisibleFields.value.some(f => f.label === label)
}

function addEvtFormField(label: string, parentSection: string | null = null) {
  if (isEvtFieldAdded(label)) return null
  const meta = evtFieldMeta[label] ?? { field_type: 'text', icon: 'pi-minus', placeholder: '' }
  const id = crypto.randomUUID()
  // National (inherited) fields keep their data wired to the subject's profile —
  // the club can't reassign where it lives.
  const inherited = inheritedFieldLabels.value.includes(label)
  ensureEvtGroupFields().push({ id, label, field_type: meta.field_type, is_required: false, placeholder: meta.placeholder, options: meta.options, col_span: 1, visibility_conditions: [], financial_rules: [], target: evtFieldTarget.value, parent_section: parentSection, ...(inherited ? { connected_to: 'profile' } : {}) })
  return id
}

// System fields are added once per subject; they carry `system: true` so the editor
// hides the Input Type (they're not input-typed) but stay removable.
function evtSystemFieldAdded(sf: { field_type: string }) {
  return evtVisibleFields.value.some(f => (f as any).field_type === sf.field_type)
}
function addEvtSystemField(sf: { field_type: string; label: string }) {
  if (evtSystemFieldAdded(sf)) return
  ensureEvtGroupFields().push({ id: crypto.randomUUID(), label: sf.label, field_type: sf.field_type, is_required: false, system: true, placeholder: '', options: [], col_span: 1, visibility_conditions: [], financial_rules: [], target: evtFieldTarget.value })
}

function removeEvtFormField(id: string) {
  const fields = evtFormGroupFields[selectedFormGroupId.value]
  if (!fields) return
  const idx = fields.findIndex(f => f.id === id)
  if (idx >= 0 && !(fields[idx] as any).locked) fields.splice(idx, 1)
}

function duplicateEvtFormField(id: string) {
  const fields = evtFormGroupFields[selectedFormGroupId.value]
  if (!fields) return
  const idx = fields.findIndex(f => f.id === id)
  if (idx < 0) return
  const original = fields[idx]
  const copy: FormField = {
    ...original,
    id: crypto.randomUUID(),
    label: original.label + ' (copy)',
    system_name: original.system_name ? original.system_name + '_copy' : undefined,
    visibility_conditions: original.visibility_conditions.map(c => ({ ...c, id: crypto.randomUUID() })),
    financial_rules: original.financial_rules.map(r => ({
      ...r,
      id: crypto.randomUUID(),
      conditions: r.conditions.map(c => ({ ...c, id: crypto.randomUUID() })),
    })),
  }
  fields.splice(idx + 1, 0, copy)
  evtSelectedFieldId.value = copy.id
}

function toggleEvtFieldRequired(id: string) {
  const fields = evtFormGroupFields[selectedFormGroupId.value]
  const f = fields?.find(f => f.id === id)
  if (f) f.is_required = !f.is_required
}

const isDraggingField = ref(false)
const dropZoneActive = ref(false)

function startEvtFieldDrag(e: DragEvent, label: string) {
  e.dataTransfer!.effectAllowed = 'copy'
  e.dataTransfer!.setData('application/x-field', label)
  isDraggingField.value = true
}

// Dragging a palette item (Field / Section / Image / Text / Button) onto the form.
function startEvtBlockDrag(e: DragEvent, type: string) {
  e.dataTransfer!.effectAllowed = 'copy'
  e.dataTransfer!.setData('application/x-block', type)
  isDraggingField.value = true
}
// Create a new field/block of the given type on a subject (with sensible defaults)
// and open its editor so the user can configure it. Shared by click + drag-drop.
function evtAddBlockOfType(type: string, key: string, parentSection: string | null = null) {
  // Sections can't nest inside sections (one level only).
  if (type === 'section' && parentSection) parentSection = null
  const id = crypto.randomUUID()
  const base: any = { id, is_required: false, has_placeholder: false, placeholder: '', visibility_conditions: [], financial_rules: [], target: key, parent_section: parentSection }
  const fields = ensureEvtGroupFields()
  if (type === 'section')      fields.push({ ...base, label: 'Section',    field_type: 'section',   col_span: 2 })
  else if (type === 'image')   fields.push({ ...base, label: 'Image',      field_type: 'image',     col_span: 2, options: ['', '', 'center'] })
  else if (type === 'text')    fields.push({ ...base, label: 'Text Block', field_type: 'textblock', col_span: 2, options: ['New text', 'base'] })
  else if (type === 'button')  fields.push({ ...base, label: 'Button',     field_type: 'button',    col_span: 2, options: ['Button', '', 'primary'] })
  else                         fields.push({ ...base, label: 'New Field',  field_type: 'text',      col_span: 1 })
  evtFieldTarget.value = key
  evtSelectedFieldId.value = id
  return id
}
// Drop a palette element or library field INTO a section holder.
function onDropIntoSection(subjectKey: string, sectionId: string, e: DragEvent) {
  e.preventDefault()
  evtFieldTarget.value = subjectKey
  const blockType = e.dataTransfer?.getData('application/x-block')
  if (blockType) { if (blockType !== 'section') evtAddBlockOfType(blockType, subjectKey, sectionId) }
  else {
    const label = e.dataTransfer?.getData('application/x-field')
    if (label) addEvtFormField(label, sectionId)
  }
  isDraggingField.value = false
  dropZoneActive.value = false
  evtDropTarget.value = ''
}

function onEvtFieldDragEnd() {
  isDraggingField.value = false
  dropZoneActive.value = false
}

function onDropField(e: DragEvent) {
  e.preventDefault()
  const key = evtDropTarget.value || evtFieldTarget.value
  const blockType = e.dataTransfer?.getData('application/x-block')
  if (blockType) evtAddBlockOfType(blockType, key)
  else {
    const label = e.dataTransfer?.getData('application/x-field')
    if (label) { evtFieldTarget.value = key; addEvtFormField(label) }
  }
  isDraggingField.value = false
  dropZoneActive.value = false
}

// ── Sortable wiring for the events-form field canvas ────────
import Sortable from 'sortablejs'
const fieldListEl = ref<HTMLElement | null>(null)
let evtFieldSortable: any = null
function destroyEvtFieldSortable() {
  if (evtFieldSortable) { evtFieldSortable.destroy(); evtFieldSortable = null }
}
watch(fieldListEl, (el) => {
  destroyEvtFieldSortable()
  if (!el) return
  evtFieldSortable = Sortable.create(el, {
    handle: '.field-drag-handle',
    animation: 150,
    onEnd: () => {
      const ids = Array.from(el.querySelectorAll<HTMLElement>('[data-field-key]'))
        .map(n => n.dataset.fieldKey!)
      const list = evtFormGroupFields[selectedFormGroupId.value]
      if (!list) return
      list.sort((a: any, b: any) => ids.indexOf(a.id) - ids.indexOf(b.id))
      persistEvtFormConfig?.()
    },
  })
})
onBeforeUnmount(destroyEvtFieldSortable)

const evtNewFieldDraft = reactive({ label: '', field_type: 'text', placeholder: '' })
const customFieldTypes = [
  { value: 'text',     label: 'Short Text' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'email',    label: 'Email' },
  { value: 'tel',      label: 'Phone' },
  { value: 'number',   label: 'Number' },
  { value: 'date',     label: 'Date' },
  { value: 'select',   label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
]

const evtSelectedFieldId = ref<string | null>(null)
const evtEditingField = computed(() => currentEvtFormFields.value.find(f => f.id === evtSelectedFieldId.value) ?? null)
// Layout elements (not data fields) get their own property panel in the editor.
const EVT_ELEMENT_TYPES = ['section', 'image', 'textblock', 'button']
const evtEditingIsElement = computed(() => EVT_ELEMENT_TYPES.includes(evtEditingField.value?.field_type as string))
// A field that comes from the national/governing body (inherited via the field
// engine). Its definition — label, type, options, where its data is connected —
// is owned upstream, so the club can't change it here. Matched by label against
// the resolved inherited set.
const evtEditingFieldInherited = computed(() => {
  const f = evtEditingField.value
  return !!f && !!f.label && inheritedFieldLabels.value.includes(f.label)
})
// The governing body that owns the inherited field (for the "managed by …" note).
const evtEditingFieldOwner = computed(() => {
  const f = evtEditingField.value
  if (!f) return ''
  const def = evtOrgFieldDefs.value.find((d: any) => d.label === f.label && d.inherited)
  return def?.ownerName || 'your national body'
})
// Ensure an element's options array has at least n slots (so v-model on indices works).
function evtEnsureOptions(field: any, n: number, defaults: string[] = []) {
  if (!Array.isArray(field.options)) field.options = []
  for (let i = field.options.length; i < n; i++) field.options[i] = defaults[i] ?? ''
  return field.options
}

function saveEvtNewField() {
  if (!evtNewFieldDraft.label.trim()) return
  const field: FormField = {
    id: crypto.randomUUID(),
    label: evtNewFieldDraft.label.trim(),
    field_type: evtNewFieldDraft.field_type,
    is_required: false,
    placeholder: evtNewFieldDraft.placeholder.trim(),
    connected_to: 'none',
    col_span: 1,
    visibility_conditions: [],
    financial_rules: [],
    target: evtFieldTarget.value,
  }
  ensureEvtGroupFields().push(field)
  evtNewFieldDraft.label = ''
  evtNewFieldDraft.placeholder = ''
  evtNewFieldDraft.field_type = 'text'
  evtSelectedFieldId.value = field.id
}

// Used by the block picker's Custom Field sub-panel "Add Field to Form" button
function saveEvtNewFieldBlock() {
  saveEvtNewField()
  evtNewBlockType.value = null
}

function openEvtFieldEditor(id: string) {
  if (evtPublicPreview.value) return  // no editing in the public preview
  evtSelectedFieldId.value = id
  evtSelectedFormSection.value = 'fields'
  // Make sure layout elements have their options array sized for the editor.
  const f: any = currentEvtFormFields.value.find(x => x.id === id)
  if (f?.field_type === 'image') evtEnsureOptions(f, 3, ['', '', 'center'])
  else if (f?.field_type === 'textblock') evtEnsureOptions(f, 2, ['', 'base'])
  else if (f?.field_type === 'button') evtEnsureOptions(f, 3, ['Button', '', 'primary'])
}

// Full set of input types, matching Settings → Fields (lowercase values that the
// events form preview + save understand; 'tel' is the phone input type).
const EVT_FIELD_TYPES = [
  { value: 'text',        label: 'Short Text' },
  { value: 'textarea',    label: 'Long Text' },
  { value: 'email',       label: 'Email' },
  { value: 'tel',         label: 'Phone' },
  { value: 'number',      label: 'Number' },
  { value: 'date',        label: 'Date' },
  { value: 'select',      label: 'Dropdown' },
  { value: 'multiselect', label: 'Multi-select' },
  { value: 'checkbox',    label: 'Checkbox' },
  { value: 'color',       label: 'Colour' },
  { value: 'file',        label: 'File Upload' },
]
// System fields — platform-defined fields (NOT input types). Added from the "System
// fields" section of the field library; their `field_type` drives a bespoke preview
// renderer and their Input Type isn't editable.
const EVT_SYSTEM_FIELDS = [
  { field_type: 'account', label: 'Create a login', icon: 'pi-user-plus', description: 'Create a login + permission level for this person' },
  { field_type: 'comms', label: 'Communication preferences', icon: 'pi-megaphone', description: 'Subscribe people to your club\'s comms topics (email/app)' },
]
function evtInputTypesFor(_field: FormField) {
  return EVT_FIELD_TYPES
}
function evtSetFieldOptions(field: any, text: string) {
  field.options = (text || '').split('\n').map(s => s.trim()).filter(Boolean)
}

const connectionOptions = [
  { value: 'profile', label: 'Profile\nData', icon: 'pi-users' },
  { value: 'event',   label: 'This\nEvent',   icon: 'pi-calendar' },
] as const

// ── Field Editor Tab ─────────────────────────────────────────────────────────
const evtFieldEditorTab = ref<'details' | 'advanced'>('details')

// ── Block state (Create New panel) ────────────────────────────────────────────
const evtNewBlockType = ref<'section' | 'image' | 'text' | 'button' | 'field' | null>(null)
const evtBlockTypes = [
  { type: 'field',   label: 'Custom Field', description: 'Collect a piece of data',       icon: 'pi-list',          color: 'bg-blue-50 text-blue-500' },
  { type: 'section', label: 'Section',      description: 'Group fields under a heading',  icon: 'pi-th-large',      color: 'bg-purple-50 text-purple-500' },
  { type: 'image',   label: 'Image',        description: 'Upload an image or banner',     icon: 'pi-image',         color: 'bg-green-50 text-green-500' },
  { type: 'text',    label: 'Text',         description: 'Add instructional text',        icon: 'pi-align-left',    color: 'bg-orange-50 text-orange-500' },
  { type: 'button',  label: 'Button',       description: 'Add a link button',             icon: 'pi-external-link', color: 'bg-pink-50 text-pink-500' },
] as const

// Click an "Add new" option → a new full page: Field opens the field editor;
// the blocks (section/image/text/button) open their own config page.
function evtStartNewField(type: string) {
  if (type === 'field') {
    const id = crypto.randomUUID()
    ensureEvtGroupFields().push({ id, label: 'New Field', field_type: 'text', is_required: false, placeholder: '', has_placeholder: false, col_span: 1, visibility_conditions: [], financial_rules: [], target: evtFieldTarget.value } as any)
    evtSelectedFieldId.value = id
  } else {
    evtNewBlockType.value = type as any
  }
}

const evtNewSectionDraft = reactive({ label: '', description: '', has_visibility: false, conditions: [] as FieldCondition[] })
const evtNewImageDraft = reactive({ src: '', alt: '', align: 'center' })
const evtNewTextDraft = reactive({ content: '', size: 'base' })
const evtNewButtonDraft = reactive({ label: '', url: '', style: 'primary' })

function saveEvtNewSection() {
  if (!evtNewSectionDraft.label.trim()) return
  ensureEvtGroupFields().push({
    id: crypto.randomUUID(),
    label: evtNewSectionDraft.label.trim(),
    field_type: 'section',
    is_required: false,
    placeholder: evtNewSectionDraft.description.trim(),
    col_span: 2,
    visibility_conditions: evtNewSectionDraft.has_visibility ? [...evtNewSectionDraft.conditions] : [],
    financial_rules: [],
  })
  Object.assign(evtNewSectionDraft, { label: '', description: '', has_visibility: false, conditions: [] })
  evtNewBlockType.value = null
}

function saveEvtNewBlock(type: 'image' | 'text' | 'button') {
  const drafts: Record<string, any> = { image: evtNewImageDraft, text: evtNewTextDraft, button: evtNewButtonDraft }
  const draft = drafts[type]
  ensureEvtGroupFields().push({
    id: crypto.randomUUID(),
    label: type === 'image' ? (evtNewImageDraft.alt || 'Image') : type === 'text' ? 'Text Block' : evtNewButtonDraft.label || 'Button',
    // 'textblock' so a static Text block doesn't collide with a Short Text *field* (both were 'text').
    field_type: type === 'text' ? 'textblock' : type,
    is_required: false,
    placeholder: '',
    col_span: 2,
    visibility_conditions: [],
    financial_rules: [],
    options: type === 'image' ? [evtNewImageDraft.src, evtNewImageDraft.alt, evtNewImageDraft.align]
              : type === 'text' ? [evtNewTextDraft.content, evtNewTextDraft.size]
              : [evtNewButtonDraft.label, evtNewButtonDraft.url, evtNewButtonDraft.style],
    target: evtFieldTarget.value,
  })
  if (type === 'image') Object.assign(evtNewImageDraft, { src: '', alt: '', align: 'center' })
  if (type === 'text') Object.assign(evtNewTextDraft, { content: '', size: 'base' })
  if (type === 'button') Object.assign(evtNewButtonDraft, { label: '', url: '', style: 'primary' })
  evtNewBlockType.value = null
}

// ── Per-subject instance preview ──────────────────────────────────────────────
// Each subject type renders N instance cards in the preview, defaulting to the
// subject's `min` (so "12 Players min" shows 12 Player blocks) and clamped to its
// `max`. Staff add/remove instances per subject. All per-instance state (names,
// session picks, order rows) is keyed by a single linear index spanning every
// instance — evtGIdx() — so the existing preview machinery keeps working unchanged.
const evtPersonValues = ref<Record<string, any>[]>([{}])
const evtSubjectCounts = ref<Record<string, number>>({})

// lo = the lowest allowed count (min, but always ≥1 so every subject shows once);
// hi = the cap (max, or 0 for unlimited).
function evtSubjectBounds(s: any) {
  const lo = Math.max(1, Number(s?.min) || 0)
  const rawMax = Number(s?.max) || 0
  const hi = rawMax > 0 ? Math.max(lo, rawMax) : 0
  return { lo, hi }
}
function evtSubjectMin(s: any) { return evtSubjectBounds(s).lo }
function evtSubjectMax(s: any) { return evtSubjectBounds(s).hi }   // 0 = unlimited
function evtSubjectCount(key: string): number {
  const s = evtPreviewSubjects.value.find(x => x.key === key)
  if (!s) return 1
  const { lo, hi } = evtSubjectBounds(s)
  let c = evtSubjectCounts.value[key] ?? lo
  if (c < lo) c = lo
  if (hi && c > hi) c = hi
  return c
}
function evtSubjectMaxReached(s: any) {
  const { hi } = evtSubjectBounds(s)
  return hi ? evtSubjectCount(s.key) >= hi : false
}
function evtAddSubjectInstance(s: any) {
  if (evtSubjectMaxReached(s)) return
  evtSubjectCounts.value = { ...evtSubjectCounts.value, [s.key]: evtSubjectCount(s.key) + 1 }
}
// Remove a SPECIFIC instance (any one, not just the last). Splices that instance's
// slot out of the linear per-instance state so the data for the remaining instances
// (names, session picks, accordion open-state) stays attached to the right person.
function evtRemoveSubjectInstance(s: any, inst: number) {
  const { lo } = evtSubjectBounds(s)
  const cur = evtSubjectCount(s.key)
  if (cur <= lo) return
  const g = evtGIdx(s.key, inst)

  // 1. Drop this instance's value bucket; everything after shifts down to match the
  //    recomputed linear index.
  if (g < evtPersonValues.value.length) {
    const pv = evtPersonValues.value.slice()
    pv.splice(g, 1)
    evtPersonValues.value = pv
  }

  // 2. Session selections are keyed by the linear index — drop g, shift >g down by one.
  const sel = evtPreviewSessionSelections.value
  const nextSel: Record<number, Record<string, boolean>> = {}
  for (const k of Object.keys(sel)) {
    const n = Number(k)
    if (n < g) nextSel[n] = sel[n]
    else if (n > g) nextSel[n - 1] = sel[n]
  }
  evtPreviewSessionSelections.value = nextSel

  // 3. Accordion open-state is keyed by `${key}#${inst}` (1-based, per subject) —
  //    drop the removed instance and renumber this subject's later instances down.
  const open = evtOpenInstances.value
  const nextOpen: Record<string, boolean> = {}
  for (const kk of Object.keys(open)) {
    const at = kk.lastIndexOf('#')
    const sk = at >= 0 ? kk.slice(0, at) : kk
    const ni = at >= 0 ? Number(kk.slice(at + 1)) : NaN
    if (sk !== s.key || !Number.isFinite(ni)) { nextOpen[kk] = open[kk]; continue }
    if (ni < inst) nextOpen[kk] = open[kk]
    else if (ni > inst) nextOpen[sk + '#' + (ni - 1)] = open[kk]
  }
  evtOpenInstances.value = nextOpen

  // 4. Finally drop the count.
  evtSubjectCounts.value = { ...evtSubjectCounts.value, [s.key]: cur - 1 }
}

// Each instance card is a collapsible accordion. Default: the first instance of a
// subject is open, the rest collapsed — so "12 Players" shows Player 1 expanded and
// 2…12 as compact headers. Explicit toggles are remembered in evtOpenInstances.
const evtOpenInstances = ref<Record<string, boolean>>({})
function evtInstanceOpen(key: string, inst: number): boolean {
  const k = key + '#' + inst
  return k in evtOpenInstances.value ? evtOpenInstances.value[k] : inst === 1
}
function evtToggleInstance(key: string, inst: number) {
  evtFieldTarget.value = key
  evtOpenInstances.value = { ...evtOpenInstances.value, [key + '#' + inst]: !evtInstanceOpen(key, inst) }
}
// Name typed into an instance (people only) — used as the accordion header title.
function evtInstanceName(key: string, inst: number): string {
  const v = evtPersonValues.value[evtGIdx(key, inst)] || {}
  let first = v['First Name'], last = v['Last Name']
  // The primary registrant's name comes from their signed-in account in preview.
  if (evtPublicPreview.value && evtIsPrimaryRegistrant(key, inst)) {
    first = first || evtPreviewAccount.first
    last = last || evtPreviewAccount.last
  }
  return [first, last].filter(Boolean).join(' ').trim()
}
// First name only — used where the full name is too much (e.g. "Create a login for {first}?").
function evtInstanceFirstName(key: string, inst: number): string {
  const v = evtPersonValues.value[evtGIdx(key, inst)] || {}
  let first = v['First Name']
  if (evtPublicPreview.value && evtIsPrimaryRegistrant(key, inst)) first = first || evtPreviewAccount.first
  return (first || '').trim()
}
// The accordion header shows the registrant's name; until one's typed it falls back
// to the subject type (+ number when there's more than one of that subject).
function evtInstanceTitle(s: any, inst: number): string {
  return evtInstanceName(s.key, inst) || (s.label + (evtSubjectCount(s.key) > 1 ? ' ' + inst : ''))
}

// The person registrants on the form (every person-kind subject instance, by typed
// name or fallback label).
const evtRegistrantOptions = computed(() => {
  const out: { id: string; label: string }[] = []
  for (const s of evtPreviewSubjects.value) {
    if ((s as any).kind === 'entity') continue
    const count = evtSubjectCount(s.key)
    for (let i = 1; i <= count; i++) out.push({ id: s.key + '#' + i, label: evtInstanceTitle(s, i) })
  }
  return out
})
// Comms recipients exclude emergency contacts — you don't send general comms to them.
const evtCommsRecipientOptions = computed(() => {
  const out: { id: string; label: string }[] = []
  for (const s of evtPreviewSubjects.value) {
    if ((s as any).kind === 'entity') continue
    if (/emergency|contact/i.test(s.key) || /emergency|contact/i.test(s.label)) continue
    const count = evtSubjectCount(s.key)
    for (let i = 1; i <= count; i++) out.push({ id: s.key + '#' + i, label: evtInstanceTitle(s, i) })
  }
  return out
})
// Comms recipients (multi-select dropdown) preview state.
const evtCommsRecipients = ref<string[]>([])
// "Account" field = a "Would you like {X} to login?" toggle; if Yes the person is
// granted the field's chosen permission group. Preview toggle state keyed field#inst.
const evtAccountLoginState = ref<Record<string, boolean>>({})
function evtToggleAccountLogin(key: string) {
  evtAccountLoginState.value = { ...evtAccountLoginState.value, [key]: !evtAccountLoginState.value[key] }
}
// Org permission groups (core + this org's own) — populate the account field's
// "access level when they log in" selector.
const evtPermissionGroups = ref<{ id: string; name: string }[]>([])
watch(orgId, async (id) => {
  if (!id) { evtPermissionGroups.value = []; return }
  try {
    const [core, own] = await Promise.all([
      (db.from as any)('permission_groups').select('id, name, sort_order').eq('is_core', true).order('sort_order'),
      (db.from as any)('permission_groups').select('id, name, sort_order').eq('org_id', id).order('sort_order'),
    ])
    evtPermissionGroups.value = [...(core.data ?? []), ...(own.data ?? [])].map((g: any) => ({ id: g.id, name: g.name }))
  } catch (e) { console.error('[evt permission groups]', e) }
}, { immediate: true })

// Communication topics (core + this org's own) — populate the "Communication
// preferences" field. Each topic delivers over its channels (email / app).
const evtCommsTopics = ref<{ id: string; name: string; channels: string[] }[]>([])
watch(orgId, async (id) => {
  if (!id) { evtCommsTopics.value = []; return }
  try {
    const [core, own] = await Promise.all([
      (db.from as any)('communication_topics').select('id, name, channels, sort_order, is_active').eq('is_core', true).order('sort_order'),
      (db.from as any)('communication_topics').select('id, name, channels, sort_order, is_active').eq('org_id', id).order('sort_order'),
    ])
    evtCommsTopics.value = [...(core.data ?? []), ...(own.data ?? [])]
      .filter((t: any) => t.is_active !== false)
      .map((t: any) => ({ id: t.id, name: t.name, channels: t.channels ?? [] }))
  } catch (e) { console.error('[evt comms topics]', e) }
}, { immediate: true })
// Per-person comms subscriptions for the preview: keyed "personId|topicId|channel"
// so a person can pick a topic by email and/or app independently.
// Canonical channel order so every cell renders email then app in the same
// column position — topics missing a channel get an aligned placeholder.
const EVT_COMMS_CHANNELS = ['email', 'app'] as const
const evtCommsSubscriptions = ref<Record<string, boolean>>({})
function evtCommsSub(personId: string, topicId: string, channel: string) {
  return !!evtCommsSubscriptions.value[`${personId}|${topicId}|${channel}`]
}
function evtToggleCommsSub(personId: string, topicId: string, channel: string) {
  const k = `${personId}|${topicId}|${channel}`
  evtCommsSubscriptions.value = { ...evtCommsSubscriptions.value, [k]: !evtCommsSubscriptions.value[k] }
}
// Every (person, topic, channel) cell key in the current matrix.
function evtCommsAllKeys() {
  const keys: string[] = []
  for (const p of evtCommsRecipientOptions.value)
    for (const t of evtCommsTopics.value)
      for (const ch of t.channels) keys.push(`${p.id}|${t.id}|${ch}`)
  return keys
}
// Bulk toggles — set a subset of keys to `on`.
function evtSetCommsKeys(keys: string[], on: boolean) {
  const next = { ...evtCommsSubscriptions.value }
  for (const k of keys) next[k] = on
  evtCommsSubscriptions.value = next
}
const evtCommsAllOn = computed(() => {
  const keys = evtCommsAllKeys()
  return keys.length > 0 && keys.every(k => evtCommsSubscriptions.value[k])
})
function evtToggleAllComms() {
  evtSetCommsKeys(evtCommsAllKeys(), !evtCommsAllOn.value)
}
// Toggle a whole topic row (every person × that topic's channels).
function evtCommsRowOn(topic: { id: string; channels: string[] }) {
  const keys = evtCommsRecipientOptions.value.flatMap(p => topic.channels.map(ch => `${p.id}|${topic.id}|${ch}`))
  return keys.length > 0 && keys.every(k => evtCommsSubscriptions.value[k])
}
function evtToggleCommsRow(topic: { id: string; channels: string[] }) {
  const keys = evtCommsRecipientOptions.value.flatMap(p => topic.channels.map(ch => `${p.id}|${topic.id}|${ch}`))
  evtSetCommsKeys(keys, !evtCommsRowOn(topic))
}
// Toggle a whole person column (every topic × channel for that person).
function evtCommsColOn(personId: string) {
  const keys = evtCommsTopics.value.flatMap(t => t.channels.map(ch => `${personId}|${t.id}|${ch}`))
  return keys.length > 0 && keys.every(k => evtCommsSubscriptions.value[k])
}
function evtToggleCommsCol(personId: string) {
  const keys = evtCommsTopics.value.flatMap(t => t.channels.map(ch => `${personId}|${t.id}|${ch}`))
  evtSetCommsKeys(keys, !evtCommsColOn(personId))
}
// Simple inline control: a multi-select of people. Selecting a name subscribes
// that person to everything; the "Customise" button opens the matrix for fine
// control. A person counts as selected when any channel is on, and re-selecting
// an already-customised person leaves their per-channel choices untouched.
const evtCommsPeopleModel = computed<string[]>({
  get() {
    return evtCommsRecipientOptions.value
      .filter(p => evtCommsTopics.value.some(t => t.channels.some(ch => evtCommsSub(p.id, t.id, ch))))
      .map(p => p.id)
  },
  set(ids) {
    const next = { ...evtCommsSubscriptions.value }
    for (const p of evtCommsRecipientOptions.value) {
      const keys = evtCommsTopics.value.flatMap(t => t.channels.map(ch => `${p.id}|${t.id}|${ch}`))
      const currentlyOn = keys.some(k => next[k])
      if (ids.includes(p.id)) { if (!currentlyOn) keys.forEach(k => { next[k] = true }) }
      else keys.forEach(k => { next[k] = false })
    }
    evtCommsSubscriptions.value = next
  },
})
// The matrix lives in a popup to keep the form clean.
const evtCommsDialogOpen = ref(false)
const evtCommsSubCount = computed(() => Object.values(evtCommsSubscriptions.value).filter(Boolean).length)

// Context shared with <EvtFieldCell> so it can render fields/elements both at the
// top level and inside section holders without prop-drilling. Uses getter/setter
// accessors instead of v-model on injected refs to keep reactivity simple.
provide('evtFieldCtx', {
  previewAccount: evtPreviewAccount,
  // True in the dedicated "Preview — how registrants see this form" mode: fields
  // become live + fillable and lose the click-to-edit hover affordances.
  isPreview: () => evtPublicPreview.value,
  gIdx: (k: string, i: number) => evtGIdx(k, i),
  getVal: (k: string, i: number, label: string) => evtPersonValues.value[evtGIdx(k, i)]?.[label],
  setVal: (k: string, i: number, label: string, v: any) => {
    const g = evtGIdx(k, i)
    if (!evtPersonValues.value[g]) evtPersonValues.value[g] = {}
    evtPersonValues.value[g][label] = v
  },
  openEditor: (id: string) => openEvtFieldEditor(id),
  coreReadOnly: (k: string, i: number, field: any) => evtCoreReadOnly(k, i, field),
  instanceName: (k: string, i: number) => evtInstanceName(k, i),
  instanceFirstName: (k: string, i: number) => evtInstanceFirstName(k, i),
  subjectLabel: (k: string) => currentEvtFormProfiles.value.find(p => p.key === k)?.label || k,
  accountLogin: (field: any, inst: number) => !!evtAccountLoginState.value[field.id + '#' + inst],
  toggleAccountLogin: (field: any, inst: number) => evtToggleAccountLogin(field.id + '#' + inst),
  permissionGroupName: (field: any) => evtPermissionGroups.value.find(g => g.id === field.permission_group_id)?.name || 'account',
  commsPeople: () => evtCommsPeopleModel.value,
  setCommsPeople: (v: string[]) => { evtCommsPeopleModel.value = v },
  commsOptions: () => evtCommsRecipientOptions.value,
  openCommsDialog: () => { evtCommsDialogOpen.value = true },
})

// Each subject/step shows an inline-editable H2 (its display name) + an optional
// inline-editable intro paragraph, both stored on the subject's profile so they
// persist with the form (config.groupProfiles) and update live everywhere.
function evtProfileIndexOf(key: string): number {
  return currentEvtFormProfiles.value.findIndex((x: any) => x.key === key)
}
function evtSubjectIntro(key: string): string {
  const p = currentEvtFormProfiles.value.find((x: any) => x.key === key)
  return (p as any)?.intro || ''
}
// The step heading is its own field, defaulting to "{singular} register".
function evtSubjectHeadingDefault(s: any): string {
  return (s?.label || 'Guest') + ' register'
}
function evtSubjectHeading(s: any): string {
  const p = currentEvtFormProfiles.value.find((x: any) => x.key === s.key)
  return (p as any)?.heading || evtSubjectHeadingDefault(s)
}
function evtSubjectHeadingInput(key: string, e: Event) {
  const i = evtProfileIndexOf(key)
  if (i >= 0) patchEvtProfile(i, { heading: (e.target as HTMLInputElement).value } as any)
}
function evtSetSubjectIntro(key: string, val: string) {
  const i = evtProfileIndexOf(key)
  if (i >= 0) patchEvtProfile(i, { intro: val } as any)
}

// Linear index map: `${subject.key}#${inst}` (inst 1-based) → global 0-based slot.
const evtInstanceIndex = computed(() => {
  const map: Record<string, number> = {}
  let g = 0
  for (const s of evtPreviewSubjects.value) {
    const c = evtSubjectCount(s.key)
    for (let i = 1; i <= c; i++) map[s.key + '#' + i] = g++
  }
  return { map, total: g }
})
function evtGIdx(key: string, inst: number): number {
  return evtInstanceIndex.value.map[key + '#' + inst] ?? 0
}
const evtInstanceTotal = computed(() => evtInstanceIndex.value.total)
// Back-compat alias: the order-summary + discount preview computeds read this as
// the total number of registrants in the group (registration_group_size_min, …).
const evtAccordionPersonCount = computed(() => evtInstanceTotal.value)

// Seed each subject's count to its min (≥1) when the subject list changes, prune
// counts for removed subjects, and keep evtPersonValues sized to the instance total.
watch(evtPreviewSubjects, (subs) => {
  const counts = { ...evtSubjectCounts.value }
  const keys = new Set(subs.map(s => s.key))
  for (const k of Object.keys(counts)) if (!keys.has(k)) delete counts[k]
  for (const s of subs) {
    const { lo, hi } = evtSubjectBounds(s)
    let c = counts[s.key] ?? lo
    if (c < lo) c = lo
    if (hi && c > hi) c = hi
    counts[s.key] = c
  }
  evtSubjectCounts.value = counts
}, { immediate: true, deep: true })

watch(evtInstanceTotal, (total) => {
  if (evtPersonValues.value.length < total) {
    const pv = evtPersonValues.value.slice()
    while (pv.length < total) pv.push({})
    evtPersonValues.value = pv
  }
}, { immediate: true })

// ── Order / financial preview ─────────────────────────────────────────────────
// Base registration fee = sum of all event-level fee components
const evtBaseRegistrationFee = computed(() =>
  feeLineItems.value.reduce((sum, f) => sum + (Number(f.amount) || 0), 0)
)

function getEvtPersonFieldValue(personIdx: number, fieldLabel: string): string {
  return evtPersonValues.value[personIdx]?.[fieldLabel] ?? ''
}

function evaluateEvtConditions(conditions: FieldCondition[], personIdx: number): boolean {
  return conditions.every(c => {
    const val = getEvtPersonFieldValue(personIdx, c.field)
    if (c.operator === 'Is Empty') return !val
    if (c.operator === 'Is Not Empty') return !!val
    if (c.operator === 'Equals') return val === c.value
    if (c.operator === 'Is Not') return val !== c.value
    if (c.operator === 'Contains') return val.includes(c.value)
    return true
  })
}
// A field is visible when it has no conditions, or its conditions pass for this
// instance's answers. The builder shows every field; the public form hides ones
// whose conditions aren't met.
function evtFieldVisible(field: any, gIdx: number): boolean {
  const conds = field.visibility_conditions ?? []
  return !conds.length || evaluateEvtConditions(conds, gIdx)
}
function evtFieldsForRender(subjectKey: string, inst: number) {
  const fields = evtFieldsForSubject(subjectKey)
  if (!evtPublicPreview.value) return fields
  const gIdx = evtGIdx(subjectKey, inst)
  return fields.filter((f: any) => evtFieldVisible(f, gIdx))
}
// First/Last Name are pinned: they render in a fixed leading row (never draggable),
// always first. Everything else flows through the sortable, reorderable grid.
function evtPinnedFields(subjectKey: string) {
  return evtFieldsForSubject(subjectKey).filter((f: any) => f.pinned)
}
function evtUnpinnedForRender(subjectKey: string, inst: number) {
  return evtFieldsForRender(subjectKey, inst).filter((f: any) => !f.pinned)
}
// Top-level canvas items = unpinned items not nested inside a section (includes the
// section holders themselves). Section children = items whose parent_section matches.
function evtTopLevelItems(subjectKey: string, inst: number) {
  return evtUnpinnedForRender(subjectKey, inst).filter((f: any) => !f.parent_section)
}
function evtSectionChildren(subjectKey: string, sectionId: string, inst: number) {
  return evtUnpinnedForRender(subjectKey, inst).filter((f: any) => f.parent_section === sectionId)
}

const evtOrderRows = computed<OrderRow[][]>(() => {
  const result: OrderRow[][] = []
  for (let i = 0; i < evtAccordionPersonCount.value; i++) {
    // Start with the actual event fee components as rows
    const rows: OrderRow[] = feeLineItems.value.length
      ? feeLineItems.value.map(f => ({ label: f.name || 'Registration Fee', amount: Number(f.amount) || 0 }))
      : [{ label: 'Registration Fee', amount: 0 }]
    // Add field-level financial rules on top
    for (const field of currentEvtFormFields.value) {
      for (const rule of field.financial_rules) {
        if (evaluateEvtConditions(rule.conditions, i)) {
          const amt = parseFloat(rule.amount) || 0
          rows.push({ label: rule.fee_name || field.label, amount: rule.fee_type === 'discount' ? -amt : amt })
        }
      }
    }
    // Add selected (or required) session fees — one line per session with date/time
    const visibleSessions = sessions.value.filter((s: any) =>
      s.display_on_form !== false &&
      sessionVisibleOnForm(s) &&
      getSessionMode(s.id ?? s._savedId) !== 'hidden'
    )
    for (const s of visibleSessions) {
      const sid = s.id ?? s._savedId
      if (s.required || evtPreviewSessionSelections.value[i]?.[sid]) {
        const fee = sessionFeeAmount(s) ?? 0
        const title = s.title || 'Session'
        let dateStr = ''
        if (s.start_at) {
          const d = new Date(s.start_at)
          dateStr = d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
          dateStr += ' ' + d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })
        }
        rows.push({ label: dateStr ? `${title} · ${dateStr}` : title, amount: fee })
      }
    }
    result.push(rows)
  }
  return result
})

const evtOrderTotal = computed(() =>
  evtOrderRows.value.reduce((sum, rows) => sum + rows.reduce((s, r) => s + r.amount, 0), 0)
)

const evtTotalDiscountSavings = computed(() =>
  evtDiscountSummaryLines.value.reduce((sum, d) => sum + d.amount, 0)
)

function evalDiscountOp(actual: number, op: string, expected: number): boolean {
  switch (op) {
    case '>=': return actual >= expected
    case '>':  return actual > expected
    case '<=': return actual <= expected
    case '<':  return actual < expected
    case '=':  return actual === expected
    default:   return true
  }
}

const evtApplicableDiscounts = computed<{ name: string; formText: string; amount: number }[][]>(() => {
  const personCount = evtAccordionPersonCount.value
  return Array.from({ length: personCount }, (_, i) => {
    const rows = evtOrderRows.value[i] ?? []
    const positiveAmounts = rows.filter(r => r.amount > 0).map(r => r.amount)
    const personTotal = rows.reduce((s, r) => s + r.amount, 0)

    const selectedSessionCount = sessions.value.filter((s: any) => {
      const sid = s.id ?? s._savedId
      return s.display_on_form !== false &&
        sessionVisibleOnForm(s) &&
        getSessionMode(sid) !== 'hidden' &&
        (s.required || evtPreviewSessionSelections.value[i]?.[sid])
    }).length

    const applicableDiscounts: { name: string; formText: string; amount: number }[] = []

    for (const disc of eventDiscounts.value.filter((d: any) => d.is_active)) {
      let met = true
      for (const cond of (disc.conditions ?? [])) {
        switch (cond.key) {
          case 'registration_group_size_min':
            if (!evalDiscountOp(personCount, cond.operator, cond.value)) met = false; break
          case 'booked_session_count_min':
            if (!evalDiscountOp(selectedSessionCount, cond.operator, cond.value)) met = false; break
          case 'registration_date_before':
            if (cond.value && new Date() > new Date(cond.value)) met = false; break
          case 'registration_total_value_min':
            if (!evalDiscountOp(personTotal, cond.operator, Number(cond.value))) met = false; break
          case 'promo_code':
            met = false; break
          // participant/membership conditions can't be evaluated from form state — assume met
        }
      }
      if (!met) continue

      const v = Number(disc.modifier_value ?? 0)
      let amount = 0
      switch (disc.apply_to ?? 'per_session') {
        case 'per_session':
          amount = disc.modifier_type === 'PERCENT'
            ? positiveAmounts.reduce((s: number, a: number) => s + a * v / 100, 0)
            : positiveAmounts.length * v
          break
        case 'per_person':
          amount = disc.modifier_type === 'PERCENT' ? personTotal * v / 100 : v
          break
        case 'cheapest_item':
          if (positiveAmounts.length) {
            const cheapest = Math.min(...positiveAmounts)
            amount = disc.modifier_type === 'PERCENT' ? cheapest * v / 100 : Math.min(v, cheapest)
          }
          break
        case 'most_expensive_item':
          if (positiveAmounts.length) {
            const expensive = Math.max(...positiveAmounts)
            amount = disc.modifier_type === 'PERCENT' ? expensive * v / 100 : Math.min(v, expensive)
          }
          break
        case 'registration_total':
          amount = disc.modifier_type === 'PERCENT' ? personTotal * v / 100 : Math.min(v, personTotal)
          break
      }

      if (amount > 0) applicableDiscounts.push({ name: disc.name, formText: disc.form_text || disc.name, amount })
    }

    return applicableDiscounts
  })
})

// Aggregated discount lines for display: sums each discount across all persons,
// and respects one_discount_only by keeping only the best per person before summing.
const evtDiscountSummaryLines = computed<{ formText: string; amount: number }[]>(() => {
  const all = evtApplicableDiscounts.value
  const map = new Map<string, { formText: string; amount: number }>()
  for (const perPerson of all) {
    const relevant = evtDiscountSettings.one_discount_only && perPerson.length > 1
      ? [perPerson.reduce((a, b) => a.amount >= b.amount ? a : b)]
      : perPerson
    for (const disc of relevant) {
      const existing = map.get(disc.name)
      if (existing) existing.amount += disc.amount
      else map.set(disc.name, { formText: disc.formText, amount: disc.amount })
    }
  }
  return Array.from(map.values())
})

// Org field library (field engine) surfaced in the event form palette.
const { resolveFields: _evtResolveFields } = useOrgFieldPolicy()
const orgFieldLabels = ref<string[]>([])
const inheritedFieldLabels = ref<string[]>([])
const _EVT_FT: Record<string, string> = { text: 'text', textarea: 'textarea', email: 'email', phone: 'tel', number: 'number', date: 'date', select: 'select', multiselect: 'multiselect', checkbox: 'checkbox', file: 'file', color: 'color', account: 'account', comms: 'comms' }
const _EVT_ICON: Record<string, string> = { text: 'pi-font', textarea: 'pi-align-left', email: 'pi-envelope', phone: 'pi-phone', number: 'pi-hashtag', date: 'pi-calendar', select: 'pi-list', multiselect: 'pi-check-square', checkbox: 'pi-check-square', file: 'pi-upload', color: 'pi-palette', account: 'pi-wallet', comms: 'pi-megaphone' }
// Org/NSO field definitions (each carries a `target` = the subject type it's
// about, e.g. a "National Cricket ID" targets the member/player, not a Team).
const evtOrgFieldDefs = ref<any[]>([])
watch(orgId, async (id) => {
  orgFieldLabels.value = []; inheritedFieldLabels.value = []; evtOrgFieldDefs.value = []
  if (!id) return
  try {
    const defs = await _evtResolveFields(id)
    for (const d of defs) {
      evtFieldMeta[d.label] = { field_type: _EVT_FT[d.field_type] || 'text', icon: _EVT_ICON[d.field_type] || 'pi-tag', placeholder: d.help_text || '', options: d.options || [] }
      ;(d.inherited ? inheritedFieldLabels : orgFieldLabels).value.push(d.label)
    }
    evtOrgFieldDefs.value = defs
  } catch (e) { console.error('[evt org fields]', e) }
}, { immediate: true })
// A field is only "required" for the subject it targets — so a member-required
// field isn't flagged required while you're configuring a Team/entity.
function evtFieldRequiredForCurrent(d: any) {
  if (!d.is_required) return false
  return evtDefApplies(d, evtFieldTarget.value || '')
}
const requiredOrgFields = computed(() => {
  const s = new Set<string>()
  for (const d of evtOrgFieldDefs.value) if (evtFieldRequiredForCurrent(d)) s.add(d.label)
  return s
})
const requiredByOrg = computed(() => {
  const m: Record<string, string> = {}
  for (const d of evtOrgFieldDefs.value) if (evtFieldRequiredForCurrent(d)) m[d.label] = d.ownerName
  return m
})
const evtExistingGroups = computed<Record<string, string[]>>(() => {
  // ONLY real field definitions: the club's own fields + those inherited from its
  // governing body (NSO). No hardcoded/sample fields. Scoped to the subject being
  // configured — a member field (e.g. National Cricket ID) won't appear on a Team.
  const sortA = (a: string[]) => [...a].sort((x, y) => x.localeCompare(y))
  const t = evtFieldTarget.value || ''
  const own = evtOrgFieldDefs.value.filter(d => !d.inherited && evtDefApplies(d, t)).map(d => d.label)
  const inh = evtOrgFieldDefs.value.filter(d => d.inherited && evtDefApplies(d, t)).map(d => d.label)
  const g: Record<string, string[]> = {}
  if (own.length) g['Organisation fields'] = sortA(own)
  if (inh.length) g['Inherited (NSO) fields'] = sortA(inh)
  return g
})
// Search filter for the field library (find a field on the fields page).
const evtFieldSearch = ref('')
const evtExistingGroupsFiltered = computed<Record<string, string[]>>(() => {
  const q = evtFieldSearch.value.trim().toLowerCase()
  if (!q) return evtExistingGroups.value
  const out: Record<string, string[]> = {}
  for (const [group, fields] of Object.entries(evtExistingGroups.value)) {
    const m = fields.filter(f => f.toLowerCase().includes(q))
    if (m.length) out[group] = m
  }
  return out
})
const availableTerms = ref([
  { label: 'NZ Sport Terms', required: true, agreeText: 'I agree to NZ Sport Terms' },
  { label: 'Photos Policy', required: false, agreeText: 'I agree to the Photos Policy' },
  { label: 'Waiver Agreement', required: false, agreeText: 'I agree to the Waiver Agreement' },
])

const evtFormTermsShown = computed(() => [
  { label: 'Club T&C', agreeText: 'I agree to the Club T&C' },
  ...availableTerms.value.filter(t => t.required).map(t => ({ label: t.label, agreeText: t.agreeText })),
  ...availableTerms.value.filter(t => !t.required && evtFormTermsSelections.value.includes(t.label)).map(t => ({ label: t.label, agreeText: t.agreeText })),
])

const showEvtTCModal = ref(false)
const evtTCDraft = reactive({ label: '', text: '', agreeText: '' })
function saveEvtTCDraft() {
  if (!evtTCDraft.label.trim()) return
  availableTerms.value.push({ label: evtTCDraft.label.trim(), required: false, agreeText: evtTCDraft.agreeText.trim() || `I agree to the ${evtTCDraft.label.trim()}` })
  evtFormTermsSelections.value.push(evtTCDraft.label.trim())
  showEvtTCModal.value = false
  Object.assign(evtTCDraft, { label: '', text: '', agreeText: '' })
}

const evtEditingTCLabel = ref<string | null>(null)
const evtTCEditAgreeText = ref('')
function openEvtEditTC(tc: { label: string; agreeText: string }) {
  evtEditingTCLabel.value = tc.label
  evtTCEditAgreeText.value = tc.agreeText
}
function saveEvtEditTC() {
  const idx = availableTerms.value.findIndex(t => t.label === evtEditingTCLabel.value)
  if (idx >= 0) availableTerms.value[idx].agreeText = evtTCEditAgreeText.value.trim() || `I agree to the ${availableTerms.value[idx].label}`
  evtEditingTCLabel.value = null
}

function toggleEvtTerms(label: string) {
  const idx = evtFormTermsSelections.value.indexOf(label)
  if (idx === -1) evtFormTermsSelections.value.push(label)
  else evtFormTermsSelections.value.splice(idx, 1)
}
const evtFormGroupDesigns = reactive<Record<string, any>>({
  'general': { style: 'single', header: 'event', headerImage: '', icons: { date: true, time: true, cost: true, location: true, criteria: true }, description: 'event', customDescription: '', background: 'default', backgroundImage: '', backgroundColor: '#fefefe', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundOverlay: 1, sponsors: 'show', showSessions: true, sessionsHeading: 'Sessions', sessionsLayout: 'list', sessionsGroupLabel: '', formHeading: 'Fill in the form to register', addPersonColor: '#0e43a3' },
})
const currentEvtFormDesign = computed(() => evtFormGroupDesigns[selectedFormGroupId.value] ?? evtFormGroupDesigns['general'])

async function handleEvtFormImageUpload(field: 'headerImage' | 'backgroundImage', e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    // Upload to storage (like the event banner) and store the URL — base64 data URLs
    // bloat / fail to persist in the form config jsonb.
    const url = await uploadFile(file)
    const design = evtFormGroupDesigns[selectedFormGroupId.value] ?? evtFormGroupDesigns['general']
    design[field] = url
    if (field === 'headerImage') design.header = 'custom'
    persistEvtFormConfig()
  } catch (err) {
    console.error('[evt form image upload]', err)
  } finally {
    input.value = ''  // allow re-uploading the same file
  }
}

const evtFormGroups = computed(() =>
  evtFormGroupsList.value.map(({ id, name }) => {
    const mode = evtFormGroupModes[id] ?? ''
    const saved = evtFormSectionSaved[id] ?? {}
    const totalCount = mode === 'simple' ? 3 : 4
    const allSaved = mode === 'simple'
      ? (!!saved.design && !!saved.terms && !!saved.payment)
      : !!(mode && saved.design && saved.fields && saved.terms && saved.payment)
    return {
      id, name,
      complete: allSaved,
      noRegistrations: mode === 'none',
      notSetUp: !mode,
      filledCount: Object.keys(saved).length,
      totalCount,
    }
  })
)

const showAddFormDialog = ref(false)
const newFormName = ref('')
const newFormAudience = ref<'all' | 'members' | 'public'>('all')

function openAddFormDialog() {
  newFormName.value = ''
  newFormAudience.value = 'all'
  showAddFormDialog.value = true
}

function confirmAddEvtFormGroup() {
  const name = newFormName.value.trim() || `Form ${evtFormGroupsList.value.length + 1}`
  const newId = crypto.randomUUID()
  evtFormGroupsList.value.push({ id: newId, name, person_type: 'all', audience: newFormAudience.value })
  evtFormGroupModes[newId] = ''
  evtFormGroupSessions[newId] = {}
  evtFormGroupDesigns[newId] = { ...evtFormGroupDesigns['general'] }
  showAddFormDialog.value = false
  selectEvtFormGroup(newId)
}

// The "+" creates a fresh mode-less form and drops straight into the
// "Choose a registration type" chooser — the same starting point as when there
// are no forms (no separate New Form name/audience dialog).
function addEvtFormGroupViaChooser() {
  const newId = crypto.randomUUID()
  evtFormGroupsList.value.push({ id: newId, name: `Form ${evtFormGroupsList.value.length + 1}`, person_type: 'all', audience: 'all' })
  evtFormGroupModes[newId] = ''
  evtFormGroupSessions[newId] = {}
  evtFormGroupDesigns[newId] = { ...evtFormGroupDesigns['general'] }
  evtChooserStep.value = 'type'
  selectEvtFormGroup(newId)
}

// Pick a registration type from the "Create a registration form" chooser: drop into a
// scratch form, seeding the chosen preset's subjects (or just the default person for blank).
function chooseEvtFormPreset(presetId: string) {
  chooseEvtFormType('scratch')
  const preset = presetId ? PROFILE_PRESETS.find(p => p.id === presetId) : null
  if (preset) applyEvtProfilePreset(preset)
  // Default to the Steps wizard for every template except Individual (and Blank,
  // which is a single person) — those stay Single Page.
  const design = evtFormGroupDesigns[selectedFormGroupId.value]
  if (design) design.style = (presetId && presetId !== 'individual') ? 'tabs' : 'single'
}

const formToDelete = ref<string | null>(null)

function removeEvtFormGroup(id: string) {
  const idx = evtFormGroupsList.value.findIndex(g => g.id === id)
  if (idx === -1) return
  evtFormGroupsList.value.splice(idx, 1)
  // Allow deleting every form — fall back to the empty state (no group selected).
  if (selectedFormGroupId.value === id || !evtFormGroupsList.value.length) {
    selectedFormGroupId.value = evtFormGroupsList.value[0]?.id ?? ''
    evtFormShowSections.value = false
  }
  formToDelete.value = null
  persistEvtFormConfig()
}

const currentEvtFormGroupName = computed(() =>
  evtFormGroupsList.value.find(g => g.id === selectedFormGroupId.value)?.name ?? ''
)


function sessionVisibleOnForm(_s: any): boolean {
  return true
}

const evtFormSectionSaved = reactive<Record<string, Record<string, boolean>>>({})

function saveEvtFormSection(sectionId: string) {
  const gid = selectedFormGroupId.value
  if (!evtFormSectionSaved[gid]) evtFormSectionSaved[gid] = {}
  evtFormSectionSaved[gid][sectionId] = true
  evtSelectedFormSection.value = ''
  persistEvtFormConfig()
}

function buildEvtFormConfig() {
  return {
    groups: evtFormGroupsList.value,
    modes: { ...evtFormGroupModes },
    designs: { ...evtFormGroupDesigns },
    sessions: { ...evtFormGroupSessions },
    subjectSessions: JSON.parse(JSON.stringify(evtFormSubjectSessions)),
    sectionSaved: { ...evtFormSectionSaved },
    payment: JSON.parse(JSON.stringify(evtFormPayment)),
    terms: evtFormTermsSelections.value,
    discountSettings: { ...evtDiscountSettings },
    groupFields: JSON.parse(JSON.stringify(evtFormGroupFields)),
    groupProfiles: JSON.parse(JSON.stringify(evtFormGroupProfiles)),
  }
}

let _formSaveTimer: ReturnType<typeof setTimeout> | null = null
// Lazily create the registration_forms row + link events.form_id the first time
// the forms tab needs to persist (events created without a form have no form_id).
let _ensuringForm: Promise<string | null> | null = null
async function ensureEventFormId(): Promise<string | null> {
  if (event.value?.form_id) return event.value.form_id
  if (!props.eventId || !orgId.value) return null
  if (_ensuringForm) return _ensuringForm
  _ensuringForm = (async () => {
    const { data } = await (db.from as any)('registration_forms').insert({
      org_id: orgId.value,
      name: event.value?.title ? `${event.value.title} registration` : 'Event registration',
    }).select('id').single()
    if (!data) return null
    await (db.from as any)('events').update({ form_id: data.id }).eq('id', props.eventId)
    if (event.value) event.value.form_id = data.id
    return data.id as string
  })()
  const id = await _ensuringForm
  _ensuringForm = null
  return id
}

function persistEvtFormConfig() {
  if (_formSaveTimer) clearTimeout(_formSaveTimer)
  _formSaveTimer = setTimeout(async () => {
    const formId = await ensureEventFormId()
    if (!formId) return
    await db.from('registration_forms').update({ config: buildEvtFormConfig() }).eq('id', formId)
  }, 600)
}

async function loadEvtFormConfig() {
  const formId = event.value?.form_id
  if (!formId) return
  const { data } = await db.from('registration_forms').select('config').eq('id', formId).single()
  const c = data?.config
  if (!c || !Object.keys(c).length) return
  if (Array.isArray(c.groups)) {
    // Apply the saved groups even when EMPTY — deleting every form must stay
    // deleted on reload, not fall back to the default 'general' seed.
    evtFormGroupsList.value = c.groups
    c.groups.forEach((g: any) => {
      if (!(g.id in evtFormGroupModes)) evtFormGroupModes[g.id] = ''
      if (!(g.id in evtFormGroupDesigns)) evtFormGroupDesigns[g.id] = { ...evtFormGroupDesigns['general'] }
    })
    if (!c.groups.length) { selectedFormGroupId.value = ''; evtFormShowSections.value = false }
    else if (!c.groups.some((g: any) => g.id === selectedFormGroupId.value)) selectedFormGroupId.value = c.groups[0].id
  }
  if (c.modes) Object.assign(evtFormGroupModes, c.modes)
  if (c.designs) {
    Object.keys(c.designs).forEach(k => { evtFormGroupDesigns[k] = c.designs[k] })
  }
  if (c.sessions) Object.assign(evtFormGroupSessions, c.sessions)
  if (c.subjectSessions) Object.assign(evtFormSubjectSessions, c.subjectSessions)
  if (c.sectionSaved) Object.assign(evtFormSectionSaved, c.sectionSaved)
  if (c.payment) {
    Object.assign(evtFormPayment.invoice, c.payment.invoice ?? {})
    Object.assign(evtFormPayment.plan, c.payment.plan ?? {})
    Object.assign(evtFormPayment.credit_card, c.payment.credit_card ?? {})
    Object.assign(evtFormPayment.coupon, c.payment.coupon ?? {})
  }
  if (c.terms) evtFormTermsSelections.value = c.terms
  if (c.discountSettings) Object.assign(evtDiscountSettings, c.discountSettings)
  if (c.groupFields) {
    Object.keys(c.groupFields).forEach(k => { evtFormGroupFields[k] = c.groupFields[k] })
  }
  if (c.groupProfiles) {
    Object.keys(c.groupProfiles).forEach(k => { evtFormGroupProfiles[k] = c.groupProfiles[k] })
  }
}

const evtFormSections = computed(() => {
  const mode = evtFormGroupModes[selectedFormGroupId.value]
  const saved = evtFormSectionSaved[selectedFormGroupId.value] ?? {}
  const eligibleSessions = sessions.value.filter((s: any) => s.display_on_form !== false)
  const hasSessions = eligibleSessions.length > 0
  const sessionMap = evtFormGroupSessions[selectedFormGroupId.value] ?? {}
  const visibleCount = eligibleSessions.filter((s: any) => {
    const mode = sessionMap[s.id ?? s._savedId]
    return !mode || mode !== 'hidden'
  }).length
  const selectCount = eligibleSessions.filter((s: any) => {
    const m = sessionMap[s.id ?? s._savedId] ?? 'select'
    return m === 'select'
  }).length
  const infoCount = eligibleSessions.filter((s: any) => {
    const m = sessionMap[s.id ?? s._savedId] ?? 'select'
    return m === 'info'
  }).length
  const sessionsComplete = hasSessions
  const parts = []
  if (selectCount) parts.push(`${selectCount} selectable`)
  if (infoCount) parts.push(`${infoCount} info`)
  const sessionsSubtitle = hasSessions ? (parts.length ? parts.join(', ') : `${eligibleSessions.length} selectable`) : 'Not configured'
  // "Form Design" + standard sections only. "Who is registering" (the subject
  // loop) and each subject's per-type form are rendered inline in the nav view.
  // Sessions are configured per-subject (from each chooser's Settings), not as a
  // standalone "Sessions" section in the nav.
  if (mode === 'simple') return [
    { id: 'design', index: 1, label: 'Form Design', icon: 'pi-cog', complete: !!saved.design, subtitle: null },
    { id: 'terms', index: 2, label: 'Terms & Conditions', icon: 'pi-file', complete: !!saved.terms, subtitle: null },
    { id: 'payment', index: 3, label: 'Payment Options', icon: 'pi-credit-card', complete: !!saved.payment, subtitle: null },
  ]
  return [
    { id: 'design', index: 1, label: 'Form Design', icon: 'pi-cog', complete: !!saved.design, subtitle: null },
    { id: 'terms', index: 2, label: 'Terms & Conditions', icon: 'pi-file', complete: !!saved.terms, subtitle: null },
    { id: 'payment', index: 3, label: 'Payment Options', icon: 'pi-credit-card', complete: !!saved.payment, subtitle: null },
  ]
})

const evtFormSectionCompletedCount = computed(() => evtFormSections.value.filter(s => s.complete).length)

// Two-step chooser: 'type' (Basic / Start from scratch / …) → 'template' (who's registering).
const evtChooserStep = ref<'type' | 'template'>('type')

function selectEvtFormGroup(id: string) {
  selectedFormGroupId.value = id
  evtSelectedFormSection.value = ''
  evtChooserStep.value = 'type'
  evtFormShowSections.value = !!evtFormGroupModes[id] && evtFormGroupModes[id] !== 'none'
}

// Make sure there's a real selected form group to apply a choice to. When the list is
// empty (e.g. all forms deleted) the chooser still shows; the first pick creates one.
function ensureEvtFormGroupSelected(): string {
  let id = selectedFormGroupId.value
  if (!id || !evtFormGroupsList.value.some(g => g.id === id)) {
    id = crypto.randomUUID()
    evtFormGroupsList.value.push({ id, name: 'Registration Form', person_type: 'all', audience: 'all' })
    evtFormGroupModes[id] = ''
    evtFormGroupSessions[id] = {}
    evtFormGroupDesigns[id] = { ...evtFormGroupDesigns['general'] }
    selectedFormGroupId.value = id
  }
  return id
}

function chooseEvtFormType(mode: string) {
  const id = ensureEvtFormGroupSelected()
  evtFormGroupModes[id] = mode
  evtFormShowSections.value = mode !== 'none'
  evtSelectedFormSection.value = ''
  evtChooserStep.value = 'type'
  // Starting a fresh scratch form shouldn't be empty — seed one default person
  // subject (the first person type, e.g. Member/Player; else a generic one).
  if (mode === 'scratch' && !currentEvtFormProfiles.value.length) {
    const firstPerson = evtSubjectTypes.value.find(t => (t.kind || 'person') === 'person')
    if (firstPerson) addEvtProfile(firstPerson)
    else currentEvtFormProfiles.value = [{ key: 'member', label: 'Member', min: 1, max: 1, kind: 'person', selectsOptions: true } as any]
  }
  persistEvtFormConfig()
}

function changeEvtFormType() {
  evtFormGroupModes[selectedFormGroupId.value] = ''
  evtFormShowSections.value = false
  evtSelectedFormSection.value = ''
  evtChooserStep.value = 'type'
}


// ── moved auto-save watchers (from events/[id].vue 7483–7493) ──
// Auto-save form config whenever any form-builder state changes
watch(
  [evtFormPayment, evtFormTermsSelections, evtDiscountSettings],
  () => persistEvtFormConfig(),
  { deep: true }
)
watch(
  [evtFormGroupModes, evtFormGroupDesigns, evtFormGroupSessions, evtFormGroupsList, evtFormGroupFields],
  () => persistEvtFormConfig(),
  { deep: true }
)

async function reload() {
  if (!props.eventId) { event.value = null; return }
  const { data } = await (db.from as any)('events').select('*').eq('id', props.eventId).maybeSingle()
  event.value = data ?? null
  await loadEvtFormConfig()
}
onMounted(reload)
watch(() => props.eventId, () => reload())
defineExpose({ reload })
</script>

<template>
  <div class="flex flex-col flex-1 min-h-0">
    <!-- Preview-mode banner: device toggle + Exit (full-width across the top during preview) -->
    <div v-if="evtFormGroups.length && evtPublicPreview && (evtFormGroupModes[selectedFormGroupId] === 'scratch' || evtFormGroupModes[selectedFormGroupId] === 'simple')"
      class="relative flex items-center justify-between gap-3 px-4 py-2 bg-primary text-white shrink-0">
      <span class="text-xs font-semibold inline-flex items-center gap-2"><i class="pi pi-eye text-xs" />Preview — how registrants see this form</span>
      <!-- Device toggle centered in the bar -->
      <div class="absolute left-1/2 -translate-x-1/2 inline-flex items-center gap-0.5 bg-white/15 rounded-lg p-0.5">
        <button type="button" class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors"
          :class="evtPreviewDevice === 'desktop' ? 'bg-white text-primary' : 'text-white/70 hover:text-white'"
          @click="evtPreviewDevice = 'desktop'"><i class="pi pi-desktop text-xs" />Desktop</button>
        <button type="button" class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors"
          :class="evtPreviewDevice === 'mobile' ? 'bg-white text-primary' : 'text-white/70 hover:text-white'"
          @click="evtPreviewDevice = 'mobile'"><i class="pi pi-mobile text-xs" />Mobile</button>
      </div>
      <button type="button" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-semibold transition-colors"
        @click="evtPublicPreview = false"><i class="pi pi-times text-xs" />Exit preview</button>
    </div>

    <!-- forms body (from events/[id].vue 252–2078) -->

        <!-- Two-panel body -->
        <div class="flex flex-1 min-h-0">

        <!-- Left panel (editor; hidden during public preview) -->
        <div v-if="evtFormGroups.length && !evtPublicPreview" class="w-[420px] shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">

          <!-- Group list -->
          <template v-if="!evtFormShowSections">
            <div class="px-5 pt-5 pb-3 flex items-start justify-between gap-2">
              <div>
                <h2 class="text-base font-bold text-gray-900">Registration Forms</h2>
                <p class="text-xs text-gray-400 mt-0.5">Configure a form for each registration group.</p>
              </div>
              <button type="button"
                class="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-primary hover:bg-[#2a2f6e] text-white transition-colors mt-0.5"
                v-tooltip.left="'Add form'"
                @click="addEvtFormGroupViaChooser">
                <i class="pi pi-plus text-xs" />
              </button>
            </div>
            <div class="flex-1 overflow-y-auto px-3 pb-4 space-y-1.5">
              <div
                v-for="group in evtFormGroups" :key="group.id"
                class="group/fg w-full flex items-center gap-3 px-3 py-3 rounded-xl border transition-all text-left cursor-pointer"
                :class="selectedFormGroupId === group.id
                  ? 'bg-primary/5 border-primary/20 shadow-sm'
                  : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/60'"
                @click="selectEvtFormGroup(group.id)">
                <div class="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                  :class="group.noRegistrations ? 'bg-orange-50' : group.complete ? 'bg-green-50' : group.notSetUp ? 'bg-gray-100' : 'bg-red-50'">
                  <i class="pi text-base"
                    :class="group.noRegistrations ? 'pi-ban text-orange-400' : group.complete ? 'pi-check text-green-500' : group.notSetUp ? 'pi-plus-circle text-gray-400' : 'pi-exclamation-circle text-red-400'" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <input v-if="editingGroupNameId === group.id"
                      :value="evtFormGroupsList.find(g => g.id === group.id)?.name"
                      :ref="(el: any) => { if (el && document.activeElement !== el) el.focus() }"
                      class="text-sm font-semibold text-gray-800 bg-white border border-primary/30 rounded px-1.5 py-0.5 outline-none min-w-0 focus:ring-2 focus:ring-primary/20"
                      @click.stop
                      @input="e => { const g = evtFormGroupsList.find(x => x.id === group.id); if (g) g.name = (e.target as HTMLInputElement).value }"
                      @blur="editingGroupNameId = null"
                      @keyup.enter="(e: any) => e.target.blur()"
                    />
                    <template v-else>
                      <span class="text-sm font-semibold text-gray-800 truncate">{{ evtFormGroupsList.find(g => g.id === group.id)?.name }}</span>
                      <button type="button" class="shrink-0 text-gray-300 hover:text-primary opacity-0 group-hover/fg:opacity-100 transition-opacity"
                        v-tooltip.top="'Rename'" @click.stop="editingGroupNameId = group.id">
                        <i class="pi pi-pencil text-[10px]" />
                      </button>
                    </template>
                    <span class="text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
                      :class="{
                        'bg-primary/10 text-primary': (evtFormGroupsList.find(g => g.id === group.id)?.audience ?? 'all') === 'members',
                        'bg-green-50 text-green-700': (evtFormGroupsList.find(g => g.id === group.id)?.audience ?? 'all') === 'public',
                        'bg-gray-100 text-gray-500': (evtFormGroupsList.find(g => g.id === group.id)?.audience ?? 'all') === 'all',
                      }">
                      {{ { all: 'Everyone', members: 'Members', public: 'Public' }[evtFormGroupsList.find(g => g.id === group.id)?.audience ?? 'all'] }}
                    </span>
                  </div>
                  <p class="text-xs mt-0.5" :class="group.noRegistrations ? 'text-orange-400' : group.complete ? 'text-green-500' : group.notSetUp ? 'text-gray-400' : 'text-gray-500'">
                    {{ group.noRegistrations ? 'No registrations' : group.complete ? 'Complete' : group.notSetUp ? 'Not set up' : `${group.filledCount} of ${group.totalCount} sections saved` }}
                  </p>
                </div>
                <div v-if="!group.noRegistrations && !group.notSetUp && !group.complete" class="shrink-0 flex flex-col items-end gap-1">
                  <span class="text-xs font-bold text-gray-400">{{ group.filledCount }}/{{ group.totalCount }}</span>
                  <div class="w-12 h-1 rounded-full bg-gray-100 overflow-hidden">
                    <div class="h-full rounded-full bg-[#1ab4e8] transition-all" :style="`width:${group.totalCount ? (group.filledCount/group.totalCount)*100 : 0}%`" />
                  </div>
                </div>
                <template v-else>
                  <button type="button"
                    class="opacity-0 group-hover/fg:opacity-100 w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                    @click.stop="formToDelete = group.id">
                    <i class="pi pi-trash text-xs" />
                  </button>
                </template>
              </div>
            </div>
          </template>

          <!-- Section nav / section settings (after form type chosen) -->
          <template v-else>

            <!-- Section nav: shown when no section is selected -->
            <template v-if="!evtSelectedFormSection">
              <!-- Header -->
              <div class="px-5 pt-5 pb-4 border-b border-gray-100">
                <button type="button" class="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#0e43a3] transition-colors mb-2" @click="evtFormShowSections = false">
                  <i class="pi pi-chevron-left text-[10px]" />
                  All Forms
                </button>
                <div class="flex items-start justify-between gap-2">
                  <div class="flex-1 min-w-0">
                    <input
                      :value="currentEvtFormGroupName"
                      class="text-base font-bold text-gray-900 bg-transparent border-0 outline-none p-0 focus:ring-0 w-full"
                      @input="e => { const g = evtFormGroupsList.find(x => x.id === selectedFormGroupId); if (g) g.name = (e.target as HTMLInputElement).value }"
                    />
                    <p class="text-xs text-gray-400 mt-0.5">{{ evtFormSectionCompletedCount }} of {{ evtFormSections.length }} sections complete</p>
                  </div>
                  <div class="shrink-0 mt-1">
                    <div class="w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div class="h-full rounded-full bg-[#1ab4e8] transition-all" :style="`width:${evtFormSections.length ? (evtFormSectionCompletedCount/evtFormSections.length)*100 : 0}%`" />
                    </div>
                  </div>
                </div>
              </div>
              <div class="flex-1 overflow-y-auto">
                <!-- ── WHO IS REGISTERING — inline subject loop (first) ── -->
                <div class="px-4 pt-3 pb-1">
                  <div class="flex items-center justify-between mb-2">
                    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Who is registering</p>
                    <span v-if="currentEvtFormProfiles.length" class="text-[10px] text-gray-300">{{ currentEvtFormProfiles.length }}</span>
                  </div>

                  <!-- Quick start (only until someone's added) -->
                  <Select v-if="!currentEvtFormProfiles.length" :modelValue="null" :options="evtProfilePresets" option-label="label"
                    placeholder="Quick start — who is this form for?" class="w-full mb-2" @update:modelValue="applyEvtProfilePreset">
                    <template #option="{ option }">
                      <div class="flex items-center gap-2"><i :class="['pi', option.icon, 'text-[#1ab4e8]']" /><span class="text-sm font-medium">{{ option.label }}</span></div>
                    </template>
                  </Select>

                  <!-- Subject rows -->
                  <div ref="evtSubjectListEl" class="space-y-1.5">
                    <div v-for="(p, i) in currentEvtFormProfiles" :key="p.key" :data-subject-key="p.key"
                      class="group/sub flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-100 hover:border-primary/30 hover:bg-gray-50/60 transition-all cursor-pointer"
                      @click="openEvtSubjectSettings(p.key)">
                      <span class="subject-drag-handle shrink-0 -ml-1 w-5 flex items-center justify-center cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 transition-colors" v-tooltip.top="'Drag to reorder'" @click.stop>
                        <i class="pi pi-bars text-[11px]" />
                      </span>
                      <div class="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                        :class="(p.kind ?? '') === 'entity' ? 'bg-violet-50' : 'bg-blue-50'">
                        <i :class="['pi', evtSubjectIcon(p), 'text-sm', (p.kind ?? '') === 'entity' ? 'text-violet-500' : 'text-[#0e43a3]']" />
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-semibold text-gray-800 truncate">{{ p.label }}</p>
                        <p class="text-[11px] text-gray-400">
                          {{ evtTargetFieldCount(p.key) }} {{ evtTargetFieldCount(p.key) === 1 ? 'field' : 'fields' }}
                          · min {{ p.min }}<span v-if="p.max"> · max {{ p.max }}</span>
                          <span v-if="evtSubjectSelectsOptions(p)" class="text-[#0e43a3]"> · chooses options</span>
                        </p>
                      </div>
                      <i v-if="evtSubjectMissingRequired(p.key)" v-tooltip.top="'Required fields missing for this ' + ((p.kind ?? '') === 'entity' ? 'entity' : 'person')" class="pi pi-exclamation-triangle text-amber-500 text-sm shrink-0" />
                      <button type="button"
                        class="shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover/sub:opacity-100 transition-all"
                        @click.stop="removeEvtProfile(i)"><i class="pi pi-trash text-xs" /></button>
                      <i class="pi pi-chevron-right text-gray-300 text-xs shrink-0" />
                    </div>
                  </div>

                  <!-- Add subject (opens its own page) -->
                  <div class="mt-2">
                    <button type="button"
                      class="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-gray-200 text-xs font-semibold text-gray-500 hover:border-primary hover:text-primary transition-all"
                      @click="evtSelectedFormSection = 'add-subject'"><i class="pi pi-plus text-[10px]" />Add a person or entity</button>
                  </div>
                </div>

                <!-- Form Design / Sessions / Terms / Payment -->
                <FormSectionList :sections="evtFormSections" @select="(id: string) => evtSelectedFormSection = id" />
                <!-- Final step: preview the form — matches the FormSectionList item style -->
                <div class="px-3 pb-3 -mt-1">
                  <button type="button" class="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50/60 transition-all text-left group"
                    @click="evtPublicPreview = true">
                    <div class="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center bg-gray-100 group-hover:bg-gray-200">
                      <i class="pi pi-eye text-sm text-gray-500" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-semibold text-gray-800">Preview form</p>
                      <p class="text-xs mt-0.5 text-gray-400">See it as a registrant</p>
                    </div>
                    <i class="pi pi-chevron-right text-sm shrink-0 text-gray-300" />
                  </button>
                </div>
              </div>
              <div class="px-4 py-4 border-t border-gray-100 space-y-2 shrink-0">
                <button type="button" class="w-full py-2.5 rounded-xl bg-[#1ab4e8] hover:bg-[#16a0d0] text-white font-semibold text-sm transition-colors" @click="evtFormShowSections = false">Done</button>
                <div class="flex items-center justify-between pt-1">
                  <button type="button" class="text-xs text-gray-400 hover:text-[#182e59] transition-colors" @click="changeEvtFormType()">Change form type</button>
                  <button type="button" class="text-xs text-red-400 hover:text-red-600 transition-colors" @click="formToDelete = selectedFormGroupId">Delete form</button>
                </div>
              </div>
            </template>

            <!-- PER-SUBJECT PAGE (settings + configure form) -->
            <template v-else-if="evtSelectedFormSection === 'settings' && currentEvtSubject && currentEvtSubjectIndex >= 0">
              <div class="flex items-center gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
                <button type="button" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500" @click="evtSelectedFormSection = ''">
                  <i class="pi pi-chevron-left text-sm" />
                </button>
                <div class="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                  :class="(currentEvtSubject.kind ?? '') === 'entity' ? 'bg-violet-50' : 'bg-blue-50'">
                  <i :class="['pi', evtSubjectIcon(currentEvtSubject), 'text-base', (currentEvtSubject.kind ?? '') === 'entity' ? 'text-violet-500' : 'text-[#0e43a3]']" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-bold text-gray-900 truncate">{{ currentEvtSubject.label }}</p>
                  <p class="text-xs text-gray-400">{{ (currentEvtSubject.kind ?? '') === 'entity' ? 'Entity' : 'Person' }} registering</p>
                </div>
              </div>
              <div class="flex-1 overflow-y-auto px-5 py-5 space-y-4">
                <!-- Display name (singular + plural) -->
                <div class="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
                  <p class="text-sm font-bold text-gray-800">Display name</p>
                  <p class="text-xs text-gray-400 -mt-1">What this {{ (currentEvtSubject.kind ?? '') === 'entity' ? 'entity' : 'person' }} is called on this form — e.g. rename “Member / Player” to “Swimmer” or “Player”.</p>
                  <div class="grid grid-cols-2 gap-2">
                    <div class="space-y-1">
                      <label class="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Singular</label>
                      <InputText :modelValue="currentEvtSubject.label" :maxlength="20" placeholder="Swimmer" class="w-full" @update:modelValue="v => patchEvtProfile(currentEvtSubjectIndex, { label: v || '' })" />
                    </div>
                    <div class="space-y-1">
                      <label class="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Plural</label>
                      <InputText :modelValue="(currentEvtSubject as any).labelPlural || ''" :maxlength="20" :placeholder="(currentEvtSubject.label || 'Swimmer') + 's'" class="w-full" @update:modelValue="v => patchEvtProfile(currentEvtSubjectIndex, { labelPlural: v || '' })" />
                    </div>
                  </div>
                </div>
                <!-- Configure form (primary action) -->
                <button type="button" class="w-full text-left rounded-xl border-2 border-primary/15 bg-primary/[0.04] p-4 hover:border-primary hover:bg-primary/[0.07] hover:shadow-sm transition-all flex items-center gap-3.5 group"
                  @click="openEvtSubject(currentEvtSubject.key)">
                  <div class="shrink-0 w-11 h-11 rounded-xl bg-primary flex items-center justify-center shadow-sm"><i class="pi pi-pencil text-white text-base" /></div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-bold text-primary">Configure form fields →</p>
                    <p class="text-xs text-gray-500">Choose what you collect about each {{ currentEvtSubject.label.toLowerCase() }} · <span class="font-semibold text-gray-700">{{ evtTargetFieldCount(currentEvtSubject.key) }} {{ evtTargetFieldCount(currentEvtSubject.key) === 1 ? 'field' : 'fields' }}</span></p>
                  </div>
                  <i class="pi pi-chevron-right text-primary/40 group-hover:text-primary text-sm transition-colors" />
                </button>

                <!-- How many -->
                <div class="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                  <p class="text-sm font-bold text-gray-800">How many</p>
                  <p class="text-xs text-gray-400 -mt-2">How many of this {{ (currentEvtSubject.kind ?? '') === 'entity' ? 'entity' : 'person' }} a single registration can include.</p>
                  <div class="flex items-center gap-6">
                    <label class="flex items-center gap-2"><span class="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Min</span>
                      <InputNumber :modelValue="currentEvtSubject.min" :min="0" :input-class="'!w-16 text-center'" @update:modelValue="v => patchEvtProfile(currentEvtSubjectIndex, { min: v })" /></label>
                    <label class="flex items-center gap-2"><span class="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Max</span>
                      <InputNumber :modelValue="currentEvtSubject.max" :min="0" placeholder="∞" :input-class="'!w-16 text-center'" @update:modelValue="v => patchEvtProfile(currentEvtSubjectIndex, { max: v })" /></label>
                  </div>
                </div>

                <!-- Sessions & fees -->
                <div class="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                  <p class="text-sm font-bold text-gray-800">Sessions &amp; fees</p>
                  <label class="flex items-center justify-between gap-3 cursor-pointer">
                    <span class="text-sm text-gray-700">Chooses the sessions / classes / fees</span>
                    <ToggleSwitch :modelValue="evtSubjectSelectsOptions(currentEvtSubject)" @update:modelValue="v => patchEvtProfile(currentEvtSubjectIndex, { selectsOptions: v })" />
                  </label>
                  <button v-if="evtSubjectSelectsOptions(currentEvtSubject) && sessions.length" type="button"
                    class="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-gray-200 hover:border-[#0e43a3] hover:bg-blue-50/30 transition-all text-sm font-semibold text-[#0e43a3]"
                    @click="openEvtSubjectSessions(currentEvtSubject.key)">
                    <span>Choose which sessions {{ currentEvtSubject.label }} can pick</span><i class="pi pi-chevron-right text-xs" />
                  </button>
                  <p v-else-if="!sessions.length" class="text-xs text-gray-400">This event has no sessions to choose from.</p>
                </div>

                <p class="text-[11px] text-gray-300 text-center pt-1">More {{ currentEvtSubject.label }} settings coming soon.</p>
              </div>
              <div class="px-5 pb-5 pt-3 border-t border-gray-100 shrink-0">
                <button type="button" class="w-full py-2.5 rounded-lg bg-[#1ab4e8] hover:bg-[#16a0d0] text-white font-semibold text-sm transition-colors" @click="evtSelectedFormSection = ''">Done</button>
              </div>
            </template>

            <!-- ADD A PERSON OR ENTITY (full panel) -->
            <template v-else-if="evtSelectedFormSection === 'add-subject'">
              <div class="flex items-center gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
                <button type="button" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500" @click="evtSelectedFormSection = ''">
                  <i class="pi pi-chevron-left text-sm" />
                </button>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-bold text-gray-900">Add to this form</p>
                  <p class="text-xs text-gray-400">Who else is registering? Pick a person or entity type.</p>
                </div>
              </div>
              <div class="flex-1 overflow-y-auto px-5 py-5 space-y-5">
                <!-- People -->
                <div v-if="evtUnusedPeople.length">
                  <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">People</p>
                  <div class="space-y-2">
                    <button v-for="t in evtUnusedPeople" :key="t.key" type="button"
                      class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:border-primary hover:bg-blue-50/40 transition-all text-left"
                      @click="addEvtProfile(t)">
                      <div class="shrink-0 w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center"><i class="pi pi-user text-[#0e43a3] text-xs" /></div>
                      <span class="flex-1 min-w-0">{{ t.label }}</span>
                      <i class="pi pi-plus text-gray-300 text-xs" />
                    </button>
                  </div>
                </div>
                <!-- Entities -->
                <div v-if="evtUnusedEntities.length">
                  <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Entities</p>
                  <div class="space-y-2">
                    <button v-for="t in evtUnusedEntities" :key="t.key" type="button"
                      class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:border-violet-400 hover:bg-violet-50/40 transition-all text-left"
                      @click="addEvtProfile(t)">
                      <div class="shrink-0 w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center"><i class="pi pi-building text-violet-500 text-xs" /></div>
                      <span class="flex-1 min-w-0">{{ t.label }}</span>
                      <i class="pi pi-plus text-gray-300 text-xs" />
                    </button>
                  </div>
                </div>
                <p v-if="!evtSubjectTypes.length" class="text-sm text-gray-400">No subject types defined yet — create them in Settings → Fields → Person Types.</p>
                <p v-else-if="!evtUnusedPeople.length && !evtUnusedEntities.length" class="text-sm text-gray-400">Every available subject type is already on this form.</p>
              </div>
              <div class="px-5 pb-5 pt-3 border-t border-gray-100 shrink-0">
                <button type="button" class="w-full py-2.5 rounded-lg bg-[#1ab4e8] hover:bg-[#16a0d0] text-white font-semibold text-sm transition-colors" @click="evtSelectedFormSection = ''">Done</button>
              </div>
            </template>

            <!-- DESIGN/SETTINGS section settings -->
            <template v-else-if="evtSelectedFormSection === 'design'">
              <EventFormDesignPanel
                :design="currentEvtFormDesign"
                :audience="(evtFormGroupsList.find(g => g.id === selectedFormGroupId)?.audience ?? 'all')"
                @back="evtSelectedFormSection = ''"
                @save="saveEvtFormSection('design')"
                @update:audience="v => { const g = evtFormGroupsList.find(x => x.id === selectedFormGroupId); if (g) { g.audience = v as any; persistEvtFormConfig() } }"
                @image-upload="(key, e) => handleEvtFormImageUpload(key, e)" />
            </template>

            <!-- FIELDS section settings -->
            <template v-else-if="evtSelectedFormSection === 'fields'">

              <!-- ── FIELD EDITOR: shown when a field is selected ── -->
              <template v-if="evtEditingField">
                <!-- Header -->
                <div class="flex items-center gap-2 px-4 py-3.5 border-b border-gray-100 shrink-0">
                  <button type="button" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" @click="evtSelectedFieldId = null">
                    <i class="pi pi-chevron-left text-sm" />
                  </button>
                  <p class="flex-1 text-sm font-bold text-gray-900 truncate">{{ evtEditingField.label || 'Untitled Field' }}</p>
                  <span v-if="evtEditingField.locked" v-tooltip.bottom="'Required field — cannot be removed'" class="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5"><i class="pi pi-lock text-[9px]" />Locked</span>
                  <button v-if="!evtEditingField.locked" type="button" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-[#0e43a3] transition-colors" title="Duplicate" @click="duplicateEvtFormField(evtEditingField.id)">
                    <i class="pi pi-copy text-sm" />
                  </button>
                  <button v-if="!evtEditingField.locked" type="button" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="Delete" @click="removeEvtFormField(evtEditingField.id); evtSelectedFieldId = null">
                    <i class="pi pi-trash text-sm" />
                  </button>
                </div>

                <!-- Tabs: Details / Advanced -->
                <div class="flex border-b border-gray-100 shrink-0">
                  <button type="button"
                    class="flex-1 py-2.5 text-xs font-semibold transition-colors border-b-2"
                    :class="evtFieldEditorTab === 'details' ? 'text-primary border-primary' : 'text-gray-400 hover:text-gray-600 border-transparent'"
                    @click="evtFieldEditorTab = 'details'">Details</button>
                  <button type="button"
                    class="flex-1 py-2.5 text-xs font-semibold transition-colors border-b-2"
                    :class="evtFieldEditorTab === 'advanced' ? 'text-primary border-primary' : 'text-gray-400 hover:text-gray-600 border-transparent'"
                    @click="evtFieldEditorTab = 'advanced'">Advanced</button>
                </div>

                <!-- Details tab -->
                <div v-if="evtFieldEditorTab === 'details'" class="overflow-y-auto flex-1 px-4 py-4 space-y-5">
                  <!-- ── Layout element editors (Section / Image / Text / Button) ── -->
                  <template v-if="evtEditingIsElement">
                    <!-- Section: heading + description -->
                    <template v-if="evtEditingField.field_type === 'section'">
                      <div class="space-y-1.5">
                        <label class="text-sm font-semibold text-gray-800">Heading</label>
                        <input v-model="evtEditingField.label" type="text" placeholder="e.g. Personal details" class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors" />
                      </div>
                      <div class="space-y-1.5">
                        <label class="text-sm font-semibold text-gray-800">Description</label>
                        <textarea v-model="evtEditingField.placeholder" rows="3" placeholder="Optional — shown beside the section" class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors resize-none" />
                        <p class="text-[11px] text-gray-400">Drag fields into this section in the preview.</p>
                      </div>
                    </template>
                    <!-- Image: upload + alt + alignment -->
                    <template v-else-if="evtEditingField.field_type === 'image'">
                      <div class="space-y-1.5">
                        <label class="text-sm font-semibold text-gray-800">Image</label>
                        <FormsImageUploadField :modelValue="evtEditingField.options[0]" @update:modelValue="v => evtEditingField.options[0] = v" />
                      </div>
                      <div class="space-y-1.5">
                        <label class="text-sm font-semibold text-gray-800">Alt text</label>
                        <input v-model="evtEditingField.options[1]" type="text" placeholder="Describe the image" class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors" />
                      </div>
                      <div class="space-y-2">
                        <label class="text-sm font-semibold text-gray-800">Alignment</label>
                        <div class="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-semibold capitalize">
                          <button v-for="a in ['left','center','right']" :key="a" type="button" class="flex-1 py-2 transition-colors border-r border-gray-200 last:border-0" :class="evtEditingField.options[2] === a ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'" @click="evtEditingField.options[2] = a">{{ a }}</button>
                        </div>
                      </div>
                    </template>
                    <!-- Text: content + size -->
                    <template v-else-if="evtEditingField.field_type === 'textblock'">
                      <div class="space-y-1.5">
                        <label class="text-sm font-semibold text-gray-800">Text</label>
                        <textarea v-model="evtEditingField.options[0]" rows="4" placeholder="Instructional text shown on the form" class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors resize-none" />
                      </div>
                      <div class="space-y-2">
                        <label class="text-sm font-semibold text-gray-800">Size</label>
                        <div class="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-semibold">
                          <button v-for="s in [{v:'sm',l:'Small'},{v:'base',l:'Normal'},{v:'lg',l:'Large'}]" :key="s.v" type="button" class="flex-1 py-2 transition-colors border-r border-gray-200 last:border-0" :class="(evtEditingField.options[1] || 'base') === s.v ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'" @click="evtEditingField.options[1] = s.v">{{ s.l }}</button>
                        </div>
                      </div>
                    </template>
                    <!-- Button: label + link + style -->
                    <template v-else-if="evtEditingField.field_type === 'button'">
                      <div class="space-y-1.5">
                        <label class="text-sm font-semibold text-gray-800">Button text</label>
                        <input v-model="evtEditingField.options[0]" type="text" placeholder="e.g. Learn more" class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors" />
                      </div>
                      <div class="space-y-1.5">
                        <label class="text-sm font-semibold text-gray-800">Link URL</label>
                        <input v-model="evtEditingField.options[1]" type="text" placeholder="https://…" class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors" />
                      </div>
                      <div class="space-y-2">
                        <label class="text-sm font-semibold text-gray-800">Style</label>
                        <div class="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-semibold">
                          <button v-for="st in [{v:'primary',l:'Solid'},{v:'secondary',l:'Outline'},{v:'link',l:'Link'}]" :key="st.v" type="button" class="flex-1 py-2 transition-colors border-r border-gray-200 last:border-0" :class="(evtEditingField.options[2] || 'primary') === st.v ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'" @click="evtEditingField.options[2] = st.v">{{ st.l }}</button>
                        </div>
                      </div>
                    </template>
                  </template>
                  <!-- ── Data field editor ── -->
                  <template v-else>
                  <!-- National field notice: definition is owned by the governing body -->
                  <div v-if="evtEditingFieldInherited" class="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                    <i class="pi pi-lock text-amber-500 text-xs mt-0.5" />
                    <p class="text-xs text-amber-700 flex-1 leading-relaxed">Managed by <span class="font-semibold">{{ evtEditingFieldOwner }}</span>. Its label, type and options are set nationally and its data stays connected to the {{ (currentEvtSubject?.label || 'subject').toLowerCase() }}. You can still set it required and add advanced rules.</p>
                  </div>
                  <!-- Label (shown to registrants) -->
                  <div class="space-y-1.5">
                    <label class="text-sm font-semibold text-gray-800">Label <span class="text-red-400">*</span></label>
                    <input v-model="evtEditingField.label" type="text" :readonly="evtEditingFieldInherited" :class="evtEditingFieldInherited ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''" placeholder="Displayed to registrants" class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors" />
                  </div>
                  <!-- Name (system / reporting) -->
                  <div class="space-y-1.5">
                    <div class="flex items-center gap-1.5">
                      <label class="text-sm font-semibold text-gray-800">Name <span class="text-red-400">*</span></label>
                      <i class="pi pi-info-circle text-gray-300 text-xs" title="Used in reporting and system exports" />
                    </div>
                    <input v-model="evtEditingField.system_name" type="text" :readonly="evtEditingFieldInherited" :class="evtEditingFieldInherited ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''" placeholder="e.g. email_address" class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors" />
                  </div>
                  <!-- Input Type (dropdown) — hidden for system fields (account/comms/…) -->
                  <div v-if="!evtEditingField.system" class="space-y-1.5">
                    <div class="flex items-center gap-1.5">
                      <label class="text-sm font-semibold text-gray-800">Input Type <span class="text-red-400">*</span></label>
                      <i class="pi pi-info-circle text-gray-300 text-xs" />
                    </div>
                    <Select v-model="evtEditingField.field_type" :options="evtInputTypesFor(evtEditingField)" option-label="label" option-value="value" placeholder="Choose a type" class="w-full" :disabled="evtEditingField.locked || evtEditingFieldInherited" />
                  </div>
                  <div v-else class="flex items-center gap-2 text-xs text-gray-400"><i class="pi pi-cog text-[11px]" />System field — {{ EVT_SYSTEM_FIELDS.find(s => s.field_type === evtEditingField.field_type)?.description }}</div>
                  <!-- Account field: access level granted when they choose to log in -->
                  <div v-if="evtEditingField.field_type === 'account'" class="space-y-1.5">
                    <label class="text-sm font-semibold text-gray-800">Access level (if they log in)</label>
                    <Select v-model="evtEditingField.permission_group_id" :options="evtPermissionGroups" option-label="name" option-value="id" placeholder="Choose a permission group" class="w-full" />
                    <p class="text-[11px] text-gray-400">Permission groups come from <span class="font-medium text-gray-500">Settings → Permissions</span>.</p>
                  </div>
                  <!-- Required -->
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-semibold text-gray-800">Required?</span>
                    <ToggleSwitch v-model="evtEditingField.is_required" :disabled="evtEditingField.locked" />
                  </div>
                  <!-- Width -->
                  <div class="space-y-2">
                    <span class="text-sm font-semibold text-gray-800">Width</span>
                    <div class="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-semibold">
                      <button type="button"
                        class="flex-1 py-2 flex items-center justify-center gap-1.5 transition-colors border-r border-gray-200"
                        :class="evtEditingField.col_span === 1 ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'"
                        @click="evtEditingField.col_span = 1">
                        <span class="flex gap-0.5"><span class="w-3 h-3 rounded-sm bg-current opacity-80" /><span class="w-3 h-3 rounded-sm bg-current opacity-30" /></span>
                        Half
                      </button>
                      <button type="button"
                        class="flex-1 py-2 flex items-center justify-center gap-1.5 transition-colors"
                        :class="evtEditingField.col_span === 2 ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'"
                        @click="evtEditingField.col_span = 2">
                        <span class="flex gap-0.5"><span class="w-3 h-3 rounded-sm bg-current opacity-80" /><span class="w-3 h-3 rounded-sm bg-current opacity-80" /></span>
                        Full
                      </button>
                    </div>
                  </div>
                  <!-- Placeholder -->
                  <div class="space-y-2">
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-semibold text-gray-800">Placeholder</span>
                      <ToggleSwitch v-model="evtEditingField.has_placeholder" />
                    </div>
                    <input v-if="evtEditingField.has_placeholder" v-model="evtEditingField.placeholder" type="text" placeholder="Enter a placeholder text" class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors" />
                  </div>
                  <!-- Helper Text -->
                  <div class="space-y-2">
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-semibold text-gray-800">Helper Text</span>
                      <ToggleSwitch v-model="evtEditingField.has_helper_text" />
                    </div>
                    <input v-if="evtEditingField.has_helper_text" v-model="evtEditingField.helper_text" type="text" placeholder="Enter helper text" class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors" />
                  </div>
                  <!-- Min / Max Length -->
                  <template v-if="['text','email','tel','textarea','number'].includes(evtEditingField.field_type)">
                    <div class="flex items-center gap-3">
                      <span class="text-sm font-semibold text-gray-800 flex-1">Min Length</span>
                      <input v-model="evtEditingField.min_length" type="text" placeholder="—" class="w-20 h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] text-center" />
                    </div>
                    <div class="flex items-center gap-3">
                      <span class="text-sm font-semibold text-gray-800 flex-1">Max Length</span>
                      <input v-model="evtEditingField.max_length" type="text" placeholder="—" class="w-20 h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] text-center" />
                    </div>
                  </template>
                  <!-- Dropdown options -->
                  <div v-if="evtEditingField.field_type === 'select'" class="space-y-1.5">
                    <label class="text-sm font-semibold text-gray-800">Options</label>
                    <textarea :value="(evtEditingField.options || []).join('\n')" rows="4" placeholder="One option per line" :readonly="evtEditingFieldInherited"
                      class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors resize-none"
                      :class="evtEditingFieldInherited ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''"
                      @input="evtEditingFieldInherited ? null : evtSetFieldOptions(evtEditingField, $event.target.value)" />
                    <p v-if="evtEditingFieldInherited" class="text-[11px] text-gray-400 flex items-center gap-1"><i class="pi pi-lock text-[9px]" />Options are set by {{ evtEditingFieldOwner }}.</p>
                  </div>
                  <!-- Connected to -->
                  <div class="space-y-2">
                    <div class="flex items-center gap-1.5">
                      <label class="text-sm font-semibold text-gray-800">Connected to <span class="text-red-400">*</span></label>
                      <i class="pi pi-info-circle text-gray-300 text-xs" />
                    </div>
                    <div class="grid grid-cols-2 gap-2" :class="evtEditingFieldInherited ? 'opacity-60 pointer-events-none' : ''">
                      <button v-for="conn in connectionOptions" :key="conn.value" type="button"
                        class="flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl border-2 transition-all text-center"
                        :class="evtEditingField.connected_to === conn.value ? 'border-primary bg-primary' : 'border-gray-200 hover:border-gray-300 bg-white'"
                        @click="evtEditingFieldInherited ? null : (evtEditingField.connected_to = conn.value)">
                        <i class="pi text-lg" :class="[conn.icon, evtEditingField.connected_to === conn.value ? 'text-white' : 'text-gray-400']" />
                        <span class="text-[10px] font-semibold leading-tight whitespace-pre-line" :class="evtEditingField.connected_to === conn.value ? 'text-white' : 'text-gray-500'">{{ conn.label }}</span>
                      </button>
                    </div>
                    <div v-if="evtEditingField.connected_to === 'profile'" class="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
                      <p class="text-xs text-blue-700 flex-1 leading-relaxed">Shows on the attendee's profile, updates with each use, pulls data from the user if set.</p>
                    </div>
                    <div v-if="evtEditingField.connected_to === 'event'" class="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
                      <p class="text-xs text-blue-700 flex-1 leading-relaxed">Stored against this event only. Data is specific to this registration and won't carry across events.</p>
                    </div>
                  </div>
                  </template>
                </div>

                <!-- Advanced tab -->
                <FormFieldAdvancedEditor v-else
                  :field="evtEditingField"
                  :condition-field-options="evtConditionFieldOptions" />
              </template>

              <!-- ── FIELD LIBRARY: shown when no field is selected ── -->
              <template v-else>
                <div class="flex items-center gap-3 px-4 py-4 border-b border-gray-100 shrink-0">
                  <button type="button" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500" @click="evtSelectedFormSection = currentEvtSubject ? 'settings' : ''">
                    <i class="pi pi-chevron-left text-sm" />
                  </button>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-bold text-gray-900 truncate">{{ currentEvtSubject ? currentEvtSubject.label + '’s form' : 'Form' }}</p>
                    <p class="text-xs text-gray-400">{{ currentEvtSubject ? 'What you collect about each ' + currentEvtSubject.label.toLowerCase() : 'Choose what data to collect' }}</p>
                  </div>
                  <button type="button" class="px-3 py-1.5 bg-[#1ab4e8] hover:bg-[#16a0d0] text-white text-xs font-semibold rounded-lg transition-colors" @click="saveEvtFormSection('fields')">Save</button>
                </div>
                <!-- Single fields view: add-new options + existing fields -->
                <div v-if="!evtNewBlockType" class="px-4 py-3 overflow-y-auto space-y-4 flex-1">
                  <!-- Add new field / block -->
                  <div>
                    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Add new</p>
                    <div class="grid grid-cols-5 gap-1.5">
                      <button v-for="bt in evtBlockTypes" :key="bt.type" type="button"
                        v-tooltip.top="bt.description + ' — click or drag onto the form'"
                        draggable="true"
                        class="flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border border-gray-100 hover:border-primary hover:bg-gray-50 transition-all cursor-grab active:cursor-grabbing"
                        @click="evtStartNewField(bt.type)"
                        @dragstart="startEvtBlockDrag($event, bt.type)"
                        @dragend="onEvtFieldDragEnd">
                        <div class="w-8 h-8 rounded-lg flex items-center justify-center" :class="bt.color"><i class="pi text-sm" :class="bt.icon" /></div>
                        <span class="text-[10px] font-semibold text-gray-600 text-center leading-tight">{{ bt.type === 'field' ? 'Field' : bt.label }}</span>
                      </button>
                    </div>
                  </div>
                  <!-- System fields (platform-defined: account holder, comms recipient, …) -->
                  <div>
                    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 px-1">System fields</p>
                    <div class="space-y-0.5">
                      <button v-for="sf in EVT_SYSTEM_FIELDS" :key="sf.field_type" type="button"
                        :disabled="evtSystemFieldAdded(sf)"
                        class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-transparent transition-all group text-left disabled:opacity-40 disabled:cursor-default hover:bg-blue-50/40 hover:border-blue-100"
                        @click="addEvtSystemField(sf)">
                        <i class="pi text-xs shrink-0 text-gray-300" :class="sf.icon" />
                        <div class="flex-1 min-w-0">
                          <p class="text-sm text-gray-700 truncate">{{ sf.label }}</p>
                          <p class="text-[11px] text-gray-400 truncate">{{ sf.description }}</p>
                        </div>
                        <span v-if="evtSystemFieldAdded(sf)" class="text-[10px] text-green-500 font-medium shrink-0">Added</span>
                        <i v-else class="pi pi-plus text-xs text-gray-300 group-hover:text-[#0e43a3] shrink-0" />
                      </button>
                    </div>
                  </div>
                  <!-- Search / filter existing fields -->
                  <div class="relative">
                    <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-xs" />
                    <input v-model="evtFieldSearch" type="text" placeholder="Search fields…"
                      class="w-full h-9 pl-8 pr-8 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors" />
                    <button v-if="evtFieldSearch" type="button" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500" @click="evtFieldSearch = ''"><i class="pi pi-times text-xs" /></button>
                  </div>
                  <p v-if="!Object.keys(evtExistingGroupsFiltered).length" class="text-xs text-gray-400 italic text-center py-3">
                    {{ evtFieldSearch ? `No fields match “${evtFieldSearch}”.` : 'No reusable fields for this subject yet. Add a one-off with “Field” above, or create reusable fields in Settings → Fields.' }}
                  </p>
                  <div v-for="(fields, group) in evtExistingGroupsFiltered" :key="group">
                    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 px-1">{{ group }}</p>
                    <div class="space-y-0.5">
                      <div
                        v-for="f in fields" :key="f"
                        :draggable="!isEvtFieldAdded(f)"
                        class="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-transparent transition-all group"
                        :class="isEvtFieldAdded(f)
                          ? 'opacity-40 cursor-default'
                          : requiredOrgFields.has(f)
                            ? 'bg-red-50 border-red-200 hover:bg-red-100/70 cursor-grab active:cursor-grabbing'
                            : 'hover:bg-blue-50/40 hover:border-blue-100 cursor-grab active:cursor-grabbing'"
                        @dragstart="startEvtFieldDrag($event, f)"
                        @dragend="onEvtFieldDragEnd">
                        <i class="pi pi-bars text-gray-300 text-xs" :class="{ 'opacity-0': isEvtFieldAdded(f) }" />
                        <i class="pi text-xs shrink-0" :class="[evtFieldMeta[f]?.icon ?? 'pi-minus', isEvtFieldAdded(f) ? 'text-green-400' : 'text-gray-300']" />
                        <span class="flex-1 text-sm" :class="isEvtFieldAdded(f) ? 'text-gray-500' : 'text-gray-700'">{{ f }}</span>
                        <span v-if="requiredOrgFields.has(f)" :title="'Required by ' + (requiredByOrg[f] || 'your governing body')" class="text-[9px] font-bold uppercase tracking-wide text-red-500 bg-red-100 px-1.5 py-0.5 rounded shrink-0 cursor-help">Required</span>
                        <span v-if="evtAlwaysPresentFields.includes(f)" class="text-[10px] text-gray-400">Always</span>
                        <span v-else-if="currentEvtFormFields.some(x => x.label === f)" class="text-[10px] text-green-500 font-medium">Added</span>
                        <button
                          v-else
                          type="button"
                          class="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-[#0e43a3] opacity-0 group-hover:opacity-100 transition-all rounded hover:bg-blue-50"
                          @click="addEvtFormField(f)">
                          <i class="pi pi-plus text-xs" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- BLOCK EDITOR PAGE (its own page, like the field editor) -->
                <div v-if="evtNewBlockType && evtNewBlockType !== 'field'" class="overflow-y-auto flex-1 flex flex-col">
                  <div class="flex items-center gap-3 px-4 py-4 border-b border-gray-100 shrink-0">
                    <button type="button" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500" @click="evtNewBlockType = null">
                      <i class="pi pi-chevron-left text-sm" />
                    </button>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-bold text-gray-900">Add {{ (evtBlockTypes.find(b => b.type === evtNewBlockType) || {}).label }}</p>
                      <p class="text-xs text-gray-400">{{ (evtBlockTypes.find(b => b.type === evtNewBlockType) || {}).description }}</p>
                    </div>
                  </div>
                  <div class="px-4 py-4 flex-1">

                    <!-- Section sub-form -->
                    <div v-if="evtNewBlockType === 'section'" class="space-y-2.5">
                      <input v-model="evtNewSectionDraft.label" type="text" placeholder="Section label e.g. Personal Details" class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors" />
                      <textarea v-model="evtNewSectionDraft.description" rows="2" placeholder="Optional description" class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors resize-none" />
                      <button type="button" class="w-full py-2 rounded-xl bg-[#1ab4e8] hover:bg-[#16a0d0] text-white font-semibold text-sm transition-colors disabled:opacity-40" :disabled="!evtNewSectionDraft.label.trim()" @click="saveEvtNewSection">Add Section</button>
                    </div>

                    <!-- Image sub-form -->
                    <div v-else-if="evtNewBlockType === 'image'" class="mt-3 space-y-2.5">
                      <FormsImageUploadField v-model="evtNewImageDraft.src" />
                      <input v-model="evtNewImageDraft.alt" type="text" placeholder="Alt text" class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors" />
                      <div class="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-semibold">
                        <button v-for="a in ['left','center','right']" :key="a" type="button" class="flex-1 py-1.5 transition-colors border-r border-gray-200 last:border-0 capitalize" :class="evtNewImageDraft.align === a ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'" @click="evtNewImageDraft.align = a">{{ a }}</button>
                      </div>
                      <button type="button" class="w-full py-2 rounded-xl bg-[#1ab4e8] hover:bg-[#16a0d0] text-white font-semibold text-sm transition-colors" @click="saveEvtNewBlock('image')">Add Image</button>
                    </div>

                    <!-- Text sub-form -->
                    <div v-else-if="evtNewBlockType === 'text'" class="mt-3 space-y-2.5">
                      <textarea v-model="evtNewTextDraft.content" rows="3" placeholder="Enter text content..." class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors resize-none" />
                      <div class="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-semibold">
                        <button v-for="s in [['sm','Small'],['base','Normal'],['lg','Large']]" :key="s[0]" type="button" class="flex-1 py-1.5 transition-colors border-r border-gray-200 last:border-0" :class="evtNewTextDraft.size === s[0] ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'" @click="evtNewTextDraft.size = s[0]">{{ s[1] }}</button>
                      </div>
                      <button type="button" class="w-full py-2 rounded-xl bg-[#1ab4e8] hover:bg-[#16a0d0] text-white font-semibold text-sm transition-colors disabled:opacity-40" :disabled="!evtNewTextDraft.content.trim()" @click="saveEvtNewBlock('text')">Add Text</button>
                    </div>

                    <!-- Button sub-form -->
                    <div v-else-if="evtNewBlockType === 'button'" class="mt-3 space-y-2.5">
                      <input v-model="evtNewButtonDraft.label" type="text" placeholder="Button label" class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors" />
                      <input v-model="evtNewButtonDraft.url" type="url" placeholder="https://..." class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors" />
                      <div class="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-semibold">
                        <button v-for="s in [['primary','Primary'],['secondary','Secondary'],['link','Link']]" :key="s[0]" type="button" class="flex-1 py-1.5 transition-colors border-r border-gray-200 last:border-0" :class="evtNewButtonDraft.style === s[0] ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'" @click="evtNewButtonDraft.style = s[0]">{{ s[1] }}</button>
                      </div>
                      <button type="button" class="w-full py-2 rounded-xl bg-[#1ab4e8] hover:bg-[#16a0d0] text-white font-semibold text-sm transition-colors disabled:opacity-40" :disabled="!evtNewButtonDraft.label.trim()" @click="saveEvtNewBlock('button')">Add Button</button>
                    </div>
                  </div>
                </div>
              </template>

            </template>

            <!-- TERMS section settings -->
            <template v-else-if="evtSelectedFormSection === 'terms'">
              <div class="flex items-center gap-3 px-4 py-4 border-b border-gray-100 shrink-0">
                <button type="button" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500" @click="evtSelectedFormSection = ''">
                  <i class="pi pi-chevron-left text-sm" />
                </button>
                <div class="flex-1">
                  <p class="text-sm font-bold text-gray-900">Terms &amp; Conditions</p>
                  <p class="text-xs text-gray-400">Manage consent checkboxes</p>
                </div>
              </div>
              <div class="px-4 py-3 space-y-1.5 overflow-y-auto flex-1">
                <!-- Club T&C — always required, locked -->
                <div class="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100 opacity-60 cursor-not-allowed">
                  <div class="w-5 h-5 rounded border-2 border-[#0e43a3] bg-[#0e43a3] shrink-0 flex items-center justify-center">
                    <i class="pi pi-check text-white text-[9px]" />
                  </div>
                  <span class="text-sm text-gray-700 flex-1">Club T&amp;C</span>
                  <span class="text-[10px] font-bold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-md">Required</span>
                </div>
                <!-- Required terms -->
                <div v-for="tc in availableTerms.filter(t => t.required)" :key="tc.label"
                  class="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
                  <div class="w-5 h-5 rounded border-2 border-[#0e43a3] bg-[#0e43a3] opacity-60 shrink-0 flex items-center justify-center cursor-not-allowed">
                    <i class="pi pi-check text-white text-[9px]" />
                  </div>
                  <span class="text-sm text-gray-700 flex-1">{{ tc.label }}</span>
                  <span class="text-[10px] font-bold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-md">Required</span>
                </div>
                <!-- Optional terms -->
                <div v-for="tc in availableTerms.filter(t => !t.required)" :key="tc.label"
                  class="flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-pointer"
                  :class="evtFormTermsSelections.includes(tc.label) ? 'bg-blue-50/40 border-blue-100' : 'border-gray-100 hover:bg-gray-50'"
                  @click="toggleEvtTerms(tc.label)">
                  <div class="w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition-colors"
                    :class="evtFormTermsSelections.includes(tc.label) ? 'border-[#0e43a3] bg-[#0e43a3]' : 'border-gray-300'">
                    <i v-if="evtFormTermsSelections.includes(tc.label)" class="pi pi-check text-white text-[9px]" />
                  </div>
                  <span class="text-sm text-gray-700 flex-1">{{ tc.label }}</span>
                  <button type="button" class="text-xs font-medium text-gray-400 hover:text-[#0e43a3] transition-colors px-2 py-0.5 rounded hover:bg-blue-50" @click.stop="openEvtEditTC(tc)">Edit</button>
                </div>
                <button type="button" class="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-gray-200 hover:border-[#0e43a3] hover:bg-blue-50/30 text-gray-400 hover:text-[#0e43a3] transition-all mt-1" @click="showEvtTCModal = true">
                  <i class="pi pi-plus text-xs" />
                  <span class="text-sm font-medium">Add new T&amp;C</span>
                </button>
              </div>
              <div class="px-4 pb-4 pt-3 border-t border-gray-100 shrink-0">
                <button type="button" class="w-full py-2.5 rounded-xl bg-[#1ab4e8] hover:bg-[#16a0d0] text-white font-semibold text-sm transition-colors" @click="saveEvtFormSection('terms')">Save</button>
              </div>
            </template>

            <!-- PAYMENT section settings -->
            <template v-else-if="evtSelectedFormSection === 'payment'">
              <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
                <button type="button" class="flex items-center gap-2 text-sm font-semibold text-gray-800 hover:text-[#0e43a3] transition-colors" @click="evtSelectedFormSection = ''">
                  <i class="pi pi-chevron-left text-sm" />
                  Payment Options
                </button>
                <button type="button" class="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
                  <i class="pi pi-cog text-sm" />
                </button>
              </div>
              <div class="overflow-y-auto flex-1 px-4 py-3 space-y-3">

                <!-- Invoice -->
                <div class="border border-gray-200 rounded-xl p-3 space-y-3">
                  <div class="flex items-start gap-2">
                    <i class="pi pi-credit-card text-gray-400 text-sm shrink-0 mt-0.5" />
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-700">Enable pay by <strong>Invoice</strong></p>
                      <span class="text-[10px] font-semibold bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">Default</span>
                    </div>
                    <ToggleSwitch v-model="evtFormPayment.invoice.enabled" class="shrink-0" />
                  </div>
                  <template v-if="evtFormPayment.invoice.enabled">
                    <div class="space-y-1.5">
                      <label class="text-xs text-gray-500">Choose bank account</label>
                      <select class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] bg-white">
                        <option value="">Choose</option>
                        <option value="main">Club Main Account</option>
                      </select>
                    </div>
                    <div v-if="evtFormPayment.invoice.bank_account" class="text-xs text-gray-600 space-y-0.5 bg-gray-50 rounded-lg px-3 py-2">
                      <p><span class="text-gray-400">Bank Account:</span> 01-2015-454848485-551</p>
                      <p><span class="text-gray-400">Bank Name:</span> Club Name</p>
                    </div>
                  </template>
                </div>

                <!-- Credit Card -->
                <div class="border border-gray-200 rounded-xl p-3 space-y-3">
                  <div class="flex items-start gap-2">
                    <i class="pi pi-credit-card text-gray-400 text-sm shrink-0 mt-0.5" />
                    <span class="flex-1 text-sm font-medium text-gray-700">Enable pay by <strong>Credit Card</strong></span>
                    <ToggleSwitch v-model="evtFormPayment.credit_card.enabled" class="shrink-0" />
                  </div>
                </div>

                <!-- Payment Plan -->
                <div class="border border-gray-200 rounded-xl p-3 space-y-3">
                  <div class="flex items-center gap-2">
                    <i class="pi pi-calendar text-gray-400 text-sm shrink-0" />
                    <span class="flex-1 text-sm font-medium text-gray-700">Enable pay by <strong>Payment Plan</strong></span>
                    <ToggleSwitch v-model="evtFormPayment.plan.enabled" />
                  </div>
                  <template v-if="evtFormPayment.plan.enabled">
                    <div class="space-y-2">
                      <p class="text-xs text-gray-500">Select all payment frequency options available to participants</p>
                      <div class="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-medium">
                        <button type="button" class="flex-1 py-1.5 transition-colors" :class="evtFormPayment.plan.frequencies.includes('weekly') ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'" @click="toggleEvtPlanFrequency('weekly')">Weekly</button>
                        <button type="button" class="flex-1 py-1.5 border-x border-gray-200 transition-colors" :class="evtFormPayment.plan.frequencies.includes('fortnightly') ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'" @click="toggleEvtPlanFrequency('fortnightly')">Fortnightly</button>
                        <button type="button" class="flex-1 py-1.5 transition-colors" :class="evtFormPayment.plan.frequencies.includes('monthly') ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'" @click="toggleEvtPlanFrequency('monthly')">Monthly</button>
                      </div>
                    </div>
                    <div class="space-y-1.5">
                      <p class="text-xs text-gray-500">When do payments need to be paid by?</p>
                      <input v-model="evtFormPayment.plan.due_date" type="date" placeholder="Choose last date" class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3]" />
                    </div>
                    <div class="space-y-1.5">
                      <p class="text-xs text-gray-500">What is the first payment amount?</p>
                      <div class="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-medium">
                        <button type="button" class="flex-1 py-1.5 transition-colors" :class="evtFormPayment.plan.first_amount === 'scheduled' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'" @click="evtFormPayment.plan.first_amount = 'scheduled'">Equal payments</button>
                        <button type="button" class="flex-1 py-1.5 border-l border-gray-200 transition-colors" :class="evtFormPayment.plan.first_amount === 'custom' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'" @click="evtFormPayment.plan.first_amount = 'custom'">Custom</button>
                      </div>
                    </div>
                  </template>
                </div>

                <!-- Payment Plan Schedule (shown when plan enabled) -->
                <div v-if="evtFormPayment.plan.enabled" class="border border-gray-200 rounded-xl p-3 space-y-3">
                  <p class="text-xs font-semibold text-gray-700">Payment Plan Schedule</p>
                  <div class="space-y-1.5">
                    <p class="text-xs text-gray-500">What is the minimum amount people must pay?</p>
                    <div class="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-medium">
                      <button type="button" class="flex-1 py-1.5 transition-colors" :class="evtFormPayment.plan.schedule_min === 'scheduled' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'" @click="evtFormPayment.plan.schedule_min = 'scheduled'">Equal payments</button>
                      <button type="button" class="flex-1 py-1.5 border-l border-gray-200 transition-colors" :class="evtFormPayment.plan.schedule_min === 'custom' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'" @click="evtFormPayment.plan.schedule_min = 'custom'">Custom</button>
                    </div>
                  </div>
                  <div v-if="evtFormPayment.plan.schedule_min === 'custom'" class="flex items-center gap-2">
                    <div class="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-medium">
                      <button type="button" class="px-3 py-1.5 bg-primary text-white">Scheduled</button>
                      <button type="button" class="px-3 py-1.5 border-l border-gray-200 text-gray-600 hover:bg-gray-50">Custom</button>
                    </div>
                    <div class="flex items-center h-9 border border-gray-200 rounded-lg px-2 gap-1">
                      <span class="text-gray-400 text-xs">$</span>
                      <input v-model="evtFormPayment.plan.schedule_min_value" type="text" inputmode="decimal" placeholder="0.00" class="w-16 text-sm text-right outline-none bg-transparent" />
                    </div>
                  </div>
                </div>

                <!-- Coupon -->
                <div class="border border-gray-200 rounded-xl p-3 space-y-3">
                  <div class="flex items-center gap-2">
                    <i class="pi pi-tag text-gray-400 text-sm shrink-0" />
                    <span class="flex-1 text-sm font-medium text-gray-700">Enable pay by <strong>Coupon</strong></span>
                    <ToggleSwitch v-model="evtFormPayment.coupon.enabled" />
                  </div>
                  <template v-if="evtFormPayment.coupon.enabled">
                    <div class="space-y-1.5">
                      <p class="text-xs text-gray-500">How many coupons are required to purchase this event</p>
                      <select v-model="evtFormPayment.coupon.quantity" class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] bg-white">
                        <option v-for="n in 10" :key="n" :value="n">{{ n }}</option>
                      </select>
                    </div>
                  </template>
                </div>

              </div>
              <div class="px-5 pb-5 pt-3 border-t border-gray-100 shrink-0">
                <button type="button" class="w-full py-2.5 rounded-lg bg-[#1ab4e8] hover:bg-[#16a0d0] text-white font-semibold text-sm transition-colors" @click="saveEvtFormSection('payment')">Save</button>
              </div>
            </template>

            <!-- SESSIONS section settings -->
            <template v-else-if="evtSelectedFormSection === 'sessions'">
              <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
                <button type="button" class="flex items-center gap-2 text-sm font-semibold text-gray-800 hover:text-[#0e43a3] transition-colors" @click="evtSelectedFormSection = evtFieldTarget ? 'settings' : ''">
                  <i class="pi pi-chevron-left text-sm" />
                  {{ evtChooserSubjects.find(c => c.key === evtSessionConfigSubject)?.label || 'Sessions' }} — options
                </button>
                <div class="flex items-center gap-2">
                  <button type="button" class="text-xs text-[#0e43a3] hover:underline transition-colors" @click="evtSetAllSessions('select')">Reset</button>
                  <span class="text-gray-300">·</span>
                  <button type="button" class="text-xs text-gray-400 hover:text-gray-600 hover:underline transition-colors" @click="evtSetAllSessions('hidden')">Hide all</button>
                </div>
              </div>
              <div class="overflow-y-auto flex-1 px-4 py-4 space-y-3">
                <!-- Layout selector -->
                <div class="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
                  <p class="text-xs font-semibold text-gray-600">Session layout</p>
                  <div class="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
                    <button type="button"
                      class="flex-1 px-2 py-1.5 flex items-center justify-center gap-1.5 transition-colors"
                      :class="(currentEvtFormDesign.sessionsLayout ?? 'list') === 'list' ? 'bg-[#0e43a3] text-white' : 'text-gray-500 hover:bg-gray-50'"
                      @click="currentEvtFormDesign.sessionsLayout = 'list'">
                      <i class="pi pi-list text-[10px]" />List
                    </button>
                    <button type="button"
                      class="flex-1 px-2 py-1.5 flex items-center justify-center gap-1.5 border-l border-gray-200 transition-colors"
                      :class="currentEvtFormDesign.sessionsLayout === 'date-table' ? 'bg-[#0e43a3] text-white' : 'text-gray-500 hover:bg-gray-50'"
                      @click="currentEvtFormDesign.sessionsLayout = 'date-table'">
                      <i class="pi pi-table text-[10px]" />Date Table
                    </button>
                    <button type="button"
                      class="flex-1 px-2 py-1.5 flex items-center justify-center gap-1.5 border-l border-gray-200 transition-colors"
                      :class="currentEvtFormDesign.sessionsLayout === 'group-picker' ? 'bg-[#0e43a3] text-white' : 'text-gray-500 hover:bg-gray-50'"
                      @click="currentEvtFormDesign.sessionsLayout = 'group-picker'">
                      <i class="pi pi-sitemap text-[10px]" />Groups
                    </button>
                  </div>
                  <p v-if="currentEvtFormDesign.sessionsLayout === 'date-table'" class="text-[11px] text-gray-400">Sessions grouped by date (rows) and session type (columns). Best for multi-day programmes.</p>
                  <template v-if="currentEvtFormDesign.sessionsLayout === 'group-picker'">
                    <p class="text-[11px] text-gray-400">Sessions shown as a group picker with a term/category dropdown. Best for club memberships and term-based registrations.</p>
                    <div class="space-y-1">
                      <label class="text-[11px] font-semibold text-gray-500">Term / period label</label>
                      <input v-model="currentEvtFormDesign.sessionsGroupLabel" type="text" placeholder="e.g. Rec Term 2 2026"
                        class="w-full h-8 px-2.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] bg-white" />
                    </div>
                  </template>
                </div>
                <p class="text-xs text-gray-500">Control how each session appears on this form.</p>
                <!-- Per-subject scope: each chooser configures its own options -->
                <div v-if="evtChooserSubjects.length > 1" class="space-y-1.5">
                  <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Options for</p>
                  <div class="flex flex-wrap gap-1.5">
                    <button v-for="cs in evtChooserSubjects" :key="cs.key" type="button"
                      class="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors flex items-center gap-1"
                      :class="evtSessionConfigSubject === cs.key ? 'border-[#0e43a3] bg-blue-50 text-[#0e43a3]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'"
                      @click="evtSessionConfigSubject = cs.key">
                      <i :class="['pi', (cs.kind ?? '') === 'entity' ? 'pi-building' : 'pi-user', 'text-[9px]']" />{{ cs.label }}
                    </button>
                  </div>
                </div>
                <div v-if="formPanelSessionsWithHeaders.length" class="border border-gray-200 rounded-xl overflow-hidden">
                  <template v-for="item in formPanelSessionsWithHeaders" :key="item.type === 'session' ? ((item as any).session.id ?? (item as any).session._savedId) : (item as any).label">
                    <!-- Date header -->
                    <div v-if="item.type === 'header'" class="px-3 py-1.5 bg-gray-50 border-b border-gray-100">
                      <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{{ (item as any).label }}</span>
                    </div>
                    <!-- Session row -->
                    <div v-else
                      class="flex items-center gap-3 px-3 py-2.5 border-b border-gray-100 last:border-b-0 transition-colors"
                      :class="getSessionMode((item as any).session.id ?? (item as any).session._savedId, evtSessionConfigSubject) === 'hidden' ? 'bg-white opacity-50' : 'bg-white'">
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-gray-800 truncate">{{ (item as any).session.title || 'Untitled Session' }}</p>
                      </div>
                      <div class="flex rounded-lg border border-gray-200 overflow-hidden text-[11px] font-semibold shrink-0">
                        <button type="button"
                          class="px-2 py-1.5 transition-colors flex items-center gap-1"
                          :class="getSessionMode((item as any).session.id ?? (item as any).session._savedId, evtSessionConfigSubject) === 'select' ? 'bg-[#0e43a3] text-white' : 'text-gray-500 hover:bg-gray-50'"
                          @click="setSessionMode((item as any).session.id ?? (item as any).session._savedId, 'select', evtSessionConfigSubject)">
                          <i class="pi pi-check-square text-[10px]" />Select
                        </button>
                        <button type="button"
                          class="px-2 py-1.5 border-l border-gray-200 transition-colors flex items-center gap-1"
                          :class="getSessionMode((item as any).session.id ?? (item as any).session._savedId, evtSessionConfigSubject) === 'info' ? 'bg-amber-500 text-white' : 'text-gray-500 hover:bg-gray-50'"
                          @click="setSessionMode((item as any).session.id ?? (item as any).session._savedId, 'info', evtSessionConfigSubject)">
                          <i class="pi pi-info-circle text-[10px]" />Info
                        </button>
                        <button type="button"
                          class="px-2 py-1.5 border-l border-gray-200 transition-colors flex items-center gap-1"
                          :class="getSessionMode((item as any).session.id ?? (item as any).session._savedId, evtSessionConfigSubject) === 'hidden' ? 'bg-gray-500 text-white' : 'text-gray-500 hover:bg-gray-50'"
                          @click="setSessionMode((item as any).session.id ?? (item as any).session._savedId, 'hidden', evtSessionConfigSubject)">
                          <i class="pi pi-eye-slash text-[10px]" />Hide
                        </button>
                      </div>
                    </div>
                  </template>
                </div>
                <p v-else class="text-xs text-gray-400 text-center py-4">No sessions available for this form type</p>
              </div>
              <div class="px-5 pb-5 pt-3 border-t border-gray-100 shrink-0">
                <button type="button" class="w-full py-2.5 rounded-lg bg-[#1ab4e8] hover:bg-[#16a0d0] text-white font-semibold text-sm transition-colors" @click="saveEvtFormSection('sessions')">Save</button>
              </div>
            </template>

          </template>

        </div>

        <!-- Add form dialog -->
        <Dialog v-model:visible="showAddFormDialog" modal header="New Form" :style="{ width: '400px' }">
          <div class="space-y-4 py-2">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Form name</label>
              <InputText v-model="newFormName" class="w-full" placeholder="e.g. Member Registration" autofocus
                @keydown.enter="confirmAddEvtFormGroup" @keydown.esc="showAddFormDialog = false" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Who is this form for?</label>
              <div class="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
                <button v-for="opt in [{ value: 'all', label: 'Everyone' }, { value: 'members', label: 'Members only' }, { value: 'public', label: 'Public only' }]"
                  :key="opt.value" type="button"
                  class="flex-1 px-3 py-2 transition-colors border-r border-gray-200 last:border-r-0"
                  :class="newFormAudience === opt.value ? 'bg-primary text-white font-medium' : 'text-gray-500 bg-white hover:bg-gray-50'"
                  @click="newFormAudience = opt.value as any">
                  {{ opt.label }}
                </button>
              </div>
            </div>
          </div>
          <template #footer>
            <Button label="Cancel" severity="secondary" text @click="showAddFormDialog = false" />
            <Button label="Create Form" icon="pi pi-plus" @click="confirmAddEvtFormGroup" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
          </template>
        </Dialog>

        <!-- Delete form confirm dialog -->
        <Dialog :visible="formToDelete !== null" @update:visible="v => { if (!v) formToDelete = null }" modal header="Delete Form" :style="{ width: '360px' }">
          <p class="text-sm text-gray-600 py-2">Delete <strong>{{ evtFormGroupsList.find(g => g.id === formToDelete)?.name }}</strong>? This cannot be undone.</p>
          <template #footer>
            <Button label="Cancel" severity="secondary" text @click="formToDelete = null" />
            <Button label="Delete" icon="pi pi-trash" severity="danger" @click="formToDelete && removeEvtFormGroup(formToDelete)" />
          </template>
        </Dialog>

        <!-- Communication preferences popup: topics (rows) × people (columns) matrix -->
        <Dialog v-model:visible="evtCommsDialogOpen" modal header="Communication preferences" :style="{ width: '560px' }">
          <p class="text-sm text-gray-500 -mt-1 mb-3">Choose how each person receives each update — by email (<i class="pi pi-envelope text-[10px]" />) and/or app (<i class="pi pi-mobile text-[10px]" />).</p>
          <p v-if="!evtCommsTopics.length" class="text-sm text-gray-400 py-2">No communication topics yet — add them in Settings → Communications.</p>
          <p v-else-if="!evtCommsRecipientOptions.length" class="text-sm text-gray-400 py-2">Add a person to the form to choose communications.</p>
          <template v-else>
            <div class="flex justify-end mb-2">
              <button type="button"
                class="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:border-primary hover:text-primary transition-colors"
                @click="evtToggleAllComms">
                <i :class="['pi', evtCommsAllOn ? 'pi-times' : 'pi-check', 'text-[10px]']" />{{ evtCommsAllOn ? 'Clear all' : 'Select all' }}
              </button>
            </div>
            <div class="rounded-xl border border-gray-200 overflow-hidden">
              <table class="w-full text-sm border-collapse table-fixed">
                <thead>
                  <tr class="bg-gray-50 border-b border-gray-100">
                    <th class="text-left font-semibold text-gray-400 text-[11px] uppercase tracking-wide px-4 py-2.5">Updates</th>
                    <th v-for="p in evtCommsRecipientOptions" :key="p.id" class="px-3 py-2.5">
                      <button type="button" v-tooltip.top="evtCommsColOn(p.id) ? 'Turn all off for this person' : 'Turn all on for this person'"
                        class="font-semibold text-gray-600 text-xs text-center truncate max-w-full hover:text-primary hover:underline mx-auto block"
                        @click="evtToggleCommsCol(p.id)">{{ p.label }}</button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="t in evtCommsTopics" :key="t.id" class="border-b border-gray-50 last:border-0">
                    <td class="px-4 py-3">
                      <button type="button" v-tooltip.top="evtCommsRowOn(t) ? 'Turn this update off for everyone' : 'Turn this update on for everyone'"
                        class="text-gray-700 font-medium text-left truncate max-w-full hover:text-primary hover:underline"
                        @click="evtToggleCommsRow(t)">{{ t.name }}</button>
                    </td>
                    <td v-for="p in evtCommsRecipientOptions" :key="p.id" class="px-3 py-3">
                      <div class="flex items-center justify-center gap-1.5">
                        <template v-for="ch in EVT_COMMS_CHANNELS" :key="ch">
                          <button v-if="t.channels.includes(ch)" type="button"
                            v-tooltip.top="ch === 'email' ? 'Email' : 'App notification'"
                            class="w-7 h-7 rounded-lg border inline-flex items-center justify-center transition-colors"
                            :class="evtCommsSub(p.id, t.id, ch) ? 'bg-primary border-primary text-white' : 'border-gray-200 text-gray-300 hover:border-primary/50'"
                            @click="evtToggleCommsSub(p.id, t.id, ch)">
                            <i :class="['pi', ch === 'email' ? 'pi-envelope' : 'pi-mobile', 'text-[11px]']" />
                          </button>
                          <span v-else class="w-7 h-7 inline-block" />
                        </template>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
          <template #footer>
            <Button label="Done" @click="evtCommsDialogOpen = false" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
          </template>
        </Dialog>

        <!-- Right panel -->
        <div class="relative flex-1 overflow-hidden bg-[#EBEFFA]"
          :style="currentEvtFormDesign.background === 'custom' && currentEvtFormDesign.backgroundImage
            ? `background-image:url('${currentEvtFormDesign.backgroundImage}');background-size:cover;background-position:center;background-repeat:no-repeat`
            : currentEvtFormDesign.background === 'colour'
              ? `background:${currentEvtFormDesign.backgroundColor}`
              : ''">

          <!-- Background fade overlay (pinned — does not scroll) -->
          <div
            v-if="currentEvtFormDesign.background === 'custom' && currentEvtFormDesign.backgroundImage && currentEvtFormDesign.backgroundOverlay > 0"
            class="absolute inset-0 pointer-events-none z-0"
            :style="`background: linear-gradient(to top, rgba(235,239,250,${currentEvtFormDesign.backgroundOverlay}) 0%, transparent 100%)`" />

          <!-- Scrollable content wrapper -->
          <div class="absolute inset-0 overflow-y-auto z-10">


          <!-- Choose a registration type — the first step (also shown when no forms exist) -->
          <div v-if="!evtFormGroups.length || !evtFormGroupModes[selectedFormGroupId]" class="flex items-center justify-center py-16 px-6">
            <div class="bg-white rounded-xl shadow-lg overflow-hidden w-full max-w-[580px]">
              <div class="bg-[#182e59] px-6 py-4 text-center">
                <h2 class="text-[17px] font-semibold text-white leading-snug">Choose a registration type</h2>
              </div>
              <!-- Step 1: pick the kind of form -->
              <div v-if="evtChooserStep === 'type'" class="p-5 space-y-2.5">
                <button type="button" class="w-full flex items-start gap-3 border border-gray-200 rounded-lg px-4 py-3 text-left hover:border-[#182e59] hover:bg-blue-50/30 transition-colors group" @click="chooseEvtFormType('simple')">
                  <div class="shrink-0 w-9 h-9 rounded-lg bg-gray-50 group-hover:bg-blue-50 flex items-center justify-center text-gray-400 group-hover:text-[#182e59]"><i class="pi pi-file-edit text-lg" /></div>
                  <div><p class="text-sm font-bold text-gray-800">Basic</p><p class="text-xs text-gray-500 mt-0.5">A simple Yes / No registration — no extra fields.</p></div>
                </button>
                <button type="button" class="w-full flex items-start gap-3 border border-gray-200 rounded-lg px-4 py-3 text-left hover:border-[#182e59] hover:bg-blue-50/30 transition-colors group" @click="evtChooserStep = 'template'">
                  <div class="shrink-0 w-9 h-9 rounded-lg bg-gray-50 group-hover:bg-blue-50 flex items-center justify-center text-gray-400 group-hover:text-[#182e59]"><i class="pi pi-plus-circle text-lg" /></div>
                  <div class="flex-1 min-w-0"><p class="text-sm font-bold text-gray-800">Start from scratch</p><p class="text-xs text-gray-500 mt-0.5">Pick who's registering from a template, then customise.</p></div>
                  <i class="pi pi-chevron-right text-gray-300 text-xs mt-1 shrink-0" />
                </button>
                <button type="button" class="w-full flex items-start gap-3 border border-gray-200 rounded-lg px-4 py-3 text-left hover:border-[#182e59] hover:bg-blue-50/30 transition-colors group" @click="chooseEvtFormType('scratch')">
                  <div class="shrink-0 w-9 h-9 rounded-lg bg-gray-50 group-hover:bg-blue-50 flex items-center justify-center text-gray-400 group-hover:text-[#182e59]"><i class="pi pi-history text-lg" /></div>
                  <div><p class="text-sm font-bold text-gray-800">Start from a previous form</p><p class="text-xs text-gray-500 mt-0.5">Reuse a registration form you've built before.</p></div>
                </button>
                <button type="button" class="w-full flex items-start gap-3 border border-gray-200 rounded-lg px-4 py-3 text-left hover:border-red-200 hover:bg-red-50/30 transition-colors group" @click="chooseEvtFormType('none')">
                  <div class="shrink-0 w-9 h-9 rounded-lg bg-gray-50 group-hover:bg-red-50 flex items-center justify-center text-gray-400 group-hover:text-red-400"><i class="pi pi-ban text-lg" /></div>
                  <div><p class="text-sm font-bold text-gray-800">No registration</p><p class="text-xs text-gray-500 mt-0.5">Disable registrations for this group.</p></div>
                </button>
              </div>

              <!-- Step 2: choose a template (who's registering) -->
              <div v-else class="p-5 space-y-2.5 max-h-[68vh] overflow-y-auto">
                <button type="button" class="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-[#182e59] transition-colors mb-1" @click="evtChooserStep = 'type'">
                  <i class="pi pi-chevron-left text-[10px]" />Back
                </button>
                <p class="text-[11px] font-bold text-gray-400 uppercase tracking-wide px-1">Choose a template</p>
                <p class="text-xs text-gray-400 px-1 -mt-1">Pick a starting point — every setting is fully configurable afterwards.</p>

                <!-- Blank -->
                <button type="button" class="w-full flex items-start gap-3 border border-gray-200 rounded-lg px-4 py-3 text-left hover:border-[#182e59] hover:bg-blue-50/30 transition-colors group"
                  @click="chooseEvtFormPreset('')">
                  <div class="shrink-0 w-9 h-9 rounded-lg bg-gray-50 group-hover:bg-blue-50 flex items-center justify-center text-gray-400 group-hover:text-[#182e59]"><i class="pi pi-file text-lg" /></div>
                  <div class="min-w-0">
                    <p class="text-sm font-bold text-gray-800">Blank</p>
                    <p class="text-xs text-gray-500 mt-0.5">Start with a single person and build the form yourself.</p>
                  </div>
                </button>

                <!-- Registration type templates -->
                <button v-for="p in evtProfilePresets" :key="p.id" type="button"
                  class="w-full flex items-start gap-3 border border-gray-200 rounded-lg px-4 py-3 text-left hover:border-[#182e59] hover:bg-blue-50/30 transition-colors group"
                  @click="chooseEvtFormPreset(p.id)">
                  <div class="shrink-0 w-9 h-9 rounded-lg bg-gray-50 group-hover:bg-blue-50 flex items-center justify-center text-gray-400 group-hover:text-[#182e59]"><i :class="['pi', p.icon, 'text-lg']" /></div>
                  <div class="min-w-0">
                    <p class="text-sm font-bold text-gray-800">{{ p.label }}</p>
                    <p class="text-xs text-gray-500 mt-0.5">{{ p.description }}</p>
                    <p class="text-[11px] text-gray-400 mt-0.5">Includes {{ evtPresetRoleSummary(p.id) }}</p>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <!-- No registrations state -->
          <div v-else-if="evtFormGroupModes[selectedFormGroupId] === 'none'" class="flex items-center justify-center py-16 px-6">
            <div class="bg-white rounded-xl shadow-lg p-8 text-center w-full max-w-sm">
              <i class="pi pi-ban text-5xl text-gray-200 mb-5" />
              <p class="text-base font-semibold text-gray-700">No {{ currentEvtFormGroupName }}</p>
              <p class="text-sm text-gray-400 mt-2">Registrations are disabled for this group.</p>
              <button type="button" class="mt-5 text-sm text-[#0e43a3] hover:underline transition-colors" @click="changeEvtFormType()">Change form type</button>
            </div>
          </div>

          <!-- Rich form preview (simple + scratch) -->
          <div v-else class="relative z-10 mx-auto my-6 bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300"
            :class="evtPreviewDevice === 'mobile' ? 'max-w-[390px]' : 'max-w-[1000px]'">

            <!-- Banner + title: always at the top of every step -->
            <FormPreviewBanner :design="currentEvtFormDesign" :event="event" />
            <!-- Full event details (icons + description): always, except in mobile Steps where they're only the first (details) step -->
            <template v-if="!evtMobileSteps || evtOnDetailsStep">
              <FormPreviewInfoIcons :design="currentEvtFormDesign" :event="event" :mobile="evtPreviewDevice === 'mobile'" />
              <FormPreviewDescription :design="currentEvtFormDesign" :event="event" :readonly="evtPublicPreview" />
            </template>

            <!-- Ticket picker (shown when event has tickets enabled) -->
            <div v-if="hasTickets && ticketTypes.length" class="px-6 pt-6 pb-2">
              <h3 class="text-sm font-bold text-gray-800 mb-3">Select Tickets</h3>
              <div class="space-y-2">
                <div v-for="tt in ticketTypes.filter(t => t.is_active && !t.session_id)" :key="tt.id"
                  class="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
                  <div>
                    <p class="text-sm font-semibold text-gray-800">{{ tt.name }}</p>
                    <p v-if="tt.description" class="text-xs text-gray-500 mt-0.5">{{ tt.description }}</p>
                  </div>
                  <div class="flex items-center gap-3 shrink-0">
                    <span class="text-sm font-semibold text-gray-700">{{ tt.price === 0 ? 'Free' : `$${tt.price.toFixed(2)}` }}</span>
                    <div class="flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden bg-white">
                      <button class="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-gray-50 text-lg leading-none">−</button>
                      <span class="w-8 text-center text-sm font-semibold text-gray-800">0</span>
                      <button class="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-gray-50 text-lg leading-none">+</button>
                    </div>
                  </div>
                </div>
                <div v-if="!ticketTypes.filter(t => t.is_active && !t.session_id).length" class="text-xs text-gray-400 italic py-2">
                  No event-level ticket types active yet.
                </div>
              </div>
              <!-- Ticket subtotal -->
              <div class="mt-3 flex justify-end text-sm font-semibold text-gray-700">
                Tickets: <span class="ml-2 text-primary">$0.00</span>
              </div>
            </div>

            <!-- Form fields: accordion preview (scratch mode only) -->
            <div v-if="evtFormGroupModes[selectedFormGroupId] === 'scratch'" :class="{ 'evt-public-preview': evtPublicPreview }">

              <!-- Heading (hidden on the mobile details step — the event details fill it) -->
              <div v-if="!evtOnDetailsStep" class="px-6 pt-8 pb-3">
                <h3 class="text-xl font-bold text-gray-800">{{ currentEvtFormDesign.formHeading || 'Fill in the form to register' }}</h3>
              </div>

              <!-- Wizard step indicator (Form Style = Steps) — hidden on the mobile details step -->
              <div v-if="evtIsWizard && !evtOnDetailsStep" class="px-6 pb-4">
                <!-- Mobile: equal-width previous / current / next pills (no numbers) -->
                <div v-if="evtMobileSteps" class="flex items-stretch gap-1.5">
                  <button v-for="p in evtMobilePills" :key="p.key" type="button"
                    class="flex-1 min-w-0 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-colors"
                    :class="p.pos === 'current' ? 'bg-primary text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'"
                    @click="evtWizardStep = p.idx">
                    <i v-if="p.pos === 'prev'" class="pi pi-angle-left text-[10px] shrink-0 opacity-70" />
                    <span class="truncate">{{ p.label }}</span>
                    <i v-if="p.pos === 'next'" class="pi pi-angle-right text-[10px] shrink-0 opacity-70" />
                  </button>
                </div>
                <!-- Desktop: full pill list with numbers -->
                <div v-else class="flex items-center gap-1 flex-wrap">
                  <template v-for="(st, idx) in evtWizardSteps" :key="st.key">
                    <button type="button"
                      class="flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors"
                      :class="idx === evtWizardStep ? 'bg-primary text-white' : idx < evtWizardStep ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400'"
                      @click="evtWizardStep = idx">
                      <span class="w-4 h-4 rounded-full flex items-center justify-center text-[9px] shrink-0"
                        :class="idx === evtWizardStep ? 'bg-white/25' : idx < evtWizardStep ? 'bg-primary/15' : 'bg-white'">
                        <i v-if="idx < evtWizardStep" class="pi pi-check text-[7px]" /><template v-else>{{ idx + 1 }}</template>
                      </span>
                      {{ st.label }}
                    </button>
                    <i v-if="idx < evtWizardSteps.length - 1" class="pi pi-angle-right text-gray-300 text-[10px]" />
                  </template>
                </div>
              </div>

              <!-- Details step (mobile + Steps): a "register" CTA that jumps to the first subject -->
              <div v-if="evtOnDetailsStep" class="px-6 pt-2 pb-8">
                <button type="button"
                  class="w-full py-3 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-[#161a45] transition-colors flex items-center justify-center gap-2"
                  @click="evtWizardNext()">
                  Click here to register<i class="pi pi-angle-right text-xs" />
                </button>
              </div>

              <!-- Person accordions (hidden on the details step) -->
              <div v-show="!evtOnDetailsStep" class="px-6 space-y-5">

                <!-- One group per subject type; each renders N instances (defaulting to the
                     subject's min, e.g. 12 Players) with per-subject add/remove.
                     In Steps mode, only the current step's subject group is shown. -->
                <div v-for="(subject, sIdx) in evtPreviewSubjects" :key="subject.key"
                  v-show="!evtIsWizard || evtWizardStep === sIdx + evtSubjectStepOffset"
                  class="space-y-3">

                  <!-- Inline-editable step heading (separate from the display name; defaults to
                       "{singular} register") + optional intro text. (Subjects are removed from the
                       left "Who is registering" list, not here.) -->
                  <div v-if="currentEvtFormProfiles.length" class="space-y-1.5">
                    <!-- Public preview: static heading + description -->
                    <template v-if="evtPublicPreview">
                      <h2 class="text-lg font-bold text-gray-800 py-0.5">{{ evtSubjectHeading(subject) }}</h2>
                      <div v-if="evtSubjectIntro(subject.key)" class="prose prose-sm max-w-none text-gray-600" v-html="evtSubjectIntro(subject.key)" />
                    </template>
                    <!-- Builder: inline-editable heading + description -->
                    <template v-else>
                      <input :value="evtSubjectHeading(subject)" maxlength="60" :placeholder="evtSubjectHeadingDefault(subject)"
                        class="w-full text-lg font-bold text-gray-800 bg-transparent border-0 border-b border-transparent hover:border-gray-200 focus:border-[#0e43a3] outline-none px-0 py-0.5 transition-colors"
                        @input="evtSubjectHeadingInput(subject.key, $event)" @click.stop />
                      <div @click.stop>
                        <RichTextEditor :modelValue="evtSubjectIntro(subject.key)" bubble
                          placeholder="Add an optional description for this section…"
                          @update:modelValue="v => evtSetSubjectIntro(subject.key, v)" />
                      </div>
                    </template>
                  </div>

                  <div v-for="inst in evtSubjectCount(subject.key)" :key="subject.key + '#' + inst"
                    class="rounded-xl border transition-all"
                    :class="subject.key === evtFieldTarget ? 'border-[#0e43a3]/40 ring-1 ring-[#0e43a3]/20' : 'border-gray-150'"
                    @click="evtFieldTarget = subject.key"
                    @dragover.prevent="dropZoneActive = true; evtDropTarget = subject.key"
                    @dragleave="dropZoneActive = false"
                    @drop="onDropField">

                      <!-- Subject header — collapse toggle for multi-instance subjects (e.g. 12 Players).
                           Hidden for single-instance subjects (e.g. Team) where it just duplicates the
                           section heading; the builder keeps a slim "Edit form" bar. -->
                      <div v-if="evtSubjectCount(subject.key) > 1 || !evtPublicPreview"
                        class="flex items-center gap-2 px-4 pt-3.5 pb-2 select-none rounded-t-xl transition-colors"
                        :class="evtSubjectCount(subject.key) > 1 ? 'cursor-pointer hover:bg-gray-50/60' : ''"
                        @click.stop="evtSubjectCount(subject.key) > 1 && evtToggleInstance(subject.key, inst)">
                        <template v-if="evtSubjectCount(subject.key) > 1">
                          <i class="pi pi-chevron-right text-[10px] text-gray-400 transition-transform shrink-0" :class="evtInstanceOpen(subject.key, inst) ? 'rotate-90' : ''" />
                          <span class="shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
                            :class="(subject.kind ?? '') === 'entity' ? 'bg-violet-50 text-violet-600' : 'bg-blue-50 text-[#0e43a3]'">
                            <i :class="['pi', (subject.kind ?? '') === 'entity' ? 'pi-building' : 'pi-user', 'text-[11px]']" />
                          </span>
                          <span class="flex-1 min-w-0 truncate text-sm font-semibold"
                            :class="evtInstanceName(subject.key, inst) ? 'text-gray-800' : 'text-gray-400'">{{ evtInstanceTitle(subject, inst) }}</span>
                        </template>
                        <span v-else class="flex-1" />
                        <button v-if="!evtPublicPreview" type="button" class="text-[11px] font-semibold text-[#0e43a3] hover:underline" @click.stop="openEvtSubject(subject.key)">Edit form</button>
                        <button v-if="evtSubjectCount(subject.key) > evtSubjectMin(subject)"
                          type="button" class="text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors w-6 h-6 flex items-center justify-center rounded-lg"
                          v-tooltip.top="'Remove this ' + subject.label" @click.stop="evtRemoveSubjectInstance(subject, inst)">
                          <i class="pi pi-times text-[11px]" />
                        </button>
                      </div>

                      <div v-show="evtSubjectCount(subject.key) === 1 || evtInstanceOpen(subject.key, inst)"
                        class="px-4 pb-4 space-y-3"
                        :class="(evtSubjectCount(subject.key) === 1 && evtPublicPreview) ? 'pt-4' : ''">
                        <!-- Pinned First/Last Name — always first, never draggable (people only) -->
                        <div v-if="evtPinnedFields(subject.key).length" class="grid gap-3" :class="evtPreviewDevice === 'mobile' ? 'grid-cols-1' : 'grid-cols-2'">
                          <div v-for="field in evtPinnedFields(subject.key)" :key="field.id"
                            class="space-y-1 group rounded-lg px-2 -mx-2 transition-all"
                            :class="evtPublicPreview ? '' : 'cursor-pointer hover:ring-2 hover:ring-[#0e43a3]/20 hover:bg-blue-50/20'"
                            @click="evtPublicPreview ? null : openEvtFieldEditor(field.id)">
                            <div class="flex items-center gap-1">
                              <label class="text-sm font-semibold text-gray-600" :class="evtPublicPreview ? '' : 'cursor-pointer'">{{ field.label }} <span v-if="field.is_required" class="text-red-400 ml-0.5">*</span></label>
                              <span v-if="evtCoreReadOnly(subject.key, inst, field)" class="text-[10px] font-normal text-gray-400 inline-flex items-center gap-0.5"><i class="pi pi-lock text-[9px]" />from your account</span>
                              <i v-if="!evtPublicPreview" class="pi pi-pencil text-[9px] text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5" />
                            </div>
                            <input v-if="evtCoreReadOnly(subject.key, inst, field)" type="text" readonly :value="evtPreviewAccount[field.account]"
                              class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg bg-gray-100 text-gray-500 outline-none" />
                            <input v-else type="text" v-model="evtPersonValues[evtGIdx(subject.key, inst)][field.label]" :placeholder="field.placeholder || ''"
                              class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors"
                              :class="evtPublicPreview ? '' : 'pointer-events-none'" @click.stop />
                          </div>
                        </div>
                        <!-- Canvas: top-level fields/elements + section holders. Fields and
                             elements can be dragged between the canvas and any section. -->
                        <div :key="'canvas-' + subject.key + '-' + inst + '-' + evtCanvasNonce" :ref="(el) => registerSubjectGrid(el, evtGIdx(subject.key, inst) + ':' + subject.key, subject.key)" data-evt-canvas class="grid gap-3"
                          :class="evtPreviewDevice === 'mobile' ? 'grid-cols-1' : 'grid-cols-2'"
                          @drop.stop="onDropFieldTo(subject.key, $event)">
                          <template v-for="field in evtTopLevelItems(subject.key, inst)" :key="field.id">
                            <!-- Section: title + description on top, fields below. Clean —
                                 a thin divider between sections, no card chrome. -->
                            <div v-if="field.field_type === 'section'"
                              :data-field-key="field.id"
                              class="col-span-2 group relative border-t border-gray-100 pt-6 mt-2">
                              <span class="field-drag-handle absolute right-0 top-3 w-5 h-5 flex items-center justify-center cursor-grab active:cursor-grabbing text-gray-300 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity z-10" v-tooltip.top="'Drag section'" @click.stop @mousedown.stop>
                                <i class="pi pi-arrows-alt text-[11px]" />
                              </span>
                              <!-- Heading + description above the fields (click to edit) -->
                              <div class="cursor-pointer mb-4" @click="openEvtFieldEditor(field.id)">
                                <p class="text-lg font-bold text-gray-800">{{ field.label || 'Section' }}</p>
                                <p v-if="field.placeholder" class="text-sm text-gray-500 mt-1 leading-relaxed">{{ field.placeholder }}</p>
                              </div>
                              <!-- The section's own fields (drag here) -->
                              <div :ref="(el) => registerSectionDropzone(el, evtGIdx(subject.key, inst) + ':' + subject.key, field.id, subject.key)" data-evt-dropzone
                                class="grid gap-x-5 gap-y-4 content-start"
                                :class="evtPreviewDevice === 'mobile' ? 'grid-cols-1' : 'grid-cols-2'"
                                @drop.stop="onDropIntoSection(subject.key, field.id, $event)">
                                <EvtFieldCell v-for="child in evtSectionChildren(subject.key, field.id, inst)" :key="child.id" :field="child" :subjectKey="subject.key" :inst="inst" />
                                <p v-if="!evtSectionChildren(subject.key, field.id, inst).length" class="col-span-2 text-xs text-gray-300 text-center py-6">Drag fields here</p>
                              </div>
                            </div>
                            <!-- Top-level field / element -->
                            <EvtFieldCell v-else :field="field" :subjectKey="subject.key" :inst="inst" />
                          </template>
                        </div>

                        <!-- Empty state for this subject (builder only) -->
                        <div v-if="!evtFieldsForSubject(subject.key).length && !evtPublicPreview"
                          class="border-2 border-dashed rounded-xl py-6 text-center transition-all"
                          :class="dropZoneActive && evtDropTarget === subject.key ? 'border-[#0e43a3] bg-blue-50/30' : 'border-gray-200 bg-[#fafaf9]'">
                          <i class="pi pi-arrow-circle-down mb-1.5 text-sm" :class="dropZoneActive && evtDropTarget === subject.key ? 'text-[#0e43a3]' : 'text-gray-300'" />
                          <p class="text-sm font-semibold" :class="dropZoneActive && evtDropTarget === subject.key ? 'text-[#0e43a3]' : 'text-gray-400'">Drag fields here for {{ subject.label }}</p>
                          <button type="button" class="mt-1 text-sm text-[#0e43a3] hover:underline" @click.stop="openEvtSubject(subject.key)">or edit {{ subject.label }}’s form</button>
                        </div>

                        <!-- Sessions / options picker — INSIDE the chooser subject's card -->
                        <div v-if="evtSubjectSelectsOptions(subject) && sessions.some((s: any) => s.display_on_form !== false && sessionVisibleOnForm(s) && getSessionMode(s.id ?? s._savedId, subject.key) !== 'hidden')" class="space-y-2 pt-4 mt-2 border-t border-gray-100">
                      <div class="flex items-center gap-2 flex-wrap">
                        <p class="text-xl font-bold text-gray-800">{{ currentEvtFormDesign.sessionsHeading || 'Sessions' }}</p>
                      </div>
                      <p class="text-sm text-gray-500">Select the sessions you'd like to attend.</p>

                      <!-- DATE TABLE layout — desktop only; the wide grid squishes on phones,
                           so mobile cascades to the stacked LIST layout below. -->
                      <template v-if="currentEvtFormDesign.sessionsLayout === 'date-table' && formSessionDateTable.rows.length && evtPreviewDevice !== 'mobile'">
                        <div class="rounded-xl border border-gray-200 overflow-hidden bg-white">
                          <!-- Header row -->
                          <div class="grid border-b border-gray-200 bg-gray-50"
                            :style="`grid-template-columns: repeat(${formSessionDateTable.columns.length + 1}, 1fr)`">
                            <div class="px-3 py-2 text-xs font-semibold text-gray-500">Date</div>
                            <div v-for="(col, ci) in formSessionDateTable.columns" :key="col.key"
                              class="px-3 py-2 border-l border-gray-200">
                              <div class="flex items-start gap-2">
                                <!-- Select all checkbox -->
                                <button type="button"
                                  class="w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors mt-0.5"
                                  :class="isColumnFullySelected(evtGIdx(subject.key, inst), ci)
                                    ? 'bg-primary border-primary'
                                    : 'border-gray-300 hover:border-primary/50'"
                                  @click="toggleAllColumnSessions(evtGIdx(subject.key, inst), ci)">
                                  <i v-if="isColumnFullySelected(evtGIdx(subject.key, inst), ci)" class="pi pi-check text-white text-[8px]" />
                                </button>
                                <div>
                                  <p class="text-xs font-semibold text-gray-800">
                                    {{ col.title || col.startTime }}<span v-if="col.fee !== null" class="ml-1.5 font-normal text-primary">${{ col.fee.toFixed(2) }}</span>
                                  </p>
                                  <p v-if="col.startTime" class="text-[11px] text-gray-400 mt-0.5">{{ col.startTime }}<template v-if="col.endTime"> – {{ col.endTime }}</template></p>
                                </div>
                              </div>
                            </div>
                          </div>
                          <!-- Data rows -->
                          <div v-for="(row, ri) in formSessionDateTable.rows" :key="ri"
                            class="grid border-b border-gray-100 last:border-b-0"
                            :class="row.newWeek ? 'border-t-2 border-t-gray-300' : ''"
                            :style="`grid-template-columns: repeat(${formSessionDateTable.columns.length + 1}, 1fr)`">
                            <div class="px-3 py-2.5 flex items-center">
                              <p class="text-sm font-medium text-gray-800">{{ row.weekday }}, {{ row.dayMonth }}</p>
                            </div>
                            <div v-for="(s, ci) in row.cells" :key="ci"
                              class="border-l border-gray-100 px-3 py-2 flex items-center gap-2">
                              <template v-if="s">
                                <button type="button"
                                  class="w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors"
                                  :class="s.required || isSessionSelected(evtGIdx(subject.key, inst), s.id ?? s._savedId, false)
                                    ? 'bg-primary border-primary'
                                    : 'border-gray-300 hover:border-primary/50'"
                                  @click="!s.required && togglePreviewSession(evtGIdx(subject.key, inst), s.id ?? s._savedId)">
                                  <i v-if="s.required || isSessionSelected(evtGIdx(subject.key, inst), s.id ?? s._savedId, false)" class="pi pi-check text-white text-[8px]" />
                                </button>
                                <span v-if="!formSessionDateTable.columns[ci]?.title" class="text-xs text-gray-600 truncate">{{ s.title || 'Session' }}</span>
                              </template>
                            </div>
                          </div>
                        </div>
                      </template>

                      <!-- GROUP PICKER layout -->
                      <template v-else-if="currentEvtFormDesign.sessionsLayout === 'group-picker'">
                        <div class="space-y-3">
                          <!-- Term button + dropdown -->
                          <div class="relative">
                            <div class="flex items-center gap-3">
                              <button type="button"
                                class="flex items-center gap-2 px-4 py-2 rounded text-white text-sm font-semibold transition-colors"
                                style="background:#2494D2"
                                @click="evtGroupPickerOpen = !evtGroupPickerOpen">
                                {{ currentEvtFormDesign.sessionsGroupLabel || event?.title || 'Select term' }}
                                <i class="pi pi-chevron-down text-xs" />
                              </button>
                            </div>
                            <!-- Dropdown: two-panel flyout -->
                            <div v-if="evtGroupPickerOpen"
                              class="absolute left-0 top-full mt-1 z-10 flex bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
                              @mouseleave="evtGroupPickerHover = null">
                              <!-- Left panel: group names -->
                              <div class="min-w-[200px]">
                                <button type="button"
                                  class="w-full text-left px-4 py-2.5 text-sm italic text-gray-500 hover:bg-gray-50 border-b border-gray-100"
                                  @click="evtGroupPickerOpen = false">Show All</button>
                                <div v-for="grp in formSessionGroupPicker" :key="grp.title"
                                  class="border-b border-gray-50 last:border-0"
                                  @mouseenter="evtGroupPickerHover = grp.title">
                                  <button type="button"
                                    class="w-full text-left px-4 py-2.5 text-sm flex items-center justify-between gap-4 transition-colors"
                                    :class="evtGroupPickerHover === grp.title ? 'bg-gray-50' : 'hover:bg-gray-50'"
                                    @click="() => {
                                      const s = grp.items[0]
                                      if (s) togglePreviewSession(evtGIdx(subject.key, inst), s.id ?? s._savedId)
                                      if (!grp.hasChildren) evtGroupPickerOpen = false
                                    }">
                                    <span :class="grp.items.some((s: any) => isSessionSelected(evtGIdx(subject.key, inst), s.id ?? s._savedId, false)) ? 'text-[#2494D2] font-medium' : 'text-gray-800'">
                                      {{ grp.title }}
                                    </span>
                                    <i v-if="grp.hasChildren" class="pi pi-chevron-right text-xs text-gray-400 shrink-0" />
                                  </button>
                                </div>
                              </div>
                              <!-- Right panel: child dates for hovered group -->
                              <div v-if="formSessionGroupPicker.find(g => g.title === evtGroupPickerHover)?.hasChildren"
                                class="border-l border-gray-100 min-w-[160px] flex flex-col justify-center">
                                <button v-for="s in formSessionGroupPicker.find(g => g.title === evtGroupPickerHover)?.items"
                                  :key="s.id ?? s._savedId"
                                  type="button"
                                  class="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 transition-colors"
                                  :class="isSessionSelected(evtGIdx(subject.key, inst), s.id ?? s._savedId, false) ? 'text-[#2494D2] font-medium' : 'text-gray-700'"
                                  @click="togglePreviewSession(evtGIdx(subject.key, inst), s.id ?? s._savedId); evtGroupPickerOpen = false">
                                  <i v-if="isSessionSelected(evtGIdx(subject.key, inst), s.id ?? s._savedId, false)" class="pi pi-check text-xs text-[#2494D2] shrink-0" />
                                  <span>{{ s.start_at ? new Date(s.start_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : s.title || evtGroupPickerHover }}</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </template>

                      <!-- LIST layout (default) -->
                      <template v-else>
                        <!-- Info sessions -->
                        <template v-for="s in sessions.filter((s: any) => s.display_on_form !== false && sessionVisibleOnForm(s) && getSessionMode(s.id ?? s._savedId, subject.key) === 'info')" :key="(s.id ?? s._savedId) + '-info'">
                          <div class="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2.5">
                            <i class="pi pi-info-circle text-amber-500 text-sm shrink-0 mt-0.5" />
                            <div class="flex-1 min-w-0">
                              <p class="text-sm font-semibold text-gray-800">{{ s.title || 'Untitled Session' }}</p>
                              <p v-if="s.start_at" class="text-xs text-gray-500 mt-0.5">{{ new Date(s.start_at).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) }}<template v-if="s.end_at"> · {{ new Date(s.start_at).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }) }}–{{ new Date(s.end_at).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }) }}</template></p>
                              <div v-if="s.description" class="text-xs text-gray-500 mt-0.5" v-html="s.description" />
                            </div>
                          </div>
                        </template>

                        <!-- Selectable sessions grouped by date with clickable headers -->
                        <template v-for="item in formPanelSessionsWithHeaders.filter(i => i.type === 'header' || getSessionMode((i as any).session?.id ?? (i as any).session?._savedId, subject.key) === 'select')" :key="item.type === 'header' ? (item as any).label + '-hdr' : ((item as any).session.id ?? (item as any).session._savedId) + '-sel'">
                          <!-- Date header — click to select/deselect all sessions for this date -->
                          <button v-if="item.type === 'header'" type="button"
                            class="w-full flex items-center gap-2 px-1 pt-2 pb-1 hover:opacity-75 transition-opacity"
                            @click="toggleDateSessions(evtGIdx(subject.key, inst), (item as any).label)">
                            <div class="w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors"
                              :class="isDateFullySelected(evtGIdx(subject.key, inst), (item as any).label) ? 'bg-primary border-primary' : 'border-gray-300 hover:border-primary/50'">
                              <i v-if="isDateFullySelected(evtGIdx(subject.key, inst), (item as any).label)" class="pi pi-check text-white text-[8px]" />
                            </div>
                            <span class="text-xs font-bold text-gray-500 uppercase tracking-widest">{{ (item as any).label }}</span>
                          </button>
                          <!-- Session card -->
                          <template v-else>
                        <template v-for="s in [(item as any).session]" :key="(s.id ?? s._savedId) + '-sel'">
                          <button
                            type="button"
                            class="w-full flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors"
                            :class="[
                              s.required
                                ? 'border-primary/20 bg-primary/5 cursor-default'
                                : isSessionSelected(evtGIdx(subject.key, inst), s.id ?? s._savedId, false)
                                  ? 'border-primary/30 bg-primary/5 hover:bg-primary/8'
                                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                            ]"
                            @click="!s.required && togglePreviewSession(evtGIdx(subject.key, inst), s.id ?? s._savedId)">
                            <!-- Checkbox indicator -->
                            <div class="shrink-0 mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors"
                              :class="s.required || isSessionSelected(evtGIdx(subject.key, inst), s.id ?? s._savedId, false)
                                ? 'bg-primary border-primary'
                                : 'border-gray-300'">
                              <i v-if="s.required || isSessionSelected(evtGIdx(subject.key, inst), s.id ?? s._savedId, false)" class="pi pi-check text-white text-[8px]" />
                            </div>
                            <!-- Session info -->
                            <div class="flex-1 min-w-0">
                              <div class="flex items-center gap-2 flex-wrap">
                                <p class="text-sm font-semibold text-gray-800">{{ s.title || 'Untitled Session' }}</p>
                                <span v-if="s.required" class="text-[10px] font-bold uppercase tracking-wide text-primary/60 bg-primary/10 px-1.5 py-0.5 rounded">Required</span>
                              </div>
                              <p v-if="s.start_at" class="text-xs text-gray-500 mt-0.5">{{ new Date(s.start_at).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) }}<template v-if="s.end_at"> · {{ new Date(s.start_at).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }) }}–{{ new Date(s.end_at).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }) }}</template></p>
                              <div v-if="s.description" class="text-xs text-gray-500 mt-0.5 line-clamp-1" v-html="s.description" />
                            </div>
                            <!-- Price -->
                            <div class="shrink-0 text-right">
                              <template v-if="s._feesConfig?.is_charged">
                                <template v-if="s._feesConfig.all_charged_equally">
                                  <p class="text-sm font-bold text-primary">${{ (s._feesConfig.base_fees ?? []).reduce((sum: number, f: any) => sum + (f.amount ?? 0), 0).toFixed(2) }}</p>
                                </template>
                                <template v-else>
                                  <template v-if="s._feesConfig.groups?.[0]">
                                    <p class="text-sm font-bold text-primary">${{ (s._feesConfig.groups[0]?.fees ?? []).reduce((sum: number, f: any) => sum + (f.amount ?? 0), 0).toFixed(2) }}</p>
                                  </template>
                                  <p v-else class="text-xs text-gray-400 italic">No fee set</p>
                                </template>
                              </template>
                              <p v-else class="text-xs text-gray-400">Free</p>
                            </div>
                          </button>
                        </template>
                          </template>
                          </template>
                      </template>
                        </div>

                        <!-- Order summary (this registrant) — shown under whoever picks sessions/fees -->
                        <div v-if="evtSubjectSelectsOptions(subject) && evtOrderRows[evtGIdx(subject.key, inst)]?.length" class="mt-3 pt-3 border-t border-gray-100 space-y-1">
                          <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Order Summary</p>
                          <div v-for="row in evtOrderRows[evtGIdx(subject.key, inst)]" :key="row.label" class="flex items-center text-sm">
                            <span class="flex-1 text-gray-500">{{ row.label }}</span>
                            <span class="tabular-nums w-[72px] text-right mr-9 shrink-0" :class="row.amount < 0 ? 'text-green-600 font-medium' : 'text-gray-700'">
                              {{ row.amount < 0 ? '-' : '' }}${{ Math.abs(row.amount).toFixed(2) }}
                            </span>
                          </div>
                          <div class="flex items-center pt-1.5 border-t border-gray-100 text-sm font-bold">
                            <span class="flex-1 text-gray-700">Total</span>
                            <span class="tabular-nums w-[72px] text-right mr-9 shrink-0 text-primary">
                              ${{ evtOrderRows[evtGIdx(subject.key, inst)].reduce((s, r) => s + r.amount, 0).toFixed(2) }}
                            </span>
                          </div>
                        </div>
                      </div>
                  </div>

                  <!-- Add another instance of THIS subject. Hidden entirely for single-only
                       subjects (max = 1); otherwise disabled (not hidden) once the max is
                       reached, with a message explaining why. Lives in the group so it follows
                       the wizard step. -->
                  <div v-if="evtSubjectMax(subject) !== 1" class="flex items-center gap-3">
                    <button type="button"
                      class="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      :style="`background:${currentEvtFormDesign.addPersonColor || '#0e43a3'}`"
                      :disabled="evtSubjectMaxReached(subject)"
                      @click="evtAddSubjectInstance(subject)">
                      <i class="pi pi-plus text-[10px]" />
                      Add another {{ subject.label }}
                    </button>
                    <span v-if="evtSubjectMaxReached(subject)" class="text-[11px] text-gray-400 whitespace-nowrap">
                      Maximum of {{ evtSubjectMax(subject) }} reached
                    </span>
                  </div>
                </div>

              </div>

            </div>

            <!-- Terms & Conditions: interactive individual checkbox per term (own step in wizard) -->
            <div v-show="!evtIsWizard || evtWizardStep === evtWizardTermsIdx" class="px-6 py-8 space-y-3">
              <h3 class="text-xl font-bold text-gray-800">Terms and Conditions</h3>
              <FormsTermsConsentBlock
                v-for="tc in evtFormTermsShown" :key="tc.label"
                :label="tc.label"
                :agree-text="tc.agreeText"
                :agreed="evtPreviewTermsAgreed.has(tc.label)"
                @update:agreed="toggleEvtPreviewAgree(tc.label)" />
            </div>

            <!-- Payment: interactive radio selection (scratch mode only — simple mode renders this below the total) -->
            <div v-if="(evtFormPayment.plan.enabled || evtFormPayment.credit_card.enabled || evtFormPayment.invoice.enabled || evtFormPayment.coupon.enabled) && evtFormGroupModes[selectedFormGroupId] !== 'simple' && (!evtIsWizard || evtWizardStep === evtWizardTermsIdx)" class="px-6 py-8 space-y-2">
              <h3 class="text-xl font-bold text-gray-800 mb-3">Payment</h3>

              <!-- Payment Plan -->
              <FormsPaymentOptionCard
                v-if="evtFormPayment.plan.enabled"
                icon="pi-calendar"
                title="Payment Plan"
                :selected="evtPreviewPayment === 'plan'"
                @click="evtPreviewPayment = 'plan'">
                <template #header>
                  <span class="text-sm text-gray-400 font-medium">$120.00 total</span>
                </template>
                <div v-if="evtFormPayment.plan.frequencies.length > 1" class="flex items-center gap-2">
                  <label class="text-sm text-gray-500 shrink-0">Payment frequency</label>
                  <select
                    v-model="evtPreviewPlanFreq"
                    class="flex-1 h-8 border border-gray-200 rounded-lg px-2 text-sm text-gray-700 bg-white focus:outline-none focus:border-[#0e43a3] transition-colors cursor-pointer">
                    <option v-for="f in evtFormPayment.plan.frequencies" :key="f" :value="f">
                      {{ f === 'weekly' ? 'Weekly' : f === 'fortnightly' ? 'Fortnightly' : f === 'monthly' ? 'Monthly' : f }}
                    </option>
                  </select>
                </div>
                <div v-if="evtPreviewPlanFreq === 'weekly' || evtPreviewPlanFreq === 'fortnightly'" class="flex items-center gap-2">
                  <label class="text-sm text-gray-500 shrink-0">Payment day</label>
                  <select
                    v-model="evtPreviewPlanDay"
                    class="flex-1 h-8 border border-gray-200 rounded-lg px-2 text-sm text-gray-700 bg-white focus:outline-none focus:border-[#0e43a3] transition-colors cursor-pointer">
                    <option v-for="d in weekDays" :key="d" :value="d">{{ d }}</option>
                  </select>
                </div>
                <div v-else-if="evtPreviewPlanFreq === 'monthly'" class="flex items-center gap-2">
                  <label class="text-sm text-gray-500 shrink-0">Payment date</label>
                  <select
                    v-model="evtPreviewPlanDate"
                    class="flex-1 h-8 border border-gray-200 rounded-lg px-2 text-sm text-gray-700 bg-white focus:outline-none focus:border-[#0e43a3] transition-colors cursor-pointer">
                    <option v-for="n in monthDates" :key="n" :value="n">{{ ordinal(n) }} of the month</option>
                  </select>
                </div>
                <p class="text-sm text-gray-500">Your registration fee will be split into equal payments charged to your card automatically.</p>
                <div class="rounded-lg border border-gray-200 overflow-hidden text-sm">
                  <div class="bg-gray-50 px-3 py-1.5 flex gap-2 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">
                    <span class="flex-1">Payment</span><span class="w-32">Due Date</span><span class="w-16 text-right">Amount</span>
                  </div>
                  <div v-for="([label, date], i) in evtPlanScheduleRows" :key="i"
                    class="px-3 py-2 flex gap-2 border-t border-gray-100 text-gray-700" :class="i === 0 ? 'bg-blue-50/30' : ''">
                    <span class="flex-1">{{ label }}</span><span class="w-32 text-gray-500">{{ date }}</span><span class="w-16 text-right font-medium">$30.00</span>
                  </div>
                  <div class="px-3 py-2 flex gap-2 border-t-2 border-gray-200 bg-gray-50 font-semibold text-gray-700">
                    <span class="flex-1">Total</span><span class="w-32" /><span class="w-16 text-right">$120.00</span>
                  </div>
                </div>
                <p class="text-[11px] text-gray-500 font-medium pt-1">Card for automatic payments</p>
                <div class="space-y-2">
                  <div class="flex items-center gap-3"><span class="text-gray-500 w-24 shrink-0 text-sm">Name On Card</span><div class="flex-1 h-8 border border-gray-200 rounded px-2 flex items-center gap-1.5 bg-white"><i class="pi pi-id-card text-gray-300 text-sm" /><span class="text-gray-400 text-sm">John Smith</span></div></div>
                  <div class="flex items-center gap-3"><span class="text-gray-500 w-24 shrink-0 text-sm">Card Number</span><div class="flex-1 h-8 border border-gray-200 rounded px-2 flex items-center gap-1.5 bg-white"><i class="pi pi-credit-card text-gray-300 text-sm" /><span class="text-gray-400 text-sm">1234 1234 1234 1234</span></div></div>
                  <div class="flex items-center gap-3"><span class="text-gray-500 w-24 shrink-0 text-sm">Expiry / CVC</span><div class="flex items-center gap-2"><div class="h-8 border border-gray-200 rounded px-2 flex items-center gap-1.5 bg-white"><i class="pi pi-calendar text-gray-300 text-sm" /><span class="text-gray-400 text-sm">12 / 26</span></div><div class="h-8 border border-gray-200 rounded px-2 flex items-center gap-1.5 bg-white"><i class="pi pi-lock text-gray-300 text-sm" /><span class="text-gray-400 text-sm">999</span></div></div></div>
                </div>
                <p class="text-[11px] text-gray-400">You will receive an email reminder 3 days before each payment.</p>
              </FormsPaymentOptionCard>

              <!-- Credit Card -->
              <FormsPaymentOptionCard
                v-if="evtFormPayment.credit_card.enabled"
                icon="pi-credit-card"
                title="Pay by Credit Card"
                :selected="evtPreviewPayment === 'credit_card'"
                @click="evtPreviewPayment = 'credit_card'">
                <div class="space-y-2 text-sm">
                  <div class="flex items-center gap-3"><span class="text-gray-500 w-24 shrink-0">Name On Card</span><div class="flex-1 h-8 border border-gray-200 rounded px-2 flex items-center gap-1.5 bg-white"><i class="pi pi-id-card text-gray-300" /><span class="text-gray-400">John Smith</span></div></div>
                  <div class="flex items-center gap-3"><span class="text-gray-500 w-24 shrink-0">Card Number</span><div class="flex-1 h-8 border border-gray-200 rounded px-2 flex items-center gap-1.5 bg-white"><i class="pi pi-credit-card text-gray-300" /><span class="text-gray-400">1234 1234 1234 1234</span></div></div>
                  <div class="flex items-center gap-3"><span class="text-gray-500 w-24 shrink-0">Expiration</span><div class="flex items-center gap-2"><div class="h-8 border border-gray-200 rounded px-2 flex items-center gap-1.5 bg-white"><i class="pi pi-calendar text-gray-300" /><span class="text-gray-400">12 / 26</span></div><span class="text-gray-500">CVC</span><div class="h-8 border border-gray-200 rounded px-2 flex items-center gap-1.5 bg-white"><i class="pi pi-lock text-gray-300" /><span class="text-gray-400">999</span></div></div></div>
                </div>
              </FormsPaymentOptionCard>

              <!-- Invoice -->
              <FormsPaymentOptionCard
                v-if="evtFormPayment.invoice.enabled"
                icon="pi-file-edit"
                title="Pay by Invoice"
                :selected="evtPreviewPayment === 'invoice'"
                @click="evtPreviewPayment = 'invoice'">
                <p class="text-sm text-gray-500">An invoice will be emailed to you after registration. Please make a direct bank transfer using the details below.</p>
                <div class="rounded-lg border border-gray-200 bg-white text-sm divide-y divide-gray-100 overflow-hidden">
                  <div class="px-3 py-2 flex gap-2"><span class="text-gray-400 w-28 shrink-0">Bank</span><span class="text-gray-700 font-medium">ANZ Bank New Zealand</span></div>
                  <div class="px-3 py-2 flex gap-2"><span class="text-gray-400 w-28 shrink-0">Account Name</span><span class="text-gray-700 font-medium">City Sports Club Inc.</span></div>
                  <div class="px-3 py-2 flex gap-2"><span class="text-gray-400 w-28 shrink-0">Account Number</span><span class="text-gray-700 font-medium font-mono tracking-wide">01-2015-0454848-00</span></div>
                  <div class="px-3 py-2 flex gap-2"><span class="text-gray-400 w-28 shrink-0">Reference</span><span class="text-gray-700">Your full name + <span class="font-mono bg-gray-100 px-1 rounded">REG-2025-0041</span></span></div>
                  <div class="px-3 py-2 flex gap-2"><span class="text-gray-400 w-28 shrink-0">Amount Due</span><span class="text-gray-700 font-semibold text-[#0e43a3]">$120.00</span></div>
                  <div class="px-3 py-2 flex gap-2"><span class="text-gray-400 w-28 shrink-0">Payment Due</span><span class="text-gray-700">17 May 2025 <span class="text-gray-400">(30 days)</span></span></div>
                </div>
                <p class="text-[11px] text-gray-400">Once payment has been made, please email <span class="text-[#0e43a3]">accounts@citysportsclub.org.nz</span> with your receipt. Your registration will be confirmed upon payment.</p>
              </FormsPaymentOptionCard>

              <!-- Coupon -->
              <FormsPaymentOptionCard
                v-if="evtFormPayment.coupon.enabled"
                icon="pi-tag"
                :title="`Pay by Coupon (${evtFormPayment.coupon.quantity} coupon${evtFormPayment.coupon.quantity !== 1 ? 's' : ''} required)`"
                :selected="evtPreviewPayment === 'coupon'"
                @click="evtPreviewPayment = 'coupon'" />
            </div>

            <!-- Accept / Decline / Maybe (simple registration mode) -->
            <div v-if="evtFormGroupModes[selectedFormGroupId] === 'simple'" class="border-t border-gray-100">

              <!-- People table -->
              <div class="px-6 pt-6">
                <div class="border border-gray-200 rounded-xl overflow-hidden">
                  <!-- Header row -->
                  <div class="grid gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide"
                    :class="evtBaseRegistrationFee > 0 ? 'grid-cols-[1fr_1fr_auto_auto]' : 'grid-cols-[1fr_1fr_auto]'">
                    <span>First Name</span>
                    <span>Last Name</span>
                    <span v-if="evtBaseRegistrationFee > 0" class="w-16 text-right">Fee</span>
                    <span class="w-6" />
                  </div>
                  <!-- Person rows -->
                  <div v-for="(person, idx) in simplePersonNames" :key="idx"
                    class="grid gap-2 items-center px-3 py-1.5 border-b border-gray-100 last:border-0"
                    :class="evtBaseRegistrationFee > 0 ? 'grid-cols-[1fr_1fr_auto_auto]' : 'grid-cols-[1fr_1fr_auto]'">
                    <input v-model="person.first" type="text" placeholder="First name"
                      class="h-8 px-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors w-full" />
                    <input v-model="person.last" type="text" placeholder="Last name"
                      class="h-8 px-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors w-full" />
                    <span v-if="evtBaseRegistrationFee > 0" class="w-16 text-right text-sm tabular-nums text-gray-700">${{ evtBaseRegistrationFee.toFixed(2) }}</span>
                    <button
                      v-if="simplePersonNames.length > 1"
                      type="button"
                      class="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      @click="simplePersonNames.splice(idx, 1); simplePersonCount--">
                      <i class="pi pi-times text-xs" />
                    </button>
                    <div v-else class="w-6" />
                  </div>
                </div>
              </div>

              <!-- Add Person button -->
              <div class="px-6 py-4">
                <button
                  type="button"
                  class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
                  :style="`background:${currentEvtFormDesign.addPersonColor || '#0e43a3'}`"
                  @click="simplePersonCount++">
                  <i class="pi pi-plus text-xs" />
                  Add Another Person
                </button>
              </div>

              <!-- Discounts + Total (only shown when there is a fee) -->
              <template v-if="evtBaseRegistrationFee > 0">
                <template v-if="evtTotalDiscountSavings > 0">
                  <div class="px-6 pt-4 border-t border-gray-100 space-y-1">
                    <div v-for="disc in evtDiscountSummaryLines" :key="disc.formText"
                      class="flex items-center text-sm text-green-600">
                      <span class="flex-1 flex items-center gap-1.5"><i class="pi pi-tag text-xs" />{{ disc.formText }}</span>
                      <span class="tabular-nums w-[72px] text-right mr-[53px] shrink-0 font-medium">−${{ disc.amount.toFixed(2) }}</span>
                    </div>
                    <div class="flex items-center pt-1 border-t border-dashed border-gray-200 text-sm font-semibold text-green-700">
                      <span class="flex-1">Total savings</span>
                      <span class="tabular-nums w-[72px] text-right mr-[53px] shrink-0">−${{ evtTotalDiscountSavings.toFixed(2) }}</span>
                    </div>
                  </div>
                  <div class="px-6 pb-5 flex items-center border-t border-gray-100 pt-4">
                    <span class="flex-1 text-sm font-bold text-gray-900">Total</span>
                    <span class="tabular-nums w-[72px] text-right mr-[53px] text-sm font-bold text-primary">${{ Math.max(0, evtBaseRegistrationFee * simplePersonCount - evtTotalDiscountSavings).toFixed(2) }}</span>
                  </div>
                </template>
                <div v-else class="px-6 pb-5 flex items-center border-t border-gray-100 pt-4">
                  <span class="flex-1 text-sm font-bold text-gray-900">Total</span>
                  <span class="tabular-nums w-[72px] text-right mr-[53px] text-sm font-bold text-primary">${{ (evtBaseRegistrationFee * simplePersonCount).toFixed(2) }}</span>
                </div>
              </template>

              <!-- Payment options (simple mode) -->
              <FormPreviewPayment :payment="evtFormPayment" v-model:selected="evtPreviewPayment" />

              <!-- Response -->
              <div class="px-6 pb-6 space-y-2">
                <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide">Your Response</p>
                <div class="flex gap-2">
                  <button type="button"
                    class="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                    :class="evtPreviewResponse === 'accept' ? 'bg-[#34B66D] text-white ring-2 ring-[#34B66D] ring-offset-1' : 'bg-[#34B66D]/10 text-[#34B66D] hover:bg-[#34B66D] hover:text-white'"
                    @click="evtPreviewResponse = evtPreviewResponse === 'accept' ? null : 'accept'">Accept</button>
                  <button type="button"
                    class="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                    :class="evtPreviewResponse === 'decline' ? 'bg-red-500 text-white ring-2 ring-red-400 ring-offset-1' : 'bg-red-50 text-red-500 hover:bg-red-500 hover:text-white'"
                    @click="evtPreviewResponse = evtPreviewResponse === 'decline' ? null : 'decline'">Decline</button>
                  <button type="button"
                    class="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                    :class="evtPreviewResponse === 'maybe' ? 'bg-gray-500 text-white ring-2 ring-gray-400 ring-offset-1' : 'bg-gray-100 text-gray-600 hover:bg-gray-500 hover:text-white'"
                    @click="evtPreviewResponse = evtPreviewResponse === 'maybe' ? null : 'maybe'">Maybe</button>
                </div>
              </div>

            </div>

            <!-- Submit button (scratch / advanced mode) — hidden on the mobile details step -->
            <div v-else v-show="!evtOnDetailsStep" class="px-6 py-6 border-t border-gray-100 space-y-4">
              <!-- Discount summary lines -->
              <template v-if="evtTotalDiscountSavings > 0 && (!evtIsWizard || evtWizardStep === evtWizardTermsIdx)">
                <div v-for="disc in evtDiscountSummaryLines" :key="disc.formText"
                  class="flex items-center text-sm text-green-600">
                  <span class="flex-1 flex items-center gap-1.5"><i class="pi pi-tag text-xs" />{{ disc.formText }}</span>
                  <span class="tabular-nums w-[72px] text-right mr-[53px] shrink-0 font-medium">−${{ disc.amount.toFixed(2) }}</span>
                </div>
                <div class="flex items-center pt-1 border-t border-dashed border-gray-200 text-sm font-semibold text-green-700">
                  <span class="flex-1">Total savings</span>
                  <span class="tabular-nums w-[72px] text-right mr-[53px] shrink-0">−${{ evtTotalDiscountSavings.toFixed(2) }}</span>
                </div>
                <div class="border-t border-gray-100" />
              </template>
              <div v-if="!evtIsWizard || evtWizardStep === evtWizardTermsIdx" class="flex items-center">
                <span class="flex-1 text-sm font-bold text-gray-900">Total</span>
                <span class="tabular-nums w-[72px] text-right mr-[53px] shrink-0 text-sm font-bold text-primary">${{ Math.max(0, evtOrderTotal - evtTotalDiscountSavings).toFixed(2) }}</span>
              </div>
              <!-- Single-page submit -->
              <button v-if="!evtIsWizard" type="button" class="w-full py-3 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-[#161a45] transition-colors">Submit Registration</button>
              <!-- Wizard navigation -->
              <div v-else class="flex items-center gap-2">
                <button v-if="evtWizardStep > 0" type="button" class="px-4 py-3 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1.5" @click="evtWizardBack"><i class="pi pi-angle-left text-xs" />Back</button>
                <button v-if="evtWizardStep < evtWizardTermsIdx" type="button" class="flex-1 py-3 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-[#161a45] transition-colors flex items-center justify-center gap-1.5" @click="evtWizardNext">Next<i class="pi pi-angle-right text-xs" /></button>
                <button v-else type="button" class="flex-1 py-3 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-[#161a45] transition-colors">Submit Registration</button>
              </div>
            </div>

          </div>

          </div><!-- end scrollable wrapper -->
        </div>

        </div>

        <!-- Sticky bottom nav -->
        <div v-if="evtFormGroupModes[selectedFormGroupId] && evtFormGroupModes[selectedFormGroupId] !== 'skip'" class="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-white shrink-0">
          <button type="button" class="px-5 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">Back</button>
          <button type="button" class="px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-[#161a45] transition-colors">Next: Configure Discounts</button>
        </div>

  <!-- Edit T&C Agree Text Dialog -->
  <Dialog :visible="evtEditingTCLabel !== null" header="Edit Checkbox Text" modal style="width:420px" @update:visible="evtEditingTCLabel = null">
    <div class="py-2 space-y-3">
      <p class="text-sm text-gray-500">Update the text shown next to the agree checkbox for <strong>{{ evtEditingTCLabel }}</strong>.</p>
      <InputText v-model="evtTCEditAgreeText" placeholder="e.g. I agree to the Photos Policy" class="w-full" @keyup.enter="saveEvtEditTC" />
    </div>
    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="evtEditingTCLabel = null" />
      <Button label="Save" @click="saveEvtEditTC" style="background:var(--brand-primary); border-color:var(--brand-primary)" />
    </template>
  </Dialog>

  <!-- Create T&C Modal -->
  <Dialog v-model:visible="showEvtTCModal" header="Create New T&C" modal style="width:520px">
    <div class="space-y-4 py-2">
      <div>
        <label class="text-sm font-medium text-gray-700 block mb-1.5">T&C Name <span class="text-red-500">*</span></label>
        <InputText v-model="evtTCDraft.label" placeholder="e.g. Media Release Policy" class="w-full" />
      </div>
      <div>
        <label class="text-sm font-medium text-gray-700 block mb-1.5">Terms Text</label>
        <Textarea v-model="evtTCDraft.text" placeholder="Enter the full terms and conditions text…" auto-resize rows="5" class="w-full text-sm" />
      </div>
      <div>
        <label class="text-sm font-medium text-gray-700 block mb-1.5">Agree Button Text</label>
        <InputText v-model="evtTCDraft.agreeText" placeholder="e.g. I agree to the Media Release Policy" class="w-full" />
        <p class="text-xs text-gray-400 mt-1">Leave blank to use default: "I agree to the [T&C Name]"</p>
      </div>
    </div>
    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="showEvtTCModal = false" />
      <Button label="Create T&C" :disabled="!evtTCDraft.label.trim()" @click="saveEvtTCDraft" style="background:var(--brand-primary); border-color:var(--brand-primary)" />
    </template>
  </Dialog>
  </div>
</template>
