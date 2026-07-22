<!--
  Reusable attendance surface for one event — extracted verbatim from the event
  page's Attendance tab so the simple /events/view/:id page and the full editor
  share ONE implementation. Self-contained: given an eventId it loads its own
  event / invitees / sessions / sub-groups / per-session attendance via the seams.

  Attendance model (unchanged from the page):
   - Event WITH sessions → per-session `attendance` table (useAttendanceApi).
   - Event WITHOUT sessions → the event-level `invitees.attended` flag.
  Parent can drive the selected session cross-tab via defineExpose({ selectSession }).
-->
<script setup lang="ts">
import { useToast } from 'primevue/usetoast'

// `fit`: size to content (capped + scroll) instead of filling the parent — for the
// simple run-the-event view, so a short roster doesn't leave a tall empty box.
const props = defineProps<{ eventId: string; fit?: boolean; clubOrgId?: string | null }>()

const eventsApi = useEventsApi()
const attendanceApi = useAttendanceApi()
const groupsApi = useGroupsApi()
const { ensureTerms, t } = useTerms()
void ensureTerms()
const toast = useToast()
const { orgId } = useOrg()

// ---- Core data (loaded per eventId) ----
const event = ref<any>(null)
const invitees = ref<any[]>([])
const inviteesLoading = ref(true)
const sessions = ref<any[]>([])

// Notes permissions (per-row <PersonNotes>)
const rbacNotes = useCan()
const canEditNotes = computed(() => rbacNotes.can('notes', 'update'))
const canDeleteNotes = computed(() => rbacNotes.can('notes', 'delete'))
const attNoteLinks = computed(() => [{ type: 'event', id: props.eventId, label: event.value?.title || 'Event' }])
const attNoteContextLabel = computed(() => event.value?.title || 'Event')
const attNoteCounts = ref<Record<string, number>>({})
async function loadAttNoteCounts() {
  const personIds = invitees.value.map((inv: any) => inv.person_id).filter(Boolean)
  if (!personIds.length) { attNoteCounts.value = {}; return }
  const data = await useCirclesApi().notesForPeople(personIds)
  const counts: Record<string, number> = {}
  for (const n of (data ?? [])) if (Array.isArray(n.links) && n.links.some((l: any) => l.type === 'event' && l.id === props.eventId)) counts[n.personId] = (counts[n.personId] || 0) + 1
  attNoteCounts.value = counts
}

// camelCase (seam) → snake_case (the shape this UI reads), shallow.
function snakeRow(r: any) {
  if (!r || typeof r !== 'object') return r
  const out: any = {}
  for (const k in r) out[k.replace(/[A-Z]/g, c => '_' + c.toLowerCase())] = r[k]
  return out
}

// Non-configurable invite Status (NOT in the Columns picker): where each invitee sits
// in the invite → response lifecycle, derived from the row (no extra load):
//   CONFIRMED → Accepted · DECLINED → Declined · sent-not-answered → Invited · else Not sent.
function inviteStatus(inv: any): { label: string; cls: string } {
  const s = String(inv?.status || '').toUpperCase()
  if (s === 'CONFIRMED') return { label: 'Accepted', cls: 'bg-emerald-100 text-emerald-700' }
  if (s === 'DECLINED') return { label: 'Declined', cls: 'bg-red-100 text-red-600' }
  if (inv?.invite_sent_at) return { label: 'Invited', cls: 'bg-blue-100 text-blue-700' }
  return { label: 'Not sent', cls: 'bg-gray-100 text-gray-500' }
}

// ---- Session-level attendance ----
const selectedAttendanceSessionId = ref<string | null>(null)
const sessionAttendanceData = ref<Record<string, Record<string, any>>>({}) // sessionId → inviteeId → row

const attendanceViewModes = [
  { label: 'All', value: 'all', icon: 'pi-list' },
  { label: 'Sub Groups', value: 'sub_groups', icon: 'pi-sitemap' },
  { label: 'By Group', value: 'member_groups', icon: 'pi-th-large' },
]
const attendanceViewMode = ref<'all' | 'sub_groups' | 'member_groups'>('all')
const inviteOpen = ref(false)

// ---- Inline add-person row (pinned above the roster) ----
// "Add person" reveals an inline search row here; "More" opens the full invite modal.
const peopleApi = usePeopleApi()
const showInlineAdd = ref(false)
const inlineAddPerson = ref<any>(null)
const inlineAddOptions = ref<any[]>([])
const inlineAddBusy = ref(false)
async function searchInlinePeople(e: { query: string }) {
  const q = (e.query || '').trim()
  const oid = props.clubOrgId || orgId.value
  if (!oid) { inlineAddOptions.value = []; return }
  const rows = await peopleApi.list(oid, { q, limit: 20 })
  const have = new Set(invitees.value.map((i: any) => i.person_id))
  inlineAddOptions.value = (rows || [])
    .filter((p: any) => !have.has(p.id))
    .map((p: any) => ({ id: p.id, name: [p.firstName, p.lastName].filter(Boolean).join(' ') || p.email || 'Unnamed', email: p.email }))
}
// A recurring event = a master + weekly children. Adding a person can target just this
// occurrence or this + every following one, so the invitee lands on the whole series.
const isRecurring = computed(() => !!(event.value?.recurrence_rule || event.value?.recurrence_parent_id))
const addScopeOpen = ref(false)
const addScope = ref<'this' | 'following'>('following')   // default = the whole run
const pendingAddPerson = ref<any>(null)

async function addInviteeToEvents(p: any, eventIds: string[]): Promise<number> {
  let ok = 0
  for (const eid of eventIds) {
    // best-effort per event — a person already on an occurrence just no-ops
    try { await eventsApi.addInvitee(eid, { personId: p.id, status: 'INVITED', clubOrgId: props.clubOrgId }); ok++ }
    catch { /* already invited on that occurrence */ }
  }
  return ok
}
async function doAddInline(p: any, eventIds: string[]) {
  inlineAddBusy.value = true
  try {
    const ok = await addInviteeToEvents(p, eventIds)
    inlineAddPerson.value = null
    inlineAddOptions.value = []
    addScopeOpen.value = false
    pendingAddPerson.value = null
    await loadInvitees()
    toast.add({ severity: 'success', summary: 'Added', detail: eventIds.length > 1 ? `${p.name} added to ${ok} events` : `${p.name} added`, life: 2500 })
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Could not add person', detail: err?.message || 'Please try again', life: 4000 })
  } finally {
    inlineAddBusy.value = false
  }
}
async function addInlinePerson() {
  const p = inlineAddPerson.value
  if (!p || typeof p !== 'object' || !p.id || inlineAddBusy.value) return
  if (isRecurring.value) { pendingAddPerson.value = p; addScope.value = 'following'; addScopeOpen.value = true; return }
  await doAddInline(p, [props.eventId])
}
// Resolve the chosen scope into a concrete list of event ids, then add.
async function confirmAddScope() {
  const p = pendingAddPerson.value
  if (!p) return
  if (addScope.value === 'this') { await doAddInline(p, [props.eventId]); return }
  const master = event.value?.recurrence_parent_id || props.eventId
  const rows = await eventsApi.series(master).catch(() => [] as any[])
  const cur = event.value?.start_at || event.value?.startAt || null
  const ids = rows
    .filter((r: any) => !cur || !r.startAt || r.startAt >= cur)   // this occurrence + every later one
    .map((r: any) => r.id)
  if (!ids.includes(props.eventId)) ids.push(props.eventId)
  await doAddInline(p, ids.length ? ids : [props.eventId])
}
function openMoreInvite() { inviteOpen.value = true }

// ---- Club logo for the printed roll header ----
const orgsApiForLogo = useOrganisationsApi()
const orgLogoUrl = ref<string | null>(null)
async function loadOrgLogo() {
  const oid = props.clubOrgId || orgId.value
  if (!oid) return
  try {
    const o: any = await orgsApiForLogo.get(oid)
    orgLogoUrl.value = o?.logoUrl || o?.iconUrl || null
  } catch { /* logo is best-effort — never block the roll */ }
}
// Printed roll header text: "Sat 5 Jul 2026 · 9:00 AM – 11:00 AM"
const rollHeaderWhen = computed(() => {
  const s = event.value?.startAt || event.value?.start_at
  if (!s) return ''
  const d = new Date(s)
  const date = d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  const time = (v: any) => new Date(v).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
  const e = event.value?.endAt || event.value?.end_at
  return event.value?.allDay ? date : `${date} · ${time(s)}${e ? ` – ${time(e)}` : ''}`
})
const expandedMemberGroups = ref<Record<string, boolean>>({})
const memberGroupsForInvitees = ref<{ personId: string; group: { id: string; name: string; color: string } }[]>([])

const attendanceSessions = computed(() =>
  [...sessions.value.filter((s: any) => !s.is_master)].sort((a: any, b: any) => {
    if (!a.start_at) return 1
    if (!b.start_at) return -1
    return new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
  })
)
const attendanceInSessionMode = computed(() => attendanceSessions.value.length > 0)
const activeSessionAttendanceMap = computed(() =>
  selectedAttendanceSessionId.value ? (sessionAttendanceData.value[selectedAttendanceSessionId.value] ?? {}) : {}
)

function isAttendedForContext(inv: any) {
  if (attendanceInSessionMode.value) {
    if (!selectedAttendanceSessionId.value) return false
    return !!activeSessionAttendanceMap.value[inv.id]
  }
  return !!inv.attended
}

async function selectAttendanceSession(sessionId: string) {
  selectedAttendanceSessionId.value = sessionId
  if (!sessionAttendanceData.value[sessionId]) {
    const rows = (await attendanceApi.bySession(sessionId)).map(r => ({ ...r, person_id: r.personId }))
    const personIdToRow: Record<string, any> = {}
    for (const row of rows) personIdToRow[row.person_id] = row
    const map: Record<string, any> = {}
    for (const inv of invitees.value) {
      if (inv.person_id && personIdToRow[inv.person_id]) map[inv.id] = personIdToRow[inv.person_id]
    }
    sessionAttendanceData.value = { ...sessionAttendanceData.value, [sessionId]: map }
  }
}

async function toggleSessionAttendance(inv: any, sessionId: string) {
  if (!inv.person_id) {
    toast.add({ severity: 'warn', summary: 'No member linked', detail: 'This invitee has no person record, so per-session attendance cannot be recorded.', life: 4000 })
    return
  }
  const map = sessionAttendanceData.value[sessionId] ?? {}
  if (map[inv.id]) {
    await attendanceApi.remove(map[inv.id].id)
    const updated = { ...map }
    delete updated[inv.id]
    sessionAttendanceData.value = { ...sessionAttendanceData.value, [sessionId]: updated }
  } else {
    const created = await attendanceApi.create({ personId: inv.person_id, sessionId, eventId: props.eventId, attended: true })
    const row = { ...created, person_id: created.personId }
    sessionAttendanceData.value = { ...sessionAttendanceData.value, [sessionId]: { ...map, [inv.id]: row } }
  }
}

async function toggleAttendance(inv: any) {
  if (attendanceInSessionMode.value) {
    if (!selectedAttendanceSessionId.value) await selectAttendanceSession(attendanceSessions.value[0].id)
    if (selectedAttendanceSessionId.value) { await toggleSessionAttendance(inv, selectedAttendanceSessionId.value); return }
  }
  const newVal = !inv.attended
  await eventsApi.updateInvitee(inv.id, { attended: newVal })
  inv.attended = newVal
}

const memberGroupAttendanceSections = computed(() => {
  const personGroupMap: Record<string, { id: string; name: string; color: string } | null> = {}
  for (const inv of filteredSortedAttendees.value) {
    if (!inv.person_id) continue
    const entry = memberGroupsForInvitees.value.find(m => m.personId === inv.person_id)
    personGroupMap[inv.id] = entry?.group ?? null
  }
  const groupMap: Record<string, { group: { id: string; name: string; color: string } | null; invitees: any[] }> = {}
  for (const inv of filteredSortedAttendees.value) {
    const grp = personGroupMap[inv.id]
    const key = grp?.id ?? '__none__'
    if (!groupMap[key]) groupMap[key] = { group: grp, invitees: [] }
    groupMap[key].invitees.push(inv)
  }
  return Object.values(groupMap).sort((a, b) => {
    if (!a.group) return 1; if (!b.group) return -1
    return (a.group.name ?? '').localeCompare(b.group.name ?? '')
  })
})

function collapseAllAttendanceGroups() {
  if (attendanceViewMode.value === 'member_groups') {
    for (const sec of memberGroupAttendanceSections.value) expandedMemberGroups.value[sec.group?.id ?? '__none__'] = false
  } else {
    for (const grp of effectiveSubGroups.value) expandedSubGroups[grp.id] = false
  }
}
function expandAllAttendanceGroups() {
  if (attendanceViewMode.value === 'member_groups') {
    for (const sec of memberGroupAttendanceSections.value) expandedMemberGroups.value[sec.group?.id ?? '__none__'] = true
  } else {
    for (const grp of effectiveSubGroups.value) expandedSubGroups[grp.id] = true
  }
}
const allAttendanceGroupsCollapsed = computed(() => {
  if (attendanceViewMode.value === 'member_groups') {
    return memberGroupAttendanceSections.value.every(sec => expandedMemberGroups.value[sec.group?.id ?? '__none__'] === false)
  }
  return effectiveSubGroups.value.every(grp => expandedSubGroups[grp.id] === false)
})

async function setAttendanceViewMode(mode: 'all' | 'sub_groups' | 'member_groups') {
  attendanceViewMode.value = mode
  if (mode === 'member_groups' && !memberGroupsForInvitees.value.length) {
    const personIds = invitees.value.map((inv: any) => inv.person_id).filter(Boolean)
    if (personIds.length) {
      const data = await groupsApi.groupsForPersons(personIds)
      memberGroupsForInvitees.value = (data ?? []).map((m) => ({ personId: m.personId, group: m.group }))
    }
  }
}

// ---- Attendance selection / list ----
const attendanceSelected = ref<string[]>([])
const attendanceSelectAll = ref(false)
const attendanceSearch = ref('')
const attendanceSort = ref<{ dir: 'asc' | 'desc' }>({ dir: 'asc' })
function toggleAttendanceSort() { attendanceSort.value.dir = attendanceSort.value.dir === 'asc' ? 'desc' : 'asc' }

const filteredSortedAttendees = computed(() => {
  const q = attendanceSearch.value.trim().toLowerCase()
  let result = invitees.value
  if (q) {
    result = result.filter(inv => {
      const name = `${inv.person?.first_name ?? ''} ${inv.person?.last_name ?? ''}`.toLowerCase()
      return name.includes(q)
    })
  }
  return [...result].sort((a, b) => {
    const nameA = `${a.person?.last_name ?? ''} ${a.person?.first_name ?? ''}`.toLowerCase()
    const nameB = `${b.person?.last_name ?? ''} ${b.person?.first_name ?? ''}`.toLowerCase()
    return attendanceSort.value.dir === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA)
  })
})
const attendedCount = computed(() => invitees.value.filter(i => i.attended).length)

// ── Columns: any person detail can be surfaced ──
// Every column that CAN be shown: event data (ticket/paid) + person details + each
// custom field the club has defined. `auto` sets the default (shown when the data
// exists); the Columns selector overrides per session. `get(inv)` reads the value.
const colMenu = ref()
const colOverride = reactive<Record<string, boolean>>({})
const customFieldDefs = ref<{ key: string; label: string }[]>([])
const { loadFieldCatalogue } = usePersonFields()
async function loadFieldDefs() {
  if (!orgId.value) { customFieldDefs.value = []; return }
  try {
    const cat = await loadFieldCatalogue(orgId.value, null)
    customFieldDefs.value = cat.filter((f: any) => f.source === 'custom').map((f: any) => ({ key: String(f.key), label: f.label }))
  } catch { customFieldDefs.value = [] }
}
const allColumns = computed<{ key: string; label: string; type: string; get: (inv: any) => any; auto: () => boolean }[]>(() => {
  // Ticket type / Paid only exist when the event can actually handle them — a ticketed
  // event (has_tickets) or one that's collected a real fee. Otherwise they're not offered.
  const hasTickets = !!event.value?.has_tickets
  const hasFees = hasTickets || invitees.value.some(i => Number(i.fee_amount) > 0 || i.paid_at)
  return [
  ...(hasTickets ? [{ key: 'ticket', label: 'Ticket type', type: 'text', get: (inv: any) => inv.ticket_type, auto: () => true }] : []),
  ...(hasFees ? [{ key: 'paid', label: 'Paid', type: 'paid', get: (inv: any) => inv.paid_at, auto: () => true }] : []),
  { key: 'age', label: 'Age', type: 'text', get: (inv) => inv.person?.dob ? (ageFromDob(inv.person.dob) ?? null) : null, auto: () => invitees.value.some(i => i.person?.dob) },
  { key: 'gender', label: 'Gender', type: 'text', get: (inv) => inv.person?.gender, auto: () => invitees.value.some(i => i.person?.gender) },
  { key: 'phone', label: 'Phone', type: 'text', get: (inv) => inv.person?.phone, auto: () => false },
  { key: 'phone2', label: 'Secondary phone', type: 'text', get: (inv) => inv.person?.phone2, auto: () => false },
  { key: 'email', label: 'Email', type: 'text', get: (inv) => inv.person?.email, auto: () => false },
  { key: 'membership', label: 'Membership', type: 'text', get: (inv) => inv.person?.membership_type, auto: () => false },
  { key: 'photo', label: 'Photo', type: 'photo', get: (inv) => inv.person?.photo_url, auto: () => invitees.value.some(i => i.person?.photo_url) },
  ...customFieldDefs.value.map(f => ({ key: 'cf:' + f.key, label: f.label, type: 'text', get: (inv: any) => inv.person?.custom_fields?.[f.key], auto: () => false })),
  ]
})
function colVisible(key: string) {
  if (key in colOverride) return colOverride[key]
  return allColumns.value.find(c => c.key === key)?.auto() ?? false
}
// Column choices persist per club (localStorage) automatically — toggling a column
// remembers it; reloaded on mount so the selection sticks across events/sessions.
const colsKey = () => `fm_attendance_cols_${orgId.value || ''}`
function persistColumns() {
  try { localStorage.setItem(colsKey(), JSON.stringify(colOverride)) } catch { /* ignore */ }
}
function loadSavedColumns() {
  try {
    const raw = localStorage.getItem(colsKey())
    if (raw) Object.assign(colOverride, JSON.parse(raw))
  } catch { /* ignore bad json */ }
}
function toggleCol(key: string) { colOverride[key] = !colVisible(key); persistColumns() }
const visibleColumns = computed(() => allColumns.value.filter(c => colVisible(c.key)))
// Fixed cols: drag + select + Members + Status + Signed-in + Out + actions = 7, plus the visible optional cols.
const colCount = computed(() => 7 + visibleColumns.value.length)

function toggleAttendanceSelectAll() {
  attendanceSelected.value = attendanceSelectAll.value ? invitees.value.map(i => i.id) : []
}
async function toggleSignOut(inv: any) {
  if (!isAttendedForContext(inv)) {
    toast.add({ severity: 'warn', summary: 'Sign in first', detail: 'Please mark this person as signed in before signing them out.', life: 3000 })
    return
  }
  const newVal = !inv.signed_out
  await eventsApi.updateInvitee(inv.id, { signedOut: newVal })
  inv.signed_out = newVal
}
async function markSelectedIn() {
  if (attendanceInSessionMode.value && selectedAttendanceSessionId.value) {
    const sid = selectedAttendanceSessionId.value
    const map = sessionAttendanceData.value[sid] ?? {}
    const inviteesById: Record<string, any> = {}
    for (const i of invitees.value) inviteesById[i.id] = i
    const toInsert = attendanceSelected.value.filter(id => !map[id]).map(id => inviteesById[id]).filter((inv: any) => inv?.person_id)
    if (toInsert.length) {
      const created = await attendanceApi.createMany(toInsert.map((inv: any) => ({ personId: inv.person_id, sessionId: sid, eventId: props.eventId, attended: true })))
      const data = created.map(r => ({ ...r, person_id: r.personId }))
      const next = { ...map }
      const personIdToInviteeId: Record<string, string> = {}
      for (const inv of invitees.value) if (inv.person_id) personIdToInviteeId[inv.person_id] = inv.id
      for (const row of data) { const invId = personIdToInviteeId[row.person_id]; if (invId) next[invId] = row }
      sessionAttendanceData.value = { ...sessionAttendanceData.value, [sid]: next }
    }
  } else {
    await Promise.all(attendanceSelected.value.map(invId => eventsApi.updateInvitee(invId, { attended: true })))
    invitees.value.forEach(i => { if (attendanceSelected.value.includes(i.id)) i.attended = true })
  }
  attendanceSelected.value = []
  attendanceSelectAll.value = false
}

// Only people who are actually signed IN (and not already out) can be signed out —
// signing out someone who never arrived is meaningless, which is exactly what the
// single-row action refuses to do. So the bulk button appears only when the
// selection contains someone it can act on, and it silently skips the rest.
const selectedSignedIn = computed(() => invitees.value.filter(
  i => attendanceSelected.value.includes(i.id) && isAttendedForContext(i) && !i.signed_out,
))
async function markSelectedOut() {
  const targets = selectedSignedIn.value
  if (!targets.length) return
  await Promise.all(targets.map(inv => eventsApi.updateInvitee(inv.id, { signedOut: true })))
  targets.forEach(inv => { inv.signed_out = true })
  toast.add({
    severity: 'success',
    summary: `Signed out ${targets.length} ${targets.length === 1 ? 'person' : 'people'}`,
    life: 2000,
  })
  attendanceSelected.value = []
  attendanceSelectAll.value = false
}

function openInviteeEmail(inv: any) {
  const email = inv.person?.email
  if (email) window.location.href = `mailto:${email}`
  else toast.add({ severity: 'warn', summary: 'No email', detail: 'This person has no email on file.', life: 3000 })
}
// Print ONLY the roll table: a body class scopes the @media print rules (main.css)
// that hide the rest of the page + the checkbox/drag/actions columns, and repeat the
// header on every page. Class is cleared after printing (or on cancel via afterprint).
function printAttendanceRoll() {
  const el = document.querySelector('.roll-print-area') as HTMLElement | null
  if (!el) return
  // Move the table to be a direct child of <body> so it prints in NORMAL FLOW and
  // paginates (an absolutely-positioned table drops every page after the first). A
  // comment marks where to slot it back afterwards.
  const slot = document.createComment('roll-print-slot')
  el.parentNode?.replaceChild(slot, el)
  document.body.appendChild(el)
  document.body.classList.add('printing-roll')
  if (!printStatus.value) document.body.classList.add('print-no-status')
  if (printSignStyle.value === 'sign') document.body.classList.add('print-sign-time')
  // Orientation from the preview drawer — injected + removed per print.
  const style = document.createElement('style')
  style.id = 'roll-print-page'
  style.textContent = `@page { size: ${printOrientation.value}; margin: 12mm; }`
  document.head.appendChild(style)
  const done = () => {
    document.body.classList.remove('printing-roll', 'print-no-status', 'print-sign-time')
    document.getElementById('roll-print-page')?.remove()
    slot.parentNode?.replaceChild(el, slot)   // put the table back where it lives
    window.removeEventListener('afterprint', done)
  }
  window.addEventListener('afterprint', done)
  window.print()
}

// ── #25 In-app print PREVIEW + config drawer ──
// "Print Roll" opens a preview sheet with a right-hand drawer to set orientation +
// which columns show (the checkboxes drive the same colVisible the live table uses,
// so the preview and the real print stay in sync). "Print" fires the real print.
const printPreviewOpen = ref(false)
const printOrientation = ref<'landscape' | 'portrait'>('landscape')
const printStatus = ref(true)                              // #37 include the Status column
const printSignStyle = ref<'tick' | 'sign'>('tick')        // #36 tick boxes vs sign + time
const previewInvitees = computed(() => invitees.value.slice(0, 40))
function doPrintFromPreview() {
  printPreviewOpen.value = false
  nextTick(() => printAttendanceRoll())
}

// ── #30 bulk-action bar helper ──
function clearAttendanceSelection() { attendanceSelected.value = []; attendanceSelectAll.value = false }

// ── #18 quick add-invitee (single person by name; the full picker is behind a button) ──
// (peopleApi is declared with the inline-add-row state above.)
const quickPeople = ref<any[]>([])
const quickSel = ref<any>(null)
const quickAdding = ref(false)
const showFullInvite = ref(false)
async function searchQuickPeople(e: { query: string }) {
  const q = (e.query || '').trim()
  if (!orgId.value || !q) { quickPeople.value = []; return }
  quickPeople.value = await peopleApi.list(orgId.value, { q, limit: 12 }).catch(() => [])
}
async function addQuickPerson() {
  const p = quickSel.value
  if (!p || typeof p !== 'object' || !p.id || quickAdding.value) return
  quickAdding.value = true
  try {
    await eventsApi.addInvitee(props.eventId, { personId: p.id, status: 'INVITED', role: 'attendee', roles: ['attendee'], clubOrgId: props.clubOrgId })
    toast.add({ severity: 'success', summary: `${((p.firstName || '') + ' ' + (p.lastName || '')).trim() || 'Person'} added`, life: 2000 })
    quickSel.value = null
    await load()
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Could not add', detail: err?.message, life: 3000 })
  } finally { quickAdding.value = false }
}
// Reset the quick-add / full-picker state each time the dialog opens.
watch(inviteOpen, v => { if (v) { showFullInvite.value = false; quickSel.value = null; quickPeople.value = [] } })

// ---- Attendance action menu ----
const attendanceActionMenu = ref()
const attendanceActionMenuItems = computed(() => [
  { label: 'Mark Selected In', icon: 'pi pi-check', command: markSelectedIn },
  { label: 'Sign Selected Out', icon: 'pi pi-sign-out', command: markSelectedOut, disabled: !selectedSignedIn.value.length },
  { separator: true },
  { label: 'Assign to Sub-group', icon: 'pi pi-user-plus', command: () => { showAddToSubGroupDialog.value = true } },
])

// ---- Check-in QR ----
const showCheckinQrDialog = ref(false)
const qrCanvas = ref<HTMLCanvasElement | null>(null)
const qrUrl = computed(() => {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}/events/${props.eventId}/check-in`
})
async function openQrDialog() {
  showCheckinQrDialog.value = true
  await nextTick()
  if (qrCanvas.value) {
    const QRCode = (await import('qrcode')).default
    QRCode.toCanvas(qrCanvas.value, qrUrl.value, { width: 280, margin: 2, color: { dark: '#1E2157', light: '#ffffff' } })
  }
}
function downloadQr() {
  if (!qrCanvas.value) return
  const link = document.createElement('a')
  link.download = `${event.value?.title ?? 'event'}-checkin-qr.png`
  link.href = qrCanvas.value.toDataURL('image/png')
  link.click()
}

// ---- Assign to sub-group ----
const showAddToSubGroupDialog = ref(false)
const addToSubGroupTarget = ref<string | null>(null)
const addToSubGroupPeople = computed(() => attendanceSelected.value.map(id => invitees.value.find(i => i.id === id)).filter(Boolean))
async function executeAddToSubGroup() {
  for (const invId of attendanceSelected.value) {
    inviteeGroupMap.value[invId] = addToSubGroupTarget.value
    await eventsApi.updateInvitee(invId, { subGroupId: addToSubGroupTarget.value })
  }
  attendanceSelected.value = []
  attendanceSelectAll.value = false
  showAddToSubGroupDialog.value = false
  addToSubGroupTarget.value = null
}

// ---- Sub Groups ----
const subGroups = ref<{ id: string; name: string; color: string; managers?: { id: string; name: string }[]; session_ids?: string[] | null }[]>([])
const inviteeGroupMap = ref<Record<string, string | null>>({})
const expandedSubGroups = reactive<Record<string, boolean>>({})
const showSubGroupsDialog = ref(false)
const addingManagerForGroup = reactive<Record<string, string | null>>({})
const newGroupName = ref('')
const newGroupColor = ref('#3B82F6')
const newGroupScope = ref<'all' | 'this' | 'multiple'>('all')
const newGroupSessionIds = ref<string[]>([])
const draggingInviteeId = ref<string | null>(null)
const draggingMultiple = ref(false)
const dragOverGroupId = ref<string>('__none__')
const groupColorPalette = ['#3B82F6', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B', '#10B981', '#06B6D4', '#F97316']

const effectiveSubGroups = computed(() => {
  const sid = selectedAttendanceSessionId.value
  return subGroups.value.filter(g => {
    if (!g.session_ids || g.session_ids.length === 0) return true
    if (!sid) return false
    return g.session_ids.includes(sid)
  })
})
const groupedInvitees = computed(() => {
  const ungrouped = invitees.value.filter(inv => !inviteeGroupMap.value[inv.id])
  const groups = effectiveSubGroups.value.map(g => ({ group: g, invitees: invitees.value.filter(inv => inviteeGroupMap.value[inv.id] === g.id) }))
  return { ungrouped, groups }
})
function addSubGroup() {
  if (!newGroupName.value.trim()) return
  let sessionIds: string[] | null = null
  if (newGroupScope.value === 'this' && selectedAttendanceSessionId.value) sessionIds = [selectedAttendanceSessionId.value]
  else if (newGroupScope.value === 'multiple') sessionIds = [...newGroupSessionIds.value]
  subGroups.value.push({ id: crypto.randomUUID(), name: newGroupName.value.trim(), color: newGroupColor.value, session_ids: sessionIds })
  newGroupName.value = ''
  newGroupColor.value = '#3B82F6'
  newGroupScope.value = 'all'
  newGroupSessionIds.value = []
}
function removeSubGroup(groupId: string) {
  subGroups.value = subGroups.value.filter(g => g.id !== groupId)
  Object.keys(inviteeGroupMap.value).forEach(invId => { if (inviteeGroupMap.value[invId] === groupId) delete inviteeGroupMap.value[invId] })
}
function availableManagersFor(grp: typeof subGroups.value[0]) {
  const existing = new Set((grp.managers ?? []).map(m => m.id))
  return invitees.value.filter(inv => inv.person && !existing.has(inv.person.id)).map(inv => ({ id: inv.person.id, full_name: `${inv.person.first_name} ${inv.person.last_name}` }))
}
function onAddManager(groupId: string, personId: string) {
  const grp = subGroups.value.find(g => g.id === groupId)
  if (!grp || !personId) return
  const inv = invitees.value.find(i => i.person?.id === personId)
  if (!inv) return
  if (!grp.managers) grp.managers = []
  grp.managers.push({ id: personId, name: `${inv.person.first_name} ${inv.person.last_name}` })
  addingManagerForGroup[groupId] = null
}
function removeSubGroupManager(groupId: string, personId: string) {
  const grp = subGroups.value.find(g => g.id === groupId)
  if (!grp) return
  grp.managers = (grp.managers ?? []).filter(m => m.id !== personId)
}
const savingSubGroups = ref(false)
async function saveSubGroups() {
  savingSubGroups.value = true
  const error = await eventsApi.update(props.eventId, { subGroups: subGroups.value }).then(() => null).catch((e: any) => e)
  if (error) toast.add({ severity: 'error', summary: 'Save failed', detail: error.message, life: 3000 })
  savingSubGroups.value = false
  showSubGroupsDialog.value = false
}
function onDragStart(e: DragEvent, invId: string) {
  draggingInviteeId.value = invId
  draggingMultiple.value = attendanceSelected.value.includes(invId) && attendanceSelected.value.length > 1
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}
async function onDropOnGroup(groupId: string | null) {
  const ids = draggingMultiple.value ? [...attendanceSelected.value] : draggingInviteeId.value ? [draggingInviteeId.value] : []
  for (const dId of ids) {
    if (groupId === null) delete inviteeGroupMap.value[dId]
    else inviteeGroupMap.value[dId] = groupId
    await eventsApi.updateInvitee(dId, { subGroupId: groupId })
  }
  if (draggingMultiple.value) { attendanceSelected.value = []; attendanceSelectAll.value = false }
  draggingInviteeId.value = null
  draggingMultiple.value = false
  dragOverGroupId.value = '__none__'
}

// ---- Loaders ----
async function loadEvent() {
  const data = await eventsApi.get(props.eventId).then(snakeRow).catch(() => null)
  event.value = data
  subGroups.value = Array.isArray(data?.sub_groups) ? data.sub_groups : []
}
async function loadSessions() {
  const all = (await eventsApi.sessions(props.eventId).catch(() => [])).map(snakeRow)
  sessions.value = all.filter((s: any) => s.parent_session_id == null)
}
async function loadInvitees() {
  inviteesLoading.value = true
  invitees.value = (await eventsApi.inviteesWithPerson(props.eventId, props.clubOrgId)).map((inv: any) => ({
    ...inv,
    person_id: inv.personId,
    sub_group_id: inv.subGroupId,
    signed_out: inv.signedOut,
    person: inv.person ? { id: inv.person.id, first_name: inv.person.firstName, last_name: inv.person.lastName, email: inv.person.email, dob: inv.person.dateOfBirth, gender: inv.person.gender, photo_url: inv.person.photoUrl, phone: inv.person.phone, phone2: inv.person.phone2, membership_type: inv.person.membershipType, custom_fields: inv.person.customFields } : null,
  }))
  memberGroupsForInvitees.value = []
  const map: Record<string, string> = {}
  for (const inv of invitees.value) if (inv.sub_group_id) map[inv.id] = inv.sub_group_id
  inviteeGroupMap.value = map
  inviteesLoading.value = false
  loadAttNoteCounts()
  await cleanupLegacyEventLevelAttendance()
}
async function cleanupLegacyEventLevelAttendance() {
  if (!sessions.value.length) return
  if (!attendanceInSessionMode.value) return
  const stale = invitees.value.filter((i: any) => i.attended)
  if (!stale.length) return
  await Promise.all(stale.map((i: any) => eventsApi.updateInvitee(i.id, { attended: false })))
  for (const i of stale) i.attended = false
}

// #34 — seed the visible columns from the event's CATEGORY default_columns, but only
// when the user has no saved preference of their own. Precedence: user's saved columns
// (localStorage, loaded on mount) > category default > code auto() defaults.
async function applyCategoryColumnDefaults() {
  if (Object.keys(colOverride).length) return
  const ev: any = event.value
  const catId = ev?.category_id || (Array.isArray(ev?.category_ids) ? ev.category_ids[0] : null)
  if (!catId || !orgId.value) return
  const cats = await eventsApi.categories(orgId.value).catch(() => [] as any[])
  const cols = (cats.find((c: any) => c.id === catId) as any)?.defaultColumns
  if (!Array.isArray(cols) || !cols.length) return
  for (const c of allColumns.value) colOverride[c.key] = cols.includes(c.key)
}

async function load() {
  selectedAttendanceSessionId.value = null
  sessionAttendanceData.value = {}
  await Promise.all([loadEvent(), loadSessions(), loadFieldDefs()])
  await applyCategoryColumnDefaults()
  await loadInvitees()
  if (attendanceInSessionMode.value && !selectedAttendanceSessionId.value && attendanceSessions.value.length) {
    await selectAttendanceSession(attendanceSessions.value[0].id)
  }
}
onMounted(() => { rbacNotes.load(); loadSavedColumns(); load(); loadOrgLogo() })
watch(orgId, () => loadSavedColumns())
watch(() => props.eventId, () => load())

// Let a parent drive the session (event page's "Take attendance") or force a reload
// (the simple view after inviting more people).
defineExpose({ selectSession: selectAttendanceSession, reload: load })
</script>

<template>
  <div class="flex flex-col lg:flex-row min-h-0" :class="fit ? '' : 'flex-1 overflow-hidden'">

    <!-- Mobile: session dropdown chooser -->
    <div v-if="attendanceInSessionMode" class="lg:hidden bg-white border-b border-gray-200 px-3 py-2.5 shrink-0">
      <Select :modelValue="selectedAttendanceSessionId" :options="attendanceSessions" optionValue="id" class="w-full"
        @update:modelValue="sid => selectAttendanceSession(sid)">
        <template #value="{ value }">
          <span v-if="value" class="text-sm truncate block">{{ (() => { const s = attendanceSessions.find(x => x.id === value); return s ? ((s.start_at ? new Date(s.start_at).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) + ' — ' : '') + (s.title || 'Untitled') + ` · ${Object.values(sessionAttendanceData[s.id] ?? {}).length}/${invitees.length}`) : 'Select session' })() }}</span>
          <span v-else class="text-sm text-gray-400">Select session</span>
        </template>
        <template #option="{ option }">
          <span class="text-sm">{{ (option.start_at ? new Date(option.start_at).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) + ' — ' : '') + (option.title || 'Untitled') }} · {{ Object.values(sessionAttendanceData[option.id] ?? {}).length }}/{{ invitees.length }}</span>
        </template>
      </Select>
    </div>

    <!-- Left: Session list (desktop) -->
    <div v-if="attendanceInSessionMode"
      class="w-full lg:w-[260px] shrink-0 border-b lg:border-b-0 lg:border-r border-gray-200 bg-white hidden lg:flex flex-col overflow-hidden lg:flex-1 lg:min-h-0">
      <div class="px-4 py-3 border-b border-gray-100 shrink-0">
        <span class="text-sm font-bold text-gray-900">Sessions</span>
      </div>
      <div class="overflow-y-auto p-2 space-y-0.5 max-h-[34vh] lg:max-h-none lg:flex-1">
        <template v-for="(session, sIdx) in attendanceSessions" :key="session.id">
          <div v-if="sIdx > 0 && session.start_at && attendanceSessions[sIdx - 1].start_at &&
            new Date(session.start_at).toDateString() !== new Date(attendanceSessions[sIdx - 1].start_at).toDateString()"
            class="mx-3 my-2 border-t-2 border-gray-100" />
          <div class="group/item flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors select-none"
            :class="{ 'bg-primary text-white shadow-sm': selectedAttendanceSessionId === session.id, 'hover:bg-gray-100': selectedAttendanceSessionId !== session.id }"
            @click="selectAttendanceSession(session.id)">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium truncate" :class="selectedAttendanceSessionId === session.id ? 'text-white' : 'text-gray-800'">
                <template v-if="session.start_at">{{ new Date(session.start_at).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) }} — </template>{{ session.title || 'Untitled' }}
              </p>
              <p class="text-xs truncate mt-0.5" :class="selectedAttendanceSessionId === session.id ? 'text-white/60' : 'text-gray-400'">
                {{ Object.values(sessionAttendanceData[session.id] ?? {}).length }}/{{ invitees.length }} present
              </p>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Right: Attendance table -->
    <div class="flex-1 min-w-0 flex flex-col bg-white" :class="fit ? '' : 'overflow-hidden'">
    <div class="bg-white rounded-xl border border-gray-200 flex flex-col"
      :class="attendanceInSessionMode ? 'rounded-none border-0 flex-1 overflow-hidden' : (fit ? 'w-full' : 'mx-3 sm:mx-6 mb-4 sm:mb-6 max-w-5xl self-center w-full')">

      <!-- Toolbar -->
      <div class="flex items-center justify-between bg-gray-50 px-4 py-2.5 border-b border-gray-200 shrink-0">
        <div class="flex items-center gap-3">
          <h2 class="text-base font-semibold text-gray-900">
            <template v-if="selectedAttendanceSessionId">{{ attendanceSessions.find(s => s.id === selectedAttendanceSessionId)?.title || 'Attendance' }}</template>
            <template v-else>Attendees</template>
          </h2>
          <IconField>
            <InputIcon class="pi pi-search" />
            <InputText v-model="attendanceSearch" :placeholder="`Search ${t('member', true, true)}…`" size="small" class="w-48" />
          </IconField>
        </div>
        <div class="flex items-center">
          <button class="flex flex-col items-center gap-0.5 px-4 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" @click="showInlineAdd = true">
            <i class="pi pi-user-plus text-lg" /><span class="text-[10px] font-medium">Add person</span>
          </button>
          <button class="flex flex-col items-center gap-0.5 px-4 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" @click="printPreviewOpen = true">
            <i class="pi pi-print text-lg" /><span class="text-[10px] font-medium">Print Roll</span>
          </button>
          <button class="flex flex-col items-center gap-0.5 px-4 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" @click="colMenu.toggle($event)">
            <i class="pi pi-table text-lg" /><span class="text-[10px] font-medium">Columns</span>
          </button>
          <Popover ref="colMenu">
            <div class="p-1 w-56 max-h-[60vh] overflow-y-auto">
              <p class="px-2 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Show columns</p>
              <label v-for="c in allColumns" :key="c.key"
                class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer text-sm text-gray-700">
                <Checkbox :model-value="colVisible(c.key)" binary @change="toggleCol(c.key)" />
                {{ c.label }}
              </label>
            </div>
          </Popover>
        </div>
      </div>

      <!-- Inline add-person row: search + Add, or "More" for the full invite modal -->
      <div v-if="showInlineAdd" class="flex items-center gap-2 px-4 py-2.5 border-b border-gray-200 bg-primary/5 shrink-0 no-print">
        <i class="pi pi-user-plus text-gray-400 shrink-0" />
        <AutoComplete v-model="inlineAddPerson" :suggestions="inlineAddOptions" optionLabel="name" :delay="250"
          placeholder="Search for a person…" class="flex-1" inputClass="w-full" forceSelection @complete="searchInlinePeople" />
        <Button label="Add" icon="pi pi-plus" size="small" :loading="inlineAddBusy"
          :disabled="!inlineAddPerson || typeof inlineAddPerson !== 'object'" @click="addInlinePerson"
          style="background:var(--brand-primary); border-color:var(--brand-primary)" />
        <Button label="More" icon="pi pi-users" size="small" outlined @click="openMoreInvite" />
        <button class="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 shrink-0" title="Close" @click="showInlineAdd = false">
          <i class="pi pi-times text-sm" />
        </button>
      </div>

      <div v-if="inviteesLoading" class="py-12 flex justify-center shrink-0"><i class="pi pi-spin pi-spinner text-gray-400 text-xl" /></div>
      <div v-else-if="!invitees.length" class="py-14 text-center text-sm text-gray-400 shrink-0">
        <i class="pi pi-users text-3xl mb-3 block" />No invitees yet
      </div>

      <div v-else class="overflow-auto roll-print-area" :class="fit ? 'max-h-[calc(100vh-19rem)]' : ''">
        <!-- Only shows on the printed roll (a bare title so the sheet has context). -->
        <!-- Print-only roll header (inside the print area so it actually prints):
             event name + date/time on the left, club logo on the right. -->
        <div class="roll-print-title hidden">
          <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:12px;">
            <div>
              <div style="font-size:18px; font-weight:700; color:#111827;">{{ event?.title || 'Attendance roll' }}</div>
              <div v-if="rollHeaderWhen" style="font-size:13px; color:#4b5563;">{{ rollHeaderWhen }}</div>
            </div>
            <img v-if="orgLogoUrl" :src="orgLogoUrl" alt="" style="height:40px; width:auto; object-fit:contain; flex-shrink:0;" />
          </div>
        </div>
        <table class="w-full text-sm">
          <thead class="sticky top-0 z-10 bg-white">
            <tr class="border-b border-gray-200">
              <th class="pl-3 pr-1 py-3 w-8 text-center align-middle">
                <button v-if="attendanceViewMode !== 'all'"
                  class="flex items-center justify-center w-6 h-6 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                  :title="allAttendanceGroupsCollapsed ? 'Expand all groups' : 'Collapse all groups'"
                  @click="allAttendanceGroupsCollapsed ? expandAllAttendanceGroups() : collapseAllAttendanceGroups()">
                  <i class="pi pi-chevron-up text-xs transition-transform duration-200" :class="allAttendanceGroupsCollapsed ? 'rotate-180' : ''" />
                </button>
              </th>
              <th class="pl-1 pr-2 py-3 w-8 text-center align-middle"><Checkbox v-model="attendanceSelectAll" binary @change="toggleAttendanceSelectAll" /></th>
              <th class="py-3 pr-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide w-40">
                <!-- Print-only plain text: a <button>'s label doesn't repaint on repeated thead pages in Chrome, so page 2+ came up blank (#54). -->
                <span class="roll-print-members hidden">Members</span>
                <button class="roll-sort-btn flex items-center gap-1 hover:text-gray-900 transition-colors" @click="toggleAttendanceSort">
                  Members
                  <i :class="`pi text-[10px] ${attendanceSort.dir === 'asc' ? 'pi-sort-up-fill text-primary' : 'pi-sort-down-fill text-primary'}`" />
                </button>
              </th>
              <th class="py-3 pr-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide w-24">Status</th>
              <th v-for="col in visibleColumns" :key="col.key" class="py-3 pr-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{{ col.label }}</th>
              <th class="py-3 pr-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide w-20">Signed In</th>
              <th class="py-3 pr-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide w-16">Out</th>
              <th class="py-3 w-20" />
            </tr>
          </thead>

          <!-- Member group view -->
          <template v-if="attendanceViewMode === 'member_groups'">
            <tbody v-for="mg in memberGroupAttendanceSections" :key="mg.group?.id ?? '__none__'" class="divide-y divide-gray-100">
              <tr class="roll-group-row border-b border-gray-200 cursor-pointer select-none" :style="{ background: (mg.group?.color ?? '#94a3b8') + '18' }"
                @click="expandedMemberGroups[mg.group?.id ?? '__none__'] = !expandedMemberGroups[mg.group?.id ?? '__none__']">
                <td :colspan="colCount" class="px-4 py-2">
                  <div class="flex items-center gap-2">
                    <i class="pi text-xs transition-transform" :class="expandedMemberGroups[mg.group?.id ?? '__none__'] === false ? 'pi-chevron-right' : 'pi-chevron-down'" :style="{ color: mg.group?.color ?? '#94a3b8' }" />
                    <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: mg.group?.color ?? '#94a3b8' }" />
                    <span class="text-xs font-semibold uppercase tracking-wide" :style="{ color: mg.group?.color ?? '#6b7280' }">{{ mg.group?.name ?? `No ${t('group', false)}` }}</span>
                    <span class="text-xs text-gray-400">({{ mg.invitees.length }})</span>
                    <span class="ml-auto text-xs text-gray-400">{{ mg.invitees.filter(inv => isAttendedForContext(inv)).length }}/{{ mg.invitees.length }} present</span>
                  </div>
                </td>
              </tr>
              <template v-if="expandedMemberGroups[mg.group?.id ?? '__none__'] !== false">
                <tr v-for="inv in mg.invitees" :key="inv.id" class="hover:bg-gray-50 transition-colors" :class="{ 'bg-green-50': isAttendedForContext(inv) }">
                  <td class="pl-3 pr-1 py-2.5 w-8 text-center align-middle text-gray-300 cursor-grab"><i class="pi pi-bars text-xs" /></td>
                  <td class="pl-1 pr-2 py-2.5 w-8 text-center align-middle"><Checkbox v-model="attendanceSelected" :value="inv.id" /></td>
                  <td class="py-2.5 pr-3 font-medium"><NuxtLink v-if="inv.person_id" :to="`/people/${inv.person_id}`" class="text-gray-800 hover:text-primary hover:underline">{{ inv.person?.first_name }} {{ inv.person?.last_name }}</NuxtLink><span v-else class="text-gray-800">{{ inv.person?.first_name }} {{ inv.person?.last_name }}</span></td>
                  <td class="py-2.5 pr-3"><span class="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" :class="inviteStatus(inv).cls">{{ inviteStatus(inv).label }}</span></td>
                  <td v-for="col in visibleColumns" :key="col.key" class="py-2.5 pr-3 text-sm text-gray-600">
                    <template v-if="col.type === 'photo'">
                      <img v-if="col.get(inv)" :src="col.get(inv)" class="w-7 h-7 rounded-full object-cover" />
                      <span v-else class="text-gray-300">—</span>
                    </template>
                    <template v-else-if="col.type === 'paid'">
                      <span v-if="inv.paid_at" class="flex items-center gap-1.5"><i class="pi pi-check-circle text-primary" /><span>${{ Number(inv.fee_amount ?? 0).toFixed(2) }}</span></span>
                      <i v-else class="pi pi-times-circle text-red-500" />
                    </template>
                    <span v-else>{{ col.get(inv) ?? '—' }}</span>
                  </td>
                  <td class="py-2.5 pr-3 text-center"><Checkbox :model-value="isAttendedForContext(inv)" binary @change="toggleAttendance(inv)" /></td>
                  <td class="py-2.5 pr-3 text-center"><Checkbox :model-value="inv.signed_out" binary :disabled="!isAttendedForContext(inv)" @change="toggleSignOut(inv)" /></td>
                  <td class="py-2.5">
                    <div class="flex items-center gap-2 text-gray-400">
                      <button class="hover:text-gray-700 transition-colors" v-tooltip.top="'Email'" @click="openInviteeEmail(inv)"><i class="pi pi-envelope text-sm" /></button>
                      <PersonNotes v-if="inv.person_id" :person-id="inv.person_id"
                        :person-name="((inv.person?.first_name || '') + ' ' + (inv.person?.last_name || '')).trim()"
                        :links="attNoteLinks" :context-label="attNoteContextLabel" :can-edit-all="canEditNotes" :can-delete-all="canDeleteNotes"
                        :initial-count="attNoteCounts[inv.person_id] ?? 0" @count-change="v => attNoteCounts[inv.person_id] = v">
                        <template #trigger="{ open, count }">
                          <button class="hover:text-primary transition-colors relative" v-tooltip.top="'Notes'" @click="open">
                            <i class="pi pi-comments text-sm text-primary" />
                            <span v-if="count" class="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-[#1976d2] text-white text-[9px] font-bold flex items-center justify-center">{{ count }}</span>
                          </button>
                        </template>
                      </PersonNotes>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </template>

          <!-- Flat view -->
          <tbody v-else-if="attendanceViewMode === 'all'" class="divide-y divide-gray-100">
            <tr v-for="inv in filteredSortedAttendees" :key="inv.id" draggable="true" @dragstart="onDragStart($event, inv.id)"
              class="hover:bg-gray-50 transition-colors" :class="{ 'bg-green-50': isAttendedForContext(inv) }">
              <td class="pl-3 pr-1 py-2.5 w-8 text-center align-middle text-gray-300 cursor-grab"><i class="pi pi-bars text-xs" /></td>
              <td class="pl-1 pr-2 py-2.5 w-8 text-center align-middle"><Checkbox v-model="attendanceSelected" :value="inv.id" /></td>
              <td class="py-2.5 pr-3 font-medium"><NuxtLink v-if="inv.person_id" :to="`/people/${inv.person_id}`" class="text-gray-800 hover:text-primary hover:underline">{{ inv.person?.first_name }} {{ inv.person?.last_name }}</NuxtLink><span v-else class="text-gray-800">{{ inv.person?.first_name }} {{ inv.person?.last_name }}</span></td>
              <td class="py-2.5 pr-3"><span class="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" :class="inviteStatus(inv).cls">{{ inviteStatus(inv).label }}</span></td>
              <td v-for="col in visibleColumns" :key="col.key" class="py-2.5 pr-3 text-sm text-gray-600">
                <template v-if="col.type === 'photo'">
                  <img v-if="col.get(inv)" :src="col.get(inv)" class="w-7 h-7 rounded-full object-cover" />
                  <span v-else class="text-gray-300">—</span>
                </template>
                <template v-else-if="col.type === 'paid'">
                  <span v-if="inv.paid_at" class="flex items-center gap-1.5"><i class="pi pi-check-circle text-primary" /><span>${{ Number(inv.fee_amount ?? 0).toFixed(2) }}</span></span>
                  <i v-else class="pi pi-times-circle text-red-500" />
                </template>
                <span v-else>{{ col.get(inv) ?? '—' }}</span>
              </td>
              <td class="py-2.5 pr-3 text-center"><Checkbox :model-value="isAttendedForContext(inv)" binary @change="toggleAttendance(inv)" /></td>
              <td class="py-2.5 pr-3 text-center"><Checkbox :model-value="inv.signed_out" binary :disabled="!isAttendedForContext(inv)" @change="toggleSignOut(inv)" /></td>
              <td class="py-2.5">
                <div class="flex items-center gap-2 text-gray-400">
                  <button class="hover:text-gray-700 transition-colors" v-tooltip.top="'Email'" @click="openInviteeEmail(inv)"><i class="pi pi-envelope text-sm" /></button>
                  <PersonNotes v-if="inv.person_id" :person-id="inv.person_id"
                    :person-name="((inv.person?.first_name || '') + ' ' + (inv.person?.last_name || '')).trim()"
                    :links="attNoteLinks" :context-label="attNoteContextLabel" :can-edit-all="canEditNotes" :can-delete-all="canDeleteNotes"
                    :initial-count="attNoteCounts[inv.person_id] ?? 0" @count-change="v => attNoteCounts[inv.person_id] = v">
                    <template #trigger="{ open, count }">
                      <button class="hover:text-primary transition-colors relative" v-tooltip.top="'Notes'" @click="open">
                        <i class="pi pi-comments text-sm text-primary" />
                        <span v-if="count" class="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-[#1976d2] text-white text-[9px] font-bold flex items-center justify-center">{{ count }}</span>
                      </button>
                    </template>
                  </PersonNotes>
                </div>
              </td>
            </tr>
          </tbody>

          <!-- Sub-groups view -->
          <template v-else-if="attendanceViewMode === 'sub_groups'">
            <tbody v-for="section in groupedInvitees.groups" :key="section.group.id"
              @dragover.prevent @drop.prevent="onDropOnGroup(section.group.id)"
              @dragenter="dragOverGroupId = section.group.id" @dragleave="dragOverGroupId = '__none__'"
              class="divide-y divide-gray-100">
              <tr class="roll-group-row border-b border-gray-200 transition-colors cursor-pointer select-none"
                :class="dragOverGroupId === section.group.id ? 'brightness-95' : ''" :style="{ background: section.group.color + '18' }"
                @click="expandedSubGroups[section.group.id] = !expandedSubGroups[section.group.id]">
                <td :colspan="colCount" class="px-4 py-2">
                  <div class="flex items-center gap-2">
                    <i class="pi text-xs transition-transform" :class="expandedSubGroups[section.group.id] === false ? 'pi-chevron-right' : 'pi-chevron-down'" :style="{ color: section.group.color }" />
                    <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: section.group.color }" />
                    <span class="text-xs font-semibold uppercase tracking-wide" :style="{ color: section.group.color }">{{ section.group.name }}</span>
                    <span class="text-xs text-gray-400">({{ section.invitees.length }})</span>
                    <span v-if="dragOverGroupId === section.group.id" class="ml-auto text-xs font-medium" :style="{ color: section.group.color }">Drop {{ draggingMultiple ? `${attendanceSelected.length} people` : '' }} here</span>
                  </div>
                </td>
              </tr>
              <tr v-if="expandedSubGroups[section.group.id] !== false" v-for="inv in section.invitees" :key="inv.id"
                draggable="true" @dragstart="onDragStart($event, inv.id)"
                class="hover:bg-gray-50 transition-colors" :class="{ 'bg-green-50': isAttendedForContext(inv) }">
                <td class="pl-3 pr-1 py-2.5 w-8 text-center align-middle text-gray-300 cursor-grab"><i class="pi pi-bars text-xs" /></td>
                <td class="pl-1 pr-2 py-2.5 w-8 text-center align-middle"><Checkbox v-model="attendanceSelected" :value="inv.id" /></td>
                <td class="py-2.5 pr-3 font-medium"><NuxtLink v-if="inv.person_id" :to="`/people/${inv.person_id}`" class="text-gray-800 hover:text-primary hover:underline">{{ inv.person?.first_name }} {{ inv.person?.last_name }}</NuxtLink><span v-else class="text-gray-800">{{ inv.person?.first_name }} {{ inv.person?.last_name }}</span></td>
                <td class="py-2.5 pr-3"><span class="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" :class="inviteStatus(inv).cls">{{ inviteStatus(inv).label }}</span></td>
                <td v-for="col in visibleColumns" :key="col.key" class="py-2.5 pr-3 text-sm text-gray-600">
                  <template v-if="col.type === 'photo'">
                    <img v-if="col.get(inv)" :src="col.get(inv)" class="w-7 h-7 rounded-full object-cover" />
                    <span v-else class="text-gray-300">—</span>
                  </template>
                  <template v-else-if="col.type === 'paid'">
                    <span v-if="inv.paid_at" class="flex items-center gap-1.5"><i class="pi pi-check-circle text-primary" /><span>${{ Number(inv.fee_amount ?? 0).toFixed(2) }}</span></span>
                    <i v-else class="pi pi-times-circle text-red-500" />
                  </template>
                  <span v-else>{{ col.get(inv) ?? '—' }}</span>
                </td>
                <td class="py-2.5 pr-3 text-center"><Checkbox :model-value="isAttendedForContext(inv)" binary @change="toggleAttendance(inv)" /></td>
                <td class="py-2.5 pr-3 text-center"><Checkbox :model-value="inv.signed_out" binary :disabled="!isAttendedForContext(inv)" @change="toggleSignOut(inv)" /></td>
                <td class="py-2.5">
                  <div class="flex items-center gap-2 text-gray-400">
                    <button class="hover:text-gray-700 transition-colors" v-tooltip.top="'Email'" @click="openInviteeEmail(inv)"><i class="pi pi-envelope text-sm" /></button>
                    <PersonNotes v-if="inv.person_id" :person-id="inv.person_id"
                      :person-name="((inv.person?.first_name || '') + ' ' + (inv.person?.last_name || '')).trim()"
                      :links="attNoteLinks" :context-label="attNoteContextLabel" :can-edit-all="canEditNotes" :can-delete-all="canDeleteNotes"
                      :initial-count="attNoteCounts[inv.person_id] ?? 0" @count-change="v => attNoteCounts[inv.person_id] = v">
                      <template #trigger="{ open, count }">
                        <button class="hover:text-primary transition-colors relative" v-tooltip.top="'Notes'" @click="open">
                          <i class="pi pi-comments text-sm text-primary" />
                          <span v-if="count" class="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-[#1976d2] text-white text-[9px] font-bold flex items-center justify-center">{{ count }}</span>
                        </button>
                      </template>
                    </PersonNotes>
                  </div>
                </td>
              </tr>
            </tbody>

            <tbody @dragover.prevent @drop.prevent="onDropOnGroup(null)"
              @dragenter="dragOverGroupId = 'ungrouped'" @dragleave="dragOverGroupId = '__none__'" class="divide-y divide-gray-100">
              <tr class="roll-group-row border-b border-gray-200 transition-colors" :class="dragOverGroupId === 'ungrouped' ? 'bg-blue-50' : 'bg-gray-50'">
                <td :colspan="colCount" class="px-4 py-2">
                  <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-gray-400 shrink-0" />
                    <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ungrouped</span>
                    <span class="text-xs text-gray-400">({{ groupedInvitees.ungrouped.length }})</span>
                    <span v-if="dragOverGroupId === 'ungrouped'" class="ml-auto text-xs text-blue-500 font-medium">Drop {{ draggingMultiple ? `${attendanceSelected.length} people` : '' }} to ungroup</span>
                  </div>
                </td>
              </tr>
              <tr v-for="inv in groupedInvitees.ungrouped" :key="inv.id" draggable="true" @dragstart="onDragStart($event, inv.id)"
                class="hover:bg-gray-50 transition-colors" :class="{ 'bg-green-50': isAttendedForContext(inv) }">
                <td class="pl-3 pr-1 py-2.5 w-8 text-center align-middle text-gray-300 cursor-grab"><i class="pi pi-bars text-xs" /></td>
                <td class="pl-1 pr-2 py-2.5 w-8 text-center align-middle"><Checkbox v-model="attendanceSelected" :value="inv.id" /></td>
                <td class="py-2.5 pr-3 font-medium"><NuxtLink v-if="inv.person_id" :to="`/people/${inv.person_id}`" class="text-gray-800 hover:text-primary hover:underline">{{ inv.person?.first_name }} {{ inv.person?.last_name }}</NuxtLink><span v-else class="text-gray-800">{{ inv.person?.first_name }} {{ inv.person?.last_name }}</span></td>
                <td class="py-2.5 pr-3"><span class="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" :class="inviteStatus(inv).cls">{{ inviteStatus(inv).label }}</span></td>
                <td v-for="col in visibleColumns" :key="col.key" class="py-2.5 pr-3 text-sm text-gray-600">
                  <template v-if="col.type === 'photo'">
                    <img v-if="col.get(inv)" :src="col.get(inv)" class="w-7 h-7 rounded-full object-cover" />
                    <span v-else class="text-gray-300">—</span>
                  </template>
                  <template v-else-if="col.type === 'paid'">
                    <span v-if="inv.paid_at" class="flex items-center gap-1.5"><i class="pi pi-check-circle text-primary" /><span>${{ Number(inv.fee_amount ?? 0).toFixed(2) }}</span></span>
                    <i v-else class="pi pi-times-circle text-red-500" />
                  </template>
                  <span v-else>{{ col.get(inv) ?? '—' }}</span>
                </td>
                <td class="py-2.5 pr-3 text-center"><Checkbox :model-value="isAttendedForContext(inv)" binary @change="toggleAttendance(inv)" /></td>
                <td class="py-2.5 pr-3 text-center"><Checkbox :model-value="inv.signed_out" binary :disabled="!isAttendedForContext(inv)" @change="toggleSignOut(inv)" /></td>
                <td class="py-2.5">
                  <div class="flex items-center gap-2 text-gray-400">
                    <button class="hover:text-gray-700 transition-colors" v-tooltip.top="'Email'" @click="openInviteeEmail(inv)"><i class="pi pi-envelope text-sm" /></button>
                    <PersonNotes v-if="inv.person_id" :person-id="inv.person_id"
                      :person-name="((inv.person?.first_name || '') + ' ' + (inv.person?.last_name || '')).trim()"
                      :links="attNoteLinks" :context-label="attNoteContextLabel" :can-edit-all="canEditNotes" :can-delete-all="canDeleteNotes"
                      :initial-count="attNoteCounts[inv.person_id] ?? 0" @count-change="v => attNoteCounts[inv.person_id] = v">
                      <template #trigger="{ open, count }">
                        <button class="hover:text-primary transition-colors relative" v-tooltip.top="'Notes'" @click="open">
                          <i class="pi pi-comments text-sm text-primary" />
                          <span v-if="count" class="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-[#1976d2] text-white text-[9px] font-bold flex items-center justify-center">{{ count }}</span>
                        </button>
                      </template>
                    </PersonNotes>
                  </div>
                </td>
              </tr>
            </tbody>
          </template>
        </table>
      </div>

      <!-- Footer: plain counts. Bulk actions live in the slide-up bar (appears on select). -->
      <div v-if="invitees.length" class="px-4 py-3 border-t border-gray-100 flex items-center shrink-0">
        <p class="text-xs text-gray-500">
          <span class="font-semibold text-green-600">{{ attendedCount }}</span> signed in
          · <span class="font-semibold text-gray-700">{{ invitees.length }}</span> total
        </p>
      </div>
    </div>
    </div>

    <!-- #30 Bulk action bar — slides up from the bottom when attendees are selected -->
    <Transition name="fm-actionbar">
      <div v-if="attendanceSelected.length" class="fixed inset-x-0 bottom-5 z-50 flex justify-center px-4 print:hidden pointer-events-none">
        <div class="pointer-events-auto flex items-center gap-1 rounded-full pl-4 pr-1.5 py-1.5 text-white shadow-2xl" style="background:var(--brand-primary)">
          <span class="text-sm font-semibold whitespace-nowrap">{{ attendanceSelected.length }} selected</span>
          <span class="mx-1.5 w-px h-5 bg-white/25" />
          <button class="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full hover:bg-white/15 transition-colors whitespace-nowrap" @click="markSelectedIn"><i class="pi pi-check text-xs" />Mark in</button>
          <!-- Only offered once the selection actually contains someone signed in. -->
          <button v-if="selectedSignedIn.length"
            class="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full hover:bg-white/15 transition-colors whitespace-nowrap"
            v-tooltip.top="`Sign out ${selectedSignedIn.length} of ${attendanceSelected.length}`"
            @click="markSelectedOut"><i class="pi pi-sign-out text-xs" />Sign out</button>
          <button class="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full hover:bg-white/15 transition-colors whitespace-nowrap" @click="showAddToSubGroupDialog = true"><i class="pi pi-user-plus text-xs" />Sub-group</button>
          <button class="w-8 h-8 rounded-full hover:bg-white/15 flex items-center justify-center shrink-0" v-tooltip.top="'Clear selection'" @click="clearAttendanceSelection"><i class="pi pi-times text-sm" /></button>
        </div>
      </div>
    </Transition>

    <!-- Check-in QR dialog -->
    <Dialog v-model:visible="showCheckinQrDialog" header="Check-in QR Code" modal :style="{ width: '95vw', maxWidth: '360px' }">
      <div class="flex flex-col items-center gap-4 py-2">
        <p class="text-sm text-gray-500 text-center">{{ t('member', true) }} scan this code to self check-in to the {{ t('event', false, true) }}.</p>
        <canvas ref="qrCanvas" class="rounded-xl border border-gray-100" />
        <p class="text-xs text-gray-400 text-center break-all">{{ qrUrl }}</p>
      </div>
      <template #footer>
        <Button label="Download" icon="pi pi-download" severity="secondary" text @click="downloadQr" />
        <Button label="Close" @click="showCheckinQrDialog = false" style="background:var(--brand-primary); border-color:var(--brand-primary)" />
      </template>
    </Dialog>

    <!-- Sub Groups dialog -->
    <Dialog v-model:visible="showSubGroupsDialog" header="Manage Sub Groups" modal :style="{ width: '95vw', maxWidth: '520px' }">
      <div class="flex flex-col gap-5 py-2">
        <div class="flex flex-col gap-3">
          <label class="text-sm font-semibold text-gray-700">Create Group</label>
          <div class="flex items-center gap-2 flex-wrap">
            <InputText v-model="newGroupName" placeholder="Group name…" class="flex-1 min-w-0" @keydown.enter="addSubGroup" />
            <div class="flex gap-1.5 flex-shrink-0">
              <button v-for="color in groupColorPalette" :key="color"
                class="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 shrink-0"
                :class="newGroupColor === color ? 'border-gray-700 scale-110' : 'border-transparent'" :style="{ background: color }"
                @click="newGroupColor = color" />
            </div>
          </div>
          <div v-if="attendanceSessions.length" class="flex flex-col gap-2">
            <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">Apply to</label>
            <div class="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
              <button type="button" class="flex-1 px-3 py-2 transition-colors" :class="newGroupScope === 'all' ? 'bg-primary text-white font-medium' : 'bg-white text-gray-600 hover:bg-gray-50'" @click="newGroupScope = 'all'; newGroupSessionIds = []">All sessions</button>
              <button type="button" class="flex-1 px-3 py-2 transition-colors border-l border-gray-200" :class="newGroupScope === 'this' ? 'bg-primary text-white font-medium' : 'bg-white text-gray-600 hover:bg-gray-50'" @click="newGroupScope = 'this'; newGroupSessionIds = []">This session</button>
              <button type="button" class="flex-1 px-3 py-2 transition-colors border-l border-gray-200" :class="newGroupScope === 'multiple' ? 'bg-primary text-white font-medium' : 'bg-white text-gray-600 hover:bg-gray-50'" @click="newGroupScope = 'multiple'">Select sessions</button>
            </div>
            <MultiSelect v-if="newGroupScope === 'multiple'" v-model="newGroupSessionIds" :options="attendanceSessions"
              :option-label="s => (s.start_at ? new Date(s.start_at).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) + ' — ' : '') + (s.title || 'Untitled')"
              option-value="id" placeholder="Choose sessions…" display="chip" class="w-full" />
            <p v-if="newGroupScope === 'this' && selectedAttendanceSessionId" class="text-xs text-gray-400">
              Will apply to: {{ attendanceSessions.find(s => s.id === selectedAttendanceSessionId)?.title || 'current session' }}
            </p>
          </div>
          <div class="flex justify-end">
            <Button label="Add Group" :disabled="!newGroupName.trim() || (newGroupScope === 'multiple' && !newGroupSessionIds.length)" size="small" @click="addSubGroup" style="background:var(--brand-primary); border-color:var(--brand-primary)" />
          </div>
        </div>
        <div v-if="subGroups.length" class="flex flex-col gap-2">
          <label class="text-sm font-semibold text-gray-700">Groups ({{ subGroups.length }})</label>
          <div v-for="grp in subGroups" :key="grp.id" class="flex flex-col bg-gray-50 rounded-lg border border-gray-100 overflow-hidden">
            <div class="flex items-center gap-3 px-4 py-3">
              <span class="w-3 h-3 rounded-full shrink-0" :style="{ background: grp.color }" />
              <span class="text-sm font-medium text-gray-700">{{ grp.name }}</span>
              <span v-if="attendanceSessions.length" class="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                :class="(!grp.session_ids || grp.session_ids.length === 0) ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'">
                {{ (!grp.session_ids || grp.session_ids.length === 0) ? 'All sessions' : grp.session_ids.length === 1 ? '1 session' : `${grp.session_ids.length} sessions` }}
              </span>
              <span class="flex-1" />
              <span class="text-xs text-gray-400">{{ groupedInvitees.groups.find(g => g.group.id === grp.id)?.invitees.length ?? 0 }} members</span>
              <Button icon="pi pi-trash" size="small" text severity="danger" rounded @click="removeSubGroup(grp.id)" />
            </div>
            <div class="border-t border-gray-200 px-4 py-2.5 flex items-center gap-2 flex-wrap bg-white">
              <span class="text-xs text-gray-500 shrink-0">Managers:</span>
              <div v-for="mgr in (grp.managers ?? [])" :key="mgr.id" class="flex items-center gap-1 bg-gray-100 rounded-full pl-2 pr-1 py-0.5">
                <span class="text-xs text-gray-700">{{ mgr.name }}</span>
                <button class="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors" @click="removeSubGroupManager(grp.id, mgr.id)"><i class="pi pi-times text-[9px]" /></button>
              </div>
              <Select v-model="addingManagerForGroup[grp.id]" :options="availableManagersFor(grp)" option-label="full_name" option-value="id"
                placeholder="+ Add manager" size="small" class="text-xs h-6" style="min-width:140px; font-size:12px" @change="onAddManager(grp.id, $event.value)" />
            </div>
          </div>
        </div>
        <div v-else class="py-4 text-center text-sm text-gray-400">
          <i class="pi pi-users text-2xl mb-2 block text-gray-300" />No groups yet. Create one above.
        </div>
        <p v-if="subGroups.length" class="text-xs text-gray-400 -mt-2">Drag attendees between groups in the attendance table.</p>
      </div>
      <template #footer>
        <Button label="Save" :loading="savingSubGroups" icon="pi pi-check" @click="saveSubGroups" style="background:var(--brand-primary); border-color:var(--brand-primary)" />
      </template>
    </Dialog>

    <!-- Assign to Sub-group dialog -->
    <Dialog v-model:visible="showAddToSubGroupDialog" header="Assign to Sub-group" modal :style="{ width: '95vw', maxWidth: '440px' }" @hide="addToSubGroupTarget = null">
      <div class="flex flex-col gap-4 py-2">
        <div class="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2.5">
          <i class="pi pi-users text-primary text-sm" />
          <span class="text-sm font-medium text-gray-700">{{ addToSubGroupPeople.length }} {{ addToSubGroupPeople.length === 1 ? 'person' : 'people' }} selected</span>
          <div class="flex gap-1.5 ml-auto flex-wrap justify-end">
            <span v-for="inv in addToSubGroupPeople.slice(0, 4)" :key="inv.id" class="text-xs bg-white border border-gray-200 rounded-full px-2 py-0.5 text-gray-600">{{ inv.person?.first_name }} {{ inv.person?.last_name }}</span>
            <span v-if="addToSubGroupPeople.length > 4" class="text-xs bg-white border border-gray-200 rounded-full px-2 py-0.5 text-gray-500">+{{ addToSubGroupPeople.length - 4 }} more</span>
          </div>
        </div>
        <div v-if="!subGroups.length" class="py-4 text-center text-sm text-gray-400">
          <i class="pi pi-sitemap text-2xl text-gray-300 block mb-2" />No sub-groups created yet. Go to the Sub Groups button in the toolbar to create one first.
        </div>
        <div v-else class="flex flex-col gap-2">
          <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Choose a sub-group</label>
          <div class="flex flex-col gap-2">
            <div v-for="grp in subGroups" :key="grp.id" class="flex items-center gap-3 px-4 py-3 rounded-lg border-2 cursor-pointer transition-colors"
              :class="addToSubGroupTarget === grp.id ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300 bg-white'"
              @click="addToSubGroupTarget = grp.id">
              <span class="w-3 h-3 rounded-full shrink-0" :style="{ background: grp.color }" />
              <span class="flex-1 text-sm font-medium text-gray-700">{{ grp.name }}</span>
              <span class="text-xs text-gray-400">{{ groupedInvitees.groups.find(g => g.group.id === grp.id)?.invitees.length ?? 0 }} members</span>
              <i v-if="addToSubGroupTarget === grp.id" class="pi pi-check text-primary text-sm" />
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showAddToSubGroupDialog = false" />
        <Button label="Assign" icon="pi pi-check" :disabled="!addToSubGroupTarget || !subGroups.length" @click="executeAddToSubGroup" style="background:var(--brand-primary); border-color:var(--brand-primary)" />
      </template>
    </Dialog>

    <!-- Invite people — popup; reloads the roster on close -->
    <Dialog v-model:visible="inviteOpen" modal header="Invite people" :style="{ width: '95vw', maxWidth: '1000px' }" @hide="load">
      <!-- "More" opens straight to the standard people selector (classes + people). -->
      <EventInviteeManager :event-id="props.eventId" :show-invite="false" />
      <template #footer>
        <div class="flex items-center justify-between gap-3 w-full">
          <span class="text-xs text-gray-400">People are added as you pick them — no need to save.</span>
          <Button label="Done" icon="pi pi-check" @click="inviteOpen = false"
            style="background:var(--brand-primary);border-color:var(--brand-primary)" />
        </div>
      </template>
    </Dialog>

    <!-- Recurring add scope — add to just this occurrence or this + every following one -->
    <Dialog v-model:visible="addScopeOpen" modal :draggable="false" header="Add to the series?" :style="{ width: '95vw', maxWidth: '440px' }">
      <p class="text-sm text-gray-600 mb-3">This event repeats. Add <span class="font-medium text-gray-900">{{ pendingAddPerson?.name }}</span> to just this occurrence, or this and every following one?</p>
      <div class="space-y-1.5">
        <label v-for="opt in [
          { value: 'this', label: 'This event only', desc: 'Just this occurrence' },
          { value: 'following', label: 'This and following events', desc: 'This occurrence and every later one in the series' },
        ]" :key="opt.value"
          class="flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors"
          :class="addScope === opt.value ? 'border-primary bg-primary/5' : 'border-gray-200 hover:bg-gray-50'">
          <RadioButton v-model="addScope" :value="opt.value" :inputId="`addscope-${opt.value}`" class="mt-0.5" />
          <span class="min-w-0">
            <span class="block text-sm font-medium text-gray-800">{{ opt.label }}</span>
            <span class="block text-xs text-gray-500">{{ opt.desc }}</span>
          </span>
        </label>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text size="small" @click="addScopeOpen = false" />
        <Button label="Add" icon="pi pi-check" size="small" :loading="inlineAddBusy"
          style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="confirmAddScope" />
      </template>
    </Dialog>

    <!-- #25 Print preview + config drawer -->
    <Dialog v-model:visible="printPreviewOpen" modal header="Print preview" :style="{ width: '95vw', maxWidth: '1100px' }" :pt="{ content: { style: 'padding:0' } }">
      <div class="flex flex-col sm:flex-row" style="height:70vh">
        <!-- The sheet as it will print (columns follow the drawer; a light first-cut render) -->
        <div class="flex-1 min-w-0 overflow-auto bg-gray-100 p-4 sm:p-6">
          <div class="mx-auto bg-white shadow-md p-6" :style="{ width: printOrientation === 'landscape' ? '100%' : '640px', maxWidth: '100%' }">
            <h2 class="text-lg font-bold text-gray-900 mb-3">{{ event?.title || 'Attendance roll' }}</h2>
            <table class="w-full text-sm border-collapse">
              <thead>
                <tr class="border-b-2 border-gray-300 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th class="py-2 pr-3">{{ t('member') }}</th>
                  <th v-if="printStatus" class="py-2 pr-3">Status</th>
                  <th v-for="col in visibleColumns" :key="col.key" class="py-2 pr-3 whitespace-nowrap">{{ col.label }}</th>
                  <th class="py-2 pr-3 text-center">Signed In</th>
                  <th class="py-2 text-center">Out</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="inv in previewInvitees" :key="inv.id" class="border-b border-gray-100">
                  <td class="py-1.5 pr-3 font-medium text-gray-800 whitespace-nowrap">{{ inv.person?.first_name }} {{ inv.person?.last_name }}</td>
                  <td v-if="printStatus" class="py-1.5 pr-3 text-gray-600">{{ inviteStatus(inv).label }}</td>
                  <td v-for="col in visibleColumns" :key="col.key" class="py-1.5 pr-3 text-gray-600">{{ col.get(inv) ?? '—' }}</td>
                  <td class="py-1.5 pr-3 text-center">
                    <span v-if="printSignStyle === 'tick'" class="inline-block w-4 h-4 border border-gray-400 rounded-sm" />
                    <span v-else class="inline-block w-24 border-b border-gray-500 align-bottom" style="height:15px" />
                  </td>
                  <td class="py-1.5 text-center">
                    <span v-if="printSignStyle === 'tick'" class="inline-block w-4 h-4 border border-gray-400 rounded-sm" />
                    <span v-else class="inline-block w-24 border-b border-gray-500 align-bottom" style="height:15px" />
                  </td>
                </tr>
              </tbody>
            </table>
            <p v-if="invitees.length > previewInvitees.length" class="text-xs text-gray-400 mt-2">…and {{ invitees.length - previewInvitees.length }} more on the printout</p>
          </div>
        </div>
        <!-- Config drawer -->
        <div class="w-full sm:w-64 shrink-0 border-t sm:border-t-0 sm:border-l border-gray-200 bg-white p-4 overflow-y-auto">
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Orientation</p>
          <div class="flex gap-2 mb-5">
            <button v-for="o in ['landscape', 'portrait']" :key="o" type="button"
              class="flex-1 text-sm py-1.5 rounded-lg border capitalize transition-colors"
              :class="printOrientation === o ? 'border-primary text-primary bg-primary/5 font-semibold' : 'border-gray-200 text-gray-600 hover:border-gray-300'"
              @click="printOrientation = (o as any)">{{ o }}</button>
          </div>
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Signed in / out</p>
          <div class="flex gap-2 mb-5">
            <button type="button" class="flex-1 text-sm py-1.5 rounded-lg border transition-colors"
              :class="printSignStyle === 'tick' ? 'border-primary text-primary bg-primary/5 font-semibold' : 'border-gray-200 text-gray-600 hover:border-gray-300'"
              @click="printSignStyle = 'tick'">Tick boxes</button>
            <button type="button" class="flex-1 text-sm py-1.5 rounded-lg border transition-colors"
              :class="printSignStyle === 'sign' ? 'border-primary text-primary bg-primary/5 font-semibold' : 'border-gray-200 text-gray-600 hover:border-gray-300'"
              @click="printSignStyle = 'sign'">Sign + time</button>
          </div>
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Columns</p>
          <label class="flex items-center gap-2 py-1 cursor-pointer text-sm text-gray-700">
            <Checkbox v-model="printStatus" binary /> Status
          </label>
          <label v-for="c in allColumns" :key="c.key" class="flex items-center gap-2 py-1 cursor-pointer text-sm text-gray-700">
            <Checkbox :model-value="colVisible(c.key)" binary @change="toggleCol(c.key)" />{{ c.label }}
          </label>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" text severity="secondary" @click="printPreviewOpen = false" />
        <Button label="Print" icon="pi pi-print" style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="doPrintFromPreview" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
/* #30 bulk action bar slide-up */
.fm-actionbar-enter-active,
.fm-actionbar-leave-active { transition: transform .28s cubic-bezier(.2, .9, .3, 1), opacity .2s ease; }
.fm-actionbar-enter-from,
.fm-actionbar-leave-to { transform: translateY(140%); opacity: 0; }
</style>
