<!--
  ClassesBoard — the reusable Classes-style overview. Top-level codes become a
  tab strip; inside a tab, every code in that top-level code's subtree with
  groups renders as a table SECTION (header = code name), one row per class:
  Name · Head · Gymnasts (members/capacity) · Waitlist · Sport + a Total row.
  Which optional columns show is driven by `columns`; which top-level codes
  appear as tabs by `codeIds` (empty = all). Backs /groups/classes (default:
  all columns/codes, +Tab enabled) and every saved view at /groups/view/:id.
-->
<script setup lang="ts">
import type { GroupCode } from '~/composables/useGroupCodes'
import type { ViewColumnKey } from '~/composables/useGroupViews'

const props = withDefaults(defineProps<{
  columns?: ViewColumnKey[]
  codeIds?: string[]
  allowNewTab?: boolean
}>(), {
  columns: () => ['head', 'gymnasts', 'waitlist', 'attendances', 'termfee', 'age', 'gender', 'signup', 'sport'],
  codeIds: () => [],
  allowNewTab: false,
})

const groupsApi = useGroupsApi()
const eventsApi = useEventsApi()
const affiliationsApi = useAffiliationsApi()
const { orgId } = useOrg()
const toast = useToast()
const gc = useGroupCodes()
const scoped = useScopedRoles()
const gf = useGroupFees()
const tm = useTermsMemberships()
const wl = useWaitlists()
const { ensureTerms, t } = useTerms()
void ensureTerms()

const showCol = (k: ViewColumnKey) => props.columns.includes(k)

interface ClassGroup {
  id: string; name: string; code_id: string | null; term_id: string | null; capacity: number | null; color: string | null
  headName: string | null; gymnasts: number; waitlist: number | null; sport: string | null
  gender: string | null; ageRange: string | null; feeLabel: string | null; feeCount: number; formId: string | null; locationId: string | null; sortOrder: number; attendances: number
}

// Gender restriction (migration 203) → short label; null = open to all.
const GENDER_LABELS: Record<string, string> = { MALE: 'Male', FEMALE: 'Female', NON_BINARY: 'Non-binary' }
const genderLabel = (g: string | null) => g ? (GENDER_LABELS[g] ?? g) : 'Any'

const codes = ref<GroupCode[]>([])
const groups = ref<ClassGroup[]>([])
const terms = ref<{ id: string; name: string; start_date: string | null; end_date: string | null; set_id?: string | null }[]>([])
const termSets = ref<import('~/composables/useTermsMemberships').TermSet[]>([])
const termFilter = ref<string>('all')  // 'all' | org_terms.id
const termDefaulted = ref(false)        // only auto-pick the default term on first load
const loading = ref(true)

import { termSetCoversLocation } from '~/composables/useTermsMemberships'
const termOptions = computed(() => {
  const setsById = Object.fromEntries(termSets.value.map(x => [x.id, x]))
  const visible = terms.value.filter(tr =>
    termSetCoversLocation(tr.set_id ? setsById[tr.set_id] : null, boardActiveLocation.value))
  return [
    { label: `All ${t('term', true, true)}`, value: 'all' },
    ...visible.map(t => ({ label: t.name, value: t.id })),
  ]
})
// A group belongs to the selected term via its code chain (else its own term_id).
const inTerm = (g: ClassGroup) => termFilter.value === 'all' || gc.effectiveTermId(g, codeById.value) === termFilter.value
const visibleGroups = computed(() => groups.value.filter(g =>
  (g as any).kind !== 'membership' &&
  inTerm(g) && inActiveLocation(g.locationId) &&
  (!boardRestricted.value || boardCanAccess(g.locationId, gc.effectiveSportId({ code_id: g.code_id }, codeById.value)))))

const parentKey = (c: GroupCode) => (c.parent_id && codes.value.some(x => x.id === c.parent_id)) ? c.parent_id : null
const sortSibs = (a: GroupCode, b: GroupCode) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)
const codeById = computed(() => Object.fromEntries(codes.value.map(c => [c.id, c])) as Record<string, GroupCode>)
// The tabs. No selection → every top-level code. A selection → the CHOSEN codes
// at any depth, except a chosen code whose ancestor is also chosen (picking a
// parent pulls its children in as sections, so the child isn't a separate tab).
const topCodes = computed(() => {
  if (!props.codeIds.length) return codes.value.filter(c => parentKey(c) === null).slice().sort(sortSibs)
  const chosen = new Set(props.codeIds)
  const ancestorChosen = (c: GroupCode) => {
    let cur = c.parent_id, guard = 0
    while (cur && guard++ < 50) {
      if (chosen.has(cur)) return true
      cur = codeById.value[cur]?.parent_id ?? null
    }
    return false
  }
  return codes.value.filter(c => chosen.has(c.id) && !ancestorChosen(c)).slice().sort(sortSibs)
})
// "Other" (ungrouped) only appears in unrestricted (all-codes) views.
const hasUngrouped = computed(() => !props.codeIds.length && visibleGroups.value.some(g => !g.code_id || !codeById.value[g.code_id]))

function subtreeCodes(topId: string): GroupCode[] {
  const out: GroupCode[] = []
  const walk = (id: string) => {
    const c = codeById.value[id]; if (!c) return
    out.push(c)
    codes.value.filter(x => parentKey(x) === id).slice().sort(sortSibs).forEach(ch => walk(ch.id))
  }
  walk(topId)
  return out
}
const bySavedOrder = (a: ClassGroup, b: ClassGroup) => ((a as any).sortOrder - (b as any).sortOrder) || a.name.localeCompare(b.name)
const groupsInCode = (codeId: string) => visibleGroups.value.filter(g => g.code_id === codeId).sort(bySavedOrder)

type Tab = { key: string; label: string }
// A programme whose subtree holds ONLY memberships is a memberships umbrella
// (e.g. "Senior Membership") — it belongs to the memberships board, not here.
function isMembershipOnlyCode(topId: string): boolean {
  const ids = new Set(subtreeCodes(topId).map(c => c.id))
  ids.add(topId)
  const inSubtree = groups.value.filter(g => g.code_id && ids.has(g.code_id))
  return inSubtree.length > 0 && inSubtree.every(g => (g as any).kind === 'membership')
}
const tabs = computed<Tab[]>(() => {
  const t: Tab[] = topCodes.value.filter(c => !isMembershipOnlyCode(c.id)).map(c => ({ key: c.id, label: c.name }))
  if (hasUngrouped.value) t.push({ key: '__other', label: 'Other' })
  return t
})
const activeTab = ref<string>('')
watch(tabs, ts => { if (!ts.some(t => t.key === activeTab.value)) activeTab.value = ts[0]?.key ?? '' }, { immediate: true })

interface Section { key: string; title: string; rows: ClassGroup[]; total: number }
const activeSections = computed<Section[]>(() => {
  if (activeTab.value === '__other') {
    const rows = visibleGroups.value.filter(g => !g.code_id || !codeById.value[g.code_id]).sort(bySavedOrder)
    return rows.length ? [{ key: '__other', title: 'Other', rows, total: rows.reduce((s, g) => s + g.gymnasts, 0) }] : []
  }
  const out: Section[] = []
  for (const c of subtreeCodes(activeTab.value)) {
    const rows = groupsInCode(c.id)
    if (rows.length) out.push({ key: c.id, title: c.name, rows, total: rows.reduce((s, g) => s + g.gymnasts, 0) })
  }
  return out
})
const tabTotal = computed(() => activeSections.value.reduce((s, sec) => s + sec.total, 0))

function countClass(g: ClassGroup) {
  if (g.capacity == null) return ''
  if (g.gymnasts > g.capacity) return 'bg-red-50 text-red-600'
  if (g.gymnasts >= g.capacity) return 'bg-amber-50 text-amber-700'
  return ''
}
const countLabel = (g: ClassGroup) => g.capacity == null ? String(g.gymnasts) : `${g.gymnasts} / ${g.capacity}`

// ── Drag ordering (STANDING RULE: ordering is drag, never arrow buttons).
// Drop near a row's top/bottom edge = reorder; drop on a SECTION HEADER =
// move the class into that programme. Cross-section row drops re-home too.
const dragGroup = ref<ClassGroup | null>(null)
const dropMark = ref<{ id: string; pos: 'before' | 'after' } | null>(null)
const dropSection = ref<string | null>(null)
function onGroupDragStart(g: ClassGroup, e: DragEvent) {
  dragGroup.value = g
  if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', g.id) }
}
function onGroupDragOver(e: DragEvent, g: ClassGroup) {
  if (!dragGroup.value || dragGroup.value.id === g.id) return
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  dropMark.value = { id: g.id, pos: (e.clientY - r.top) < r.height / 2 ? 'before' : 'after' }
  dropSection.value = null
}
// Tabs are drop targets too — drag a class onto a TAB to move it into that
// top-level programme (covers programmes not visible as sections in this tab).
const dropTab = ref<string | null>(null)
function onTabDragOver(tabKey: string) {
  if (!dragGroup.value || tabKey === '__other') return
  dropTab.value = tabKey
  dropMark.value = null
  dropSection.value = null
}
async function onTabDrop(tabKey: string) {
  const g = dragGroup.value
  resetDrag()
  if (!g || tabKey === '__other' || (g.code_id ?? null) === tabKey) return
  const siblings = groups.value.filter(x => x.code_id === tabKey && x.id !== g.id).sort(bySavedOrder)
  g.code_id = tabKey
  ;(g as any).sortOrder = siblings.length
  await groupsApi.update(g.id, { codeId: tabKey, sortOrder: siblings.length })
  groups.value = [...groups.value]
}
function onSectionHeaderDragOver(sec: Section) {
  if (!dragGroup.value) return
  dropSection.value = sec.key
  dropMark.value = null
}
function resetDrag() { dragGroup.value = null; dropMark.value = null; dropSection.value = null; dropTab.value = null }
async function persistSectionOrder(list: ClassGroup[], codeId: string | null, moved: ClassGroup) {
  const updates: Promise<any>[] = []
  list.forEach((row, idx) => {
    const patch: Record<string, any> = {}
    if ((row as any).sortOrder !== idx) { (row as any).sortOrder = idx; patch.sortOrder = idx }
    if (row.id === moved.id && (row.code_id ?? null) !== codeId) { row.code_id = codeId; patch.codeId = codeId }
    if (Object.keys(patch).length) updates.push(groupsApi.update(row.id, patch))
  })
  await Promise.all(updates)
  groups.value = [...groups.value]
}
async function onGroupDrop(target: ClassGroup, sec: Section) {
  const g = dragGroup.value
  const pos = dropMark.value?.id === target.id ? dropMark.value.pos : 'after'
  resetDrag()
  if (!g || g.id === target.id) return
  const codeId = sec.key === '__other' ? null : sec.key
  const list = sec.rows.filter(r => r.id !== g.id)
  const at = list.indexOf(target) + (pos === 'after' ? 1 : 0)
  list.splice(at, 0, g)
  await persistSectionOrder(list, codeId, g)
}
async function onSectionHeaderDrop(sec: Section) {
  const g = dragGroup.value
  resetDrag()
  if (!g) return
  const codeId = sec.key === '__other' ? null : sec.key
  const list = sec.rows.filter(r => r.id !== g.id)
  list.push(g)
  await persistSectionOrder(list, codeId, g)
}

async function load() {
  if (!orgId.value) return
  loading.value = true
  await scoped.loadRoleDefs()
  // First the group list (seam) — its ids drive the roster read below.
  const gs = await groupsApi.list(orgId.value)
  const groupIds = (gs ?? []).map((g: any) => g.id)
  const [loadedCodes, loadedTerms, loadedSets, mems, orgSports, feeOpts, evs, wlCounts] = await Promise.all([
    gc.loadCodes(),
    tm.loadTerms(),
    tm.loadTermSets(),
    groupsApi.roster(groupIds),
    affiliationsApi.orgSports(orgId.value),
    groupsApi.feeOptionsByOrg(orgId.value),
    eventsApi.list(orgId.value),
    wl.entryCounts(),
  ])
  codes.value = loadedCodes
  terms.value = (loadedTerms ?? []).map((t: any) => ({ id: t.id, name: t.name, start_date: t.start_date ?? null, end_date: t.end_date ?? null, set_id: t.set_id ?? null }))
  termSets.value = loadedSets ?? []
  // Seam roster is camelCase + flat person fields; bucket by group.
  const memByGroup: Record<string, any[]> = {}
  for (const m of mems ?? []) (memByGroup[m.groupId] ??= []).push(m)
  // Sport: the class's programme chain (group_codes.sport_id → org_sports, mig 238),
  // shown under the club's own label for it. This is the same fact the access
  // grants gate on below — a real FK, not the free text that used to be read off
  // whichever discipline the class happened to be linked to first.
  const codesById: Record<string, any> = Object.fromEntries(loadedCodes.map((c: any) => [c.id, c]))
  const sportLabelById: Record<string, string> = {}
  for (const s of orgSports ?? []) sportLabelById[s.id] = (s.displayName || s.sport || '').trim()
  const sportOf = (g: any): string | null => {
    const sportId = gc.effectiveSportId({ code_id: g.code_id ?? null }, codesById)
    return sportId ? (sportLabelById[sportId] || null) : null
  }
  // Term fee: group's fee options → single = its price label, multiple = "varies", none = ✗.
  // Seam options are camelCase; map to the snake shape priceLabel expects.
  const feesByGroup: Record<string, any[]> = {}
  for (const o of feeOpts ?? []) (feesByGroup[o.groupId] ??= []).push({
    fee_type: o.feeType, period_unit: o.periodUnit ?? null, period_count: o.periodCount ?? 1,
    instalment_count: o.instalmentCount ?? null, session_count: o.sessionCount ?? null,
    prorata: !!o.prorata, items: (o.items ?? []).map((it: any) => ({ amount: Number(it.amount) || 0 })),
  })
  // Attendances: number of training events linked to the group (member_group_id set).
  const attByGroup: Record<string, number> = {}
  for (const e of evs ?? []) if (e.memberGroupId) attByGroup[e.memberGroupId] = (attByGroup[e.memberGroupId] || 0) + 1

  // Seam group list is camelCase; this component reads snake fields internally.
  groups.value = (gs ?? []).map((g: any): ClassGroup => {
    const rows = memByGroup[g.id] ?? []
    let head: { firstName: string | null; lastName: string | null } | null = null, gymnasts = 0
    for (const m of rows) {
      const roleKeys = scoped.normalizeRoles('group', m.roles, m.role)
      if (scoped.isStaff('group', roleKeys)) { if (!head) head = { firstName: m.firstName, lastName: m.lastName } }
      else gymnasts++
    }
    const opts = feesByGroup[g.id] ?? []
    return {
      id: g.id, name: g.name, code_id: g.codeId ?? null, term_id: g.termId ?? null, capacity: g.capacity ?? null, color: g.color ?? null,
      headName: head ? `${head.firstName ?? ''} ${head.lastName ?? ''}`.trim() || null : null,
      gymnasts, waitlist: g.waitlistId ? (wlCounts[g.waitlistId] ?? 0) : null, sport: sportOf(g),
      gender: g.genderRestriction ?? null,
      ageRange: g.ageRange ?? null,
      feeCount: opts.length,
      formId: g.formId ?? null,
      locationId: g.locationId ?? null,
      kind: g.kind ?? 'class',
      sortOrder: g.sortOrder ?? 0,
      feeLabel: opts.length === 1 ? gf.priceLabel(opts[0] as any) : null,
      attendances: attByGroup[g.id] || 0,
    }
  })
  // Default the term filter once: the active (current-date) term if it has groups, else All.
  if (!termDefaulted.value) {
    const today = new Date().toISOString().slice(0, 10)
    const active = terms.value.find(t => (t.start_date ?? '') <= today && (t.end_date ?? '') >= today)
    termFilter.value = active && groups.value.some(g => gc.effectiveTermId(g, codeById.value) === active.id) ? active.id : 'all'
    termDefaulted.value = true
  }
  loading.value = false
}

// New top-level tab (= a top-level code) — only when allowNewTab.
const newTabOpen = ref(false)
const newTabName = ref('')
async function createTab() {
  const name = newTabName.value.trim()
  if (!name) return
  const created = await gc.createCode({ name, sort_order: topCodes.value.length })
  newTabOpen.value = false; newTabName.value = ''
  await load()
  if (created) activeTab.value = created.id
  toast.add({ severity: 'success', summary: 'Tab added', life: 1800 })
}

defineExpose({ reload: load })
// Location lens: rows outside the active location are hidden (null lens = all).
// Restricted staff (access grants) are ALSO gated by sport: a class's sport
// derives from its programme chain (group_codes.sport_id, mig 238).
const { activeLocationId: boardActiveLocation, inActiveLocation, restricted: boardRestricted, canAccess: boardCanAccess } = useActiveLocation()
watch(orgId, () => { if (orgId.value) load() }, { immediate: true })
</script>

<template>
  <div class="space-y-4">
    <div v-if="loading" class="card p-6 text-sm text-gray-400">Loading…</div>
    <div v-else-if="!codes.length" class="card p-6 text-sm text-gray-500">
      No {{ t('code', true, true) }} yet — create one on <NuxtLink to="/groups/codes" class="text-primary hover:underline">Organise {{ t('code', true, true) }}</NuxtLink> first.
    </div>
    <div v-else-if="!tabs.length" class="card p-6 text-sm text-gray-400">This view has no {{ t('code', true, true) }} to show.</div>

    <template v-else>
      <!-- Term filter — a group belongs to a term via its code chain (else its own
           term_id). Defaults to the current-date term when it has groups. Page actions
           passed via the #toolbar slot line up horizontally on this row. -->
      <div v-if="terms.length || $slots.toolbar" class="flex items-center gap-2 flex-wrap">
        <template v-if="terms.length">
          <label class="text-xs font-medium text-gray-500 shrink-0">{{ t('term') }}</label>
          <Select v-model="termFilter" :options="termOptions" option-label="label" option-value="value" class="w-full sm:w-56" />
        </template>
        <div v-if="$slots.toolbar" class="flex items-center gap-2 flex-wrap ml-auto"><slot name="toolbar" /></div>
      </div>

      <!-- Tab strip — hidden when there's only one tab (nothing to switch between);
           the desktop strip still shows if the landing allows adding a tab. -->
      <div v-if="tabs.length > 1" class="md:hidden">
        <Select v-model="activeTab" :options="tabs" option-label="label" option-value="key" class="w-full" />
      </div>
      <div v-if="tabs.length > 1" class="flex items-center gap-1 border-b border-gray-200 overflow-x-auto no-scrollbar">
        <button v-for="t in tabs" :key="t.key" @click="activeTab = t.key"
          class="px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition rounded-t"
          :class="[activeTab === t.key ? 'border-primary text-primary font-medium' : 'border-transparent text-gray-500 hover:text-gray-700',
            dropTab === t.key ? 'ring-2 ring-inset ring-[var(--brand-primary)] bg-primary/5' : '']"
          @dragover.prevent="onTabDragOver(t.key)" @dragleave="dropTab === t.key && (dropTab = null)"
          @drop.prevent="onTabDrop(t.key)">
          {{ t.label }}
        </button>
        <button v-if="allowNewTab" @click="newTabOpen = true" v-tooltip.top="'New top-level tab'"
          class="px-2 py-2 text-sm text-gray-400 hover:text-primary whitespace-nowrap">
          <i class="pi pi-plus text-xs" /> Tab
        </button>
      </div>

      <div v-if="!activeSections.length" class="card p-6 text-sm text-gray-400">No {{ t('group', true, true) }} in this tab yet.</div>

      <div v-for="sec in activeSections" :key="sec.key" class="card p-0 overflow-hidden">
        <!-- Desktop table -->
        <table class="hidden md:table w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 text-left text-xs font-semibold text-gray-700">
              <th class="px-5 py-3 w-[38%] rounded transition-shadow"
                :class="dropSection === sec.key ? 'ring-2 ring-inset ring-[var(--brand-primary)] bg-primary/5' : ''"
                @dragover.prevent="onSectionHeaderDragOver(sec)" @drop.prevent="onSectionHeaderDrop(sec)">
                <NuxtLink v-if="sec.key !== '__other'" :to="`/groups/timetable?codes=${sec.key}`"
                  class="group/sec inline-flex items-center gap-1.5 hover:text-primary transition-colors"
                  v-tooltip.top="`Week view of ${sec.title}`">
                  {{ sec.title }}
                  <i class="pi pi-calendar text-[10px] text-gray-400 opacity-0 group-hover/sec:opacity-100 transition-opacity" />
                </NuxtLink>
                <span v-else>{{ sec.title }}</span>
              </th>
              <th v-if="showCol('head')" class="px-3 py-3">{{ t('group-head') }}</th>
              <th v-if="showCol('gymnasts')" class="px-3 py-3 w-24">{{ t('member', true) }}</th>
              <th v-if="showCol('waitlist')" class="px-3 py-3 w-20">Waitlist</th>
              <th v-if="showCol('attendances')" class="px-3 py-3 w-24">Attendances</th>
              <th v-if="showCol('termfee')" class="px-3 py-3 w-28">{{ t('term') }} fee</th>
              <th v-if="showCol('age')" class="px-3 py-3 w-24">Age</th>
              <th v-if="showCol('gender')" class="px-3 py-3 w-24">Gender</th>
              <th v-if="showCol('signup')" class="px-3 py-3 w-24">Signup</th>
              <th v-if="showCol('sport')" class="px-3 py-3 w-28">Sport</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="g in sec.rows" :key="g.id"
              class="group border-b border-gray-50 hover:bg-gray-50/60 cursor-pointer"
              :class="dropMark?.id === g.id ? (dropMark.pos === 'before' ? 'shadow-[inset_0_2px_0_0_var(--brand-primary)]' : 'shadow-[inset_0_-2px_0_0_var(--brand-primary)]') : ''"
              draggable="true"
              @dragstart="onGroupDragStart(g, $event)" @dragover.prevent="onGroupDragOver($event, g)"
              @drop.prevent="onGroupDrop(g, sec)" @dragend="resetDrag"
              @click="navigateTo(`/groups/${g.id}`)">
              <td class="px-5 py-2.5">
                <span class="flex items-center gap-2">
                  <i class="pi pi-bars text-gray-300 group-hover:text-gray-600 text-sm cursor-grab active:cursor-grabbing shrink-0 transition-colors" title="Drag to reorder — drop on a programme name to move it there" />
                  <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: g.color || '#94a3b8' }" />
                  <span class="font-medium text-gray-800">{{ g.name }}</span>
                </span>
              </td>
              <td v-if="showCol('head')" class="px-3 py-2.5 text-gray-600">{{ g.headName || '—' }}</td>
              <td v-if="showCol('gymnasts')" class="px-3 py-2.5 font-medium" :class="countClass(g)">{{ countLabel(g) }}</td>
              <td v-if="showCol('waitlist')" class="px-3 py-2.5 text-gray-600">{{ g.waitlist || '' }}</td>
              <td v-if="showCol('attendances')" class="px-3 py-2.5 text-gray-600">{{ g.attendances || '—' }}</td>
              <td v-if="showCol('termfee')" class="px-3 py-2.5 text-xs">
                <span v-if="g.feeCount === 0" class="text-gray-500">Free</span>
                <span v-else-if="g.feeCount > 1" class="italic text-gray-500">varies</span>
                <span v-else class="text-gray-700">{{ g.feeLabel }}</span>
              </td>
              <td v-if="showCol('age')" class="px-3 py-2.5 text-gray-600 text-xs">{{ g.ageRange || 'Any' }}</td>
              <td v-if="showCol('gender')" class="px-3 py-2.5 text-gray-600 text-xs">{{ genderLabel(g.gender) }}</td>
              <td v-if="showCol('signup')" class="px-3 py-2.5 text-xs" @click.stop>
                <span v-if="g.formId" class="text-emerald-600 whitespace-nowrap"><i class="pi pi-check-circle" /> Live</span>
                <span v-else class="text-gray-400 whitespace-nowrap" v-tooltip.top="`No sign-up form yet — connect one on the ${t('group', false, true)} page`"><i class="pi pi-times-circle" /> Not live</span>
              </td>
              <td v-if="showCol('sport')" class="px-3 py-2.5 text-gray-500 text-xs">{{ g.sport || '' }}</td>
            </tr>
            <tr v-if="showCol('gymnasts')" class="bg-gray-50/60">
              <td class="px-5 py-2 text-xs italic text-gray-500">Total {{ t('member', true, true) }}</td>
              <td v-if="showCol('head')"></td>
              <td class="px-3 py-2 text-xs italic font-semibold text-gray-600">{{ sec.total }}</td>
              <td v-if="showCol('waitlist')"></td>
              <td v-if="showCol('attendances')"></td>
              <td v-if="showCol('termfee')"></td>
              <td v-if="showCol('age')"></td>
              <td v-if="showCol('gender')"></td>
              <td v-if="showCol('signup')"></td>
              <td v-if="showCol('sport')"></td>
            </tr>
          </tbody>
        </table>

        <!-- Mobile card list -->
        <div class="md:hidden divide-y divide-gray-100">
          <NuxtLink v-if="sec.key !== '__other'" :to="`/groups/timetable?codes=${sec.key}`"
            class="flex items-center justify-between gap-2 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-50/60 active:bg-gray-100">
            <span>{{ sec.title }}</span><i class="pi pi-calendar text-xs text-gray-400" />
          </NuxtLink>
          <div v-else class="px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-50/60">{{ sec.title }}</div>
          <button v-for="g in sec.rows" :key="g.id" @click="navigateTo(`/groups/${g.id}`)"
            class="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: g.color || '#94a3b8' }" />
                <span class="font-medium text-gray-800 truncate">{{ g.name }}</span>
              </div>
              <div v-if="showCol('head') || showCol('sport')" class="text-xs text-gray-500 mt-0.5">
                <template v-if="showCol('head')">{{ g.headName || '—' }}</template><template v-if="showCol('sport') && g.sport"> · {{ g.sport }}</template>
              </div>
              <div v-if="showCol('gender') || showCol('age') || showCol('termfee') || showCol('attendances') || showCol('signup')"
                class="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                <span v-if="showCol('age')">Age {{ g.ageRange || 'Any' }}</span>
                <span v-if="showCol('gender')">{{ genderLabel(g.gender) }}</span>
                <span v-if="showCol('attendances')">{{ g.attendances || 0 }} sessions</span>
                <span v-if="showCol('termfee')">
                  <template v-if="g.feeCount === 0">Free</template>
                  <template v-else-if="g.feeCount > 1">Fees vary</template>
                  <template v-else>{{ g.feeLabel }}</template>
                </span>
                <span v-if="showCol('signup')" :class="g.formId ? 'text-emerald-600' : 'text-gray-400'">
                  {{ g.formId ? 'Live' : 'Not live' }}
                </span>
              </div>
            </div>
            <span v-if="showCol('gymnasts')" class="text-sm font-medium shrink-0 px-2 py-0.5 rounded" :class="countClass(g)">{{ countLabel(g) }}</span>
          </button>
          <div v-if="showCol('gymnasts')" class="px-4 py-2 text-xs italic text-gray-500 flex justify-between">
            <span>Total {{ t('member', true, true) }}</span><span class="font-semibold text-gray-600">{{ sec.total }}</span>
          </div>
        </div>
      </div>

      <p v-if="showCol('gymnasts') && activeSections.length > 1" class="text-right text-sm text-gray-600 px-1">
        <span class="italic">Tab total:</span> <span class="font-semibold">{{ tabTotal }}</span> {{ t('member', true, true) }}
      </p>
    </template>

    <!-- New tab dialog -->
    <Dialog v-if="allowNewTab" v-model:visible="newTabOpen" modal header="New top-level tab" :style="{ width: '95vw', maxWidth: '380px' }">
      <p class="text-sm text-gray-500 mb-3">A tab is a top-level {{ t('code', false, true) }}. Add sub-{{ t('code', true, true) }} + assign {{ t('group', true, true) }} on <NuxtLink to="/groups/codes" class="text-primary hover:underline">Organise {{ t('code', true, true) }}</NuxtLink>.</p>
      <label class="text-xs font-medium text-gray-600">Name</label>
      <InputText v-model="newTabName" class="w-full mt-1" placeholder="e.g. Competitive" @keyup.enter="createTab" autofocus />
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="newTabOpen = false" />
        <Button label="Add tab" style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="createTab" />
      </template>
    </Dialog>
  </div>
</template>
