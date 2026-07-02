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
  columns: () => ['head', 'gymnasts', 'waitlist', 'attendances', 'termfee', 'gender', 'signup', 'sport'],
  codeIds: () => [],
  allowNewTab: false,
})

const db = useDb()
const { orgId } = useOrg()
const toast = useToast()
const gc = useGroupCodes()
const scoped = useScopedRoles()
const gf = useGroupFees()
const tm = useTermsMemberships()

const showCol = (k: ViewColumnKey) => props.columns.includes(k)

interface ClassGroup {
  id: string; name: string; code_id: string | null; term_id: string | null; capacity: number | null; color: string | null
  headName: string | null; gymnasts: number; waitlist: number | null; sport: string | null
  gender: string | null; feeLabel: string | null; feeCount: number; attendances: number
}

// Gender restriction (migration 203) → short label; null = open to all.
const GENDER_LABELS: Record<string, string> = { MALE: 'Male', FEMALE: 'Female', NON_BINARY: 'Non-binary' }
const genderLabel = (g: string | null) => g ? (GENDER_LABELS[g] ?? g) : 'Any'

const codes = ref<GroupCode[]>([])
const groups = ref<ClassGroup[]>([])
const terms = ref<{ id: string; name: string; start_date: string | null; end_date: string | null }[]>([])
const termFilter = ref<string>('all')  // 'all' | org_terms.id
const termDefaulted = ref(false)        // only auto-pick the default term on first load
const loading = ref(true)

const termOptions = computed(() => [
  { label: 'All terms', value: 'all' },
  ...terms.value.map(t => ({ label: t.name, value: t.id })),
])
// A group belongs to the selected term via its code chain (else its own term_id).
const inTerm = (g: ClassGroup) => termFilter.value === 'all' || gc.effectiveTermId(g, codeById.value) === termFilter.value
const visibleGroups = computed(() => groups.value.filter(inTerm))

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
const groupsInCode = (codeId: string) => visibleGroups.value.filter(g => g.code_id === codeId).sort((a, b) => a.name.localeCompare(b.name))

type Tab = { key: string; label: string }
const tabs = computed<Tab[]>(() => {
  const t: Tab[] = topCodes.value.map(c => ({ key: c.id, label: c.name }))
  if (hasUngrouped.value) t.push({ key: '__other', label: 'Other' })
  return t
})
const activeTab = ref<string>('')
watch(tabs, ts => { if (!ts.some(t => t.key === activeTab.value)) activeTab.value = ts[0]?.key ?? '' }, { immediate: true })

interface Section { key: string; title: string; rows: ClassGroup[]; total: number }
const activeSections = computed<Section[]>(() => {
  if (activeTab.value === '__other') {
    const rows = visibleGroups.value.filter(g => !g.code_id || !codeById.value[g.code_id]).sort((a, b) => a.name.localeCompare(b.name))
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

async function load() {
  if (!orgId.value) return
  loading.value = true
  await scoped.loadRoleDefs()
  const [loadedCodes, loadedTerms, { data: gs }, { data: mems }, { data: discs }, { data: feeOpts }, { data: evs }] = await Promise.all([
    gc.loadCodes(),
    tm.loadTerms(),
    (db.from as any)('member_groups').select('id, name, code_id, term_id, capacity, color, gender_restriction').eq('org_id', orgId.value),
    (db.from as any)('member_group_memberships').select('group_id, role, roles, person:persons!inner(first_name, last_name)'),
    (db.from as any)('member_group_disciplines').select('group_id, discipline:disciplines(sport, name)'),
    (db.from as any)('group_fee_options').select('id, group_id, name, fee_type, period_unit, period_count, instalment_count, session_count, prorata, items:group_fee_option_items(amount)').eq('org_id', orgId.value),
    (db.from as any)('events').select('member_group_id').eq('org_id', orgId.value).not('member_group_id', 'is', null),
  ])
  codes.value = loadedCodes
  terms.value = (loadedTerms ?? []).map((t: any) => ({ id: t.id, name: t.name, start_date: t.start_date ?? null, end_date: t.end_date ?? null }))
  const memByGroup: Record<string, any[]> = {}
  for (const m of mems ?? []) (memByGroup[m.group_id] ??= []).push(m)
  const sportByGroup: Record<string, string> = {}
  for (const d of discs ?? []) if (!sportByGroup[d.group_id]) sportByGroup[d.group_id] = d.discipline?.sport || d.discipline?.name || ''
  // Term fee: group's fee options → single = its price label, multiple = "varies", none = ✗.
  const feesByGroup: Record<string, any[]> = {}
  for (const o of feeOpts ?? []) (feesByGroup[o.group_id] ??= []).push(o)
  // Attendances: number of training events linked to the group (member_group_id set).
  const attByGroup: Record<string, number> = {}
  for (const e of evs ?? []) attByGroup[e.member_group_id] = (attByGroup[e.member_group_id] || 0) + 1

  groups.value = (gs ?? []).map((g: any): ClassGroup => {
    const rows = memByGroup[g.id] ?? []
    let head: any = null, gymnasts = 0
    for (const m of rows) {
      const roleKeys = scoped.normalizeRoles('group', m.roles, m.role)
      if (scoped.isStaff('group', roleKeys)) { if (!head) head = m.person }
      else gymnasts++
    }
    const opts = feesByGroup[g.id] ?? []
    return {
      id: g.id, name: g.name, code_id: g.code_id ?? null, term_id: g.term_id ?? null, capacity: g.capacity ?? null, color: g.color ?? null,
      headName: head ? `${head.first_name ?? ''} ${head.last_name ?? ''}`.trim() || null : null,
      gymnasts, waitlist: null, sport: sportByGroup[g.id] || null,
      gender: g.gender_restriction ?? null,
      feeCount: opts.length,
      feeLabel: opts.length === 1 ? gf.priceLabel({ ...opts[0], items: opts[0].items ?? [] } as any) : null,
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
watch(orgId, () => { if (orgId.value) load() }, { immediate: true })
</script>

<template>
  <div class="space-y-4">
    <div v-if="loading" class="card p-6 text-sm text-gray-400">Loading…</div>
    <div v-else-if="!codes.length" class="card p-6 text-sm text-gray-500">
      No codes yet — create one on <NuxtLink to="/groups/codes" class="text-primary hover:underline">Organise codes</NuxtLink> first.
    </div>
    <div v-else-if="!tabs.length" class="card p-6 text-sm text-gray-400">This view has no codes to show.</div>

    <template v-else>
      <!-- Term filter — a group belongs to a term via its code chain (else its own
           term_id). Defaults to the current-date term when it has groups. -->
      <div v-if="terms.length" class="flex items-center gap-2">
        <label class="text-xs font-medium text-gray-500 shrink-0">Term</label>
        <Select v-model="termFilter" :options="termOptions" option-label="label" option-value="value" class="w-full sm:w-56" />
      </div>

      <!-- Tab strip — hidden when there's only one tab (nothing to switch between);
           the desktop strip still shows if the landing allows adding a tab. -->
      <div v-if="tabs.length > 1" class="md:hidden">
        <Select v-model="activeTab" :options="tabs" option-label="label" option-value="key" class="w-full" />
      </div>
      <div v-if="tabs.length > 1" class="hidden md:flex items-center gap-1 border-b border-gray-200 overflow-x-auto no-scrollbar">
        <button v-for="t in tabs" :key="t.key" @click="activeTab = t.key"
          class="px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition"
          :class="activeTab === t.key ? 'border-primary text-primary font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'">
          {{ t.label }}
        </button>
        <button v-if="allowNewTab" @click="newTabOpen = true" v-tooltip.top="'New top-level tab'"
          class="px-2 py-2 text-sm text-gray-400 hover:text-primary whitespace-nowrap">
          <i class="pi pi-plus text-xs" /> Tab
        </button>
      </div>

      <div v-if="!activeSections.length" class="card p-6 text-sm text-gray-400">No classes in this tab yet.</div>

      <div v-for="sec in activeSections" :key="sec.key" class="card p-0 overflow-hidden">
        <!-- Desktop table -->
        <table class="hidden md:table w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 text-left text-xs font-semibold text-gray-700">
              <th class="px-5 py-3 w-[38%]">{{ sec.title }}</th>
              <th v-if="showCol('head')" class="px-3 py-3">Head</th>
              <th v-if="showCol('gymnasts')" class="px-3 py-3 w-24">Gymnasts</th>
              <th v-if="showCol('waitlist')" class="px-3 py-3 w-20">Waitlist</th>
              <th v-if="showCol('attendances')" class="px-3 py-3 w-24">Attendances</th>
              <th v-if="showCol('termfee')" class="px-3 py-3 w-28">Term fee</th>
              <th v-if="showCol('gender')" class="px-3 py-3 w-24">Gender</th>
              <th v-if="showCol('signup')" class="px-3 py-3 w-24">Signup</th>
              <th v-if="showCol('sport')" class="px-3 py-3 w-28">Sport</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="g in sec.rows" :key="g.id" class="border-b border-gray-50 hover:bg-gray-50/60 cursor-pointer"
              @click="navigateTo(`/groups/${g.id}`)">
              <td class="px-5 py-2.5">
                <span class="inline-flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: g.color || '#94a3b8' }" />
                  <span class="font-medium text-gray-800">{{ g.name }}</span>
                </span>
              </td>
              <td v-if="showCol('head')" class="px-3 py-2.5 text-gray-600">{{ g.headName || '—' }}</td>
              <td v-if="showCol('gymnasts')" class="px-3 py-2.5 font-medium" :class="countClass(g)">{{ countLabel(g) }}</td>
              <td v-if="showCol('waitlist')" class="px-3 py-2.5 text-gray-600">{{ g.waitlist || '' }}</td>
              <td v-if="showCol('attendances')" class="px-3 py-2.5 text-gray-600">{{ g.attendances || '—' }}</td>
              <td v-if="showCol('termfee')" class="px-3 py-2.5 text-xs">
                <span v-if="g.feeCount === 0" class="text-red-500"><i class="pi pi-times-circle" /></span>
                <span v-else-if="g.feeCount > 1" class="italic text-gray-500">varies</span>
                <span v-else class="text-gray-700">{{ g.feeLabel }}</span>
              </td>
              <td v-if="showCol('gender')" class="px-3 py-2.5 text-gray-600 text-xs">{{ genderLabel(g.gender) }}</td>
              <td v-if="showCol('signup')" class="px-3 py-2.5 text-xs" @click.stop>
                <span v-if="g.feeCount > 0" class="text-emerald-600 whitespace-nowrap"><i class="pi pi-check-circle" /> Live</span>
                <span v-else class="text-gray-400 whitespace-nowrap" v-tooltip.top="'No fee option yet — add one on the group Fees tab'"><i class="pi pi-times-circle" /> Not live</span>
              </td>
              <td v-if="showCol('sport')" class="px-3 py-2.5 text-gray-500 text-xs">{{ g.sport || '' }}</td>
            </tr>
            <tr v-if="showCol('gymnasts')" class="bg-gray-50/60">
              <td class="px-5 py-2 text-xs italic text-gray-500">Total gymnasts</td>
              <td v-if="showCol('head')"></td>
              <td class="px-3 py-2 text-xs italic font-semibold text-gray-600">{{ sec.total }}</td>
              <td v-if="showCol('waitlist')"></td>
              <td v-if="showCol('attendances')"></td>
              <td v-if="showCol('termfee')"></td>
              <td v-if="showCol('gender')"></td>
              <td v-if="showCol('signup')"></td>
              <td v-if="showCol('sport')"></td>
            </tr>
          </tbody>
        </table>

        <!-- Mobile card list -->
        <div class="md:hidden divide-y divide-gray-100">
          <div class="px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-50/60">{{ sec.title }}</div>
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
              <div v-if="showCol('gender') || showCol('termfee') || showCol('attendances') || showCol('signup')"
                class="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                <span v-if="showCol('gender')">{{ genderLabel(g.gender) }}</span>
                <span v-if="showCol('attendances')">{{ g.attendances || 0 }} sessions</span>
                <span v-if="showCol('termfee')">
                  <template v-if="g.feeCount === 0">No fee</template>
                  <template v-else-if="g.feeCount > 1">Fees vary</template>
                  <template v-else>{{ g.feeLabel }}</template>
                </span>
                <span v-if="showCol('signup')" :class="g.feeCount > 0 ? 'text-emerald-600' : 'text-gray-400'">
                  {{ g.feeCount > 0 ? 'Live' : 'Not live' }}
                </span>
              </div>
            </div>
            <span v-if="showCol('gymnasts')" class="text-sm font-medium shrink-0 px-2 py-0.5 rounded" :class="countClass(g)">{{ countLabel(g) }}</span>
          </button>
          <div v-if="showCol('gymnasts')" class="px-4 py-2 text-xs italic text-gray-500 flex justify-between">
            <span>Total gymnasts</span><span class="font-semibold text-gray-600">{{ sec.total }}</span>
          </div>
        </div>
      </div>

      <p v-if="showCol('gymnasts') && activeSections.length > 1" class="text-right text-sm text-gray-600 px-1">
        <span class="italic">Tab total:</span> <span class="font-semibold">{{ tabTotal }}</span> gymnasts
      </p>
    </template>

    <!-- New tab dialog -->
    <Dialog v-if="allowNewTab" v-model:visible="newTabOpen" modal header="New top-level tab" :style="{ width: '95vw', maxWidth: '380px' }">
      <p class="text-sm text-gray-500 mb-3">A tab is a top-level code. Add sub-codes + assign groups on <NuxtLink to="/groups/codes" class="text-primary hover:underline">Organise codes</NuxtLink>.</p>
      <label class="text-xs font-medium text-gray-600">Name</label>
      <InputText v-model="newTabName" class="w-full mt-1" placeholder="e.g. Competitive" @keyup.enter="createTab" autofocus />
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="newTabOpen = false" />
        <Button label="Add tab" style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="createTab" />
      </template>
    </Dialog>
  </div>
</template>
