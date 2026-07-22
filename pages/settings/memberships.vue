<!--
  Settings → Terms & memberships. Org-level definition of the two billing models
  a club can run (and mix):

    • Terms       — shared date-ranged periods (Term 1 2026 …). Groups attach to
                    these on /groups/:id, each with their own per-term fee.
    • Memberships — recurring named plans (Senior, Junior) with duration OPTIONS
                    (1 / 3 / 6 month + price) that auto-roll over. Groups connect
                    to plans on /groups/:id.

  Persists to org_terms / membership_plans / membership_plan_options
  (migration 200). Row-based editors with delete-then-upsert saves, mirroring
  <OrgSportsEditor>.
-->
<script setup lang="ts">
// Every term/plan/plan-option read + write now goes through the memberships +
// organisations seam — no direct DB access on this page.
const { orgId } = useOrg()
const toast = useToast()
const { ensureTerms, t } = useTerms()
void ensureTerms()
useBreadcrumbs([{ label: 'Memberships' }])
const { toIso, periodLabel, loadTerms, loadPlans, loadTermSets, createTermSet, renameTermSet, setTermSetSport, setTermSetLocations, deleteTermSet } = useTermsMemberships()
const {
  createTerm, updateTerm, removeTerm: apiRemoveTerm,
  createPlan, updatePlan, removePlan: apiRemovePlan,
  createPlanOption, updatePlanOption, removePlanOptions,
} = useMembershipsApi()
const { getProfile } = useOrganisationsApi()
const { orgSports } = useAffiliationsApi()
import type { TermSet } from '~/composables/useTermsMemberships'

const currency = ref('NZD')
const loading = ref(true)

// ---------- Terms ----------
interface TermRow {
  id: string | null
  name: string
  start_date: Date | null
  end_date: Date | null
  // Sign-up window (migration 229). Blank open = open right away; blank close = term end.
  signup_open: Date | null
  signup_close: Date | null
  // Term set (migration 232) — null = the default/main sequence.
  set_id: string | null
  sort_order: number
}
const terms = ref<TermRow[]>([])
const seasonsTab = ref<'current' | 'past' | 'timeline'>('current')
const onListTab = computed(() => seasonsTab.value !== 'timeline')
// A term is PAST once its end date is behind today; no end date = current.
function termIsPast(r: TermRow): boolean {
  if (!r.end_date) return false
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return r.end_date.getTime() < today.getTime()
}
let removedTermIds: string[] = []
const savingTerms = ref(false)

// ---------- Term sets (migration 232) ----------
// Independent term sequences: Term 1→2→3 is one set, the Seniors' two halves
// another. Rollover/nudge "next term" only resolves within a set.
const sets = ref<TermSet[]>([])
const termSections = computed(() => {
  // Current tab = not-yet-ended terms; Past = ended; Timeline shows everything.
  const byTab = (t: TermRow) =>
    seasonsTab.value === 'past' ? termIsPast(t)
    : seasonsTab.value === 'current' ? !termIsPast(t)
    : true
  const all = [
    { key: '__default', set: null as TermSet | null, list: terms.value.filter(t => !t.set_id).filter(byTab) },
    ...sets.value.map(s => ({ key: s.id, set: s as TermSet | null, list: terms.value.filter(t => t.set_id === s.id).filter(byTab) })),
  ]
  // The Past tab only lists sequences that actually have past terms.
  return seasonsTab.value === 'past' ? all.filter(sec => sec.list.length) : all
})
const pastCount = computed(() => terms.value.filter(termIsPast).length)
async function addSet() {
  const s = await createTermSet('New term set')
  if (s) sets.value.push(s)
}
async function onRenameSet(s: TermSet) {
  if (s.name.trim()) await renameTermSet(s.id, s.name.trim())
}
// A set can be connected to one of the club's sports (migration 235).
const sports = ref<{ id: string; label: string }[]>([])
const sportOptions = computed(() => [
  { label: 'Whole club', value: null as string | null },
  ...sports.value.map(s => ({ label: s.label, value: s.id as string | null })),
])
async function onSetSport(s: TermSet, sportId: string | null) {
  s.sport_id = sportId
  await setTermSetSport(s.id, sportId)
}
// A sequence can run at one or MORE locations (migration 239); empty = whole club.
const { locations: clubLocations, ensureLocations } = useActiveLocation()
void ensureLocations()
const locationOptions = computed(() => clubLocations.value.map(l => ({ label: l.name, value: l.id })))
async function onSetLocations(s: TermSet, ids: string[]) {
  s.location_ids = ids?.length ? ids : null
  await setTermSetLocations(s.id, ids)
}
async function removeSet(s: TermSet) {
  const count = terms.value.filter(t => t.set_id === s.id).length
  if (!window.confirm(count ? `Delete "${s.name}"? Its ${count} ${count === 1 ? t('term', false, true) : t('term', true, true)} move to the main sequence.` : `Delete "${s.name}"?`)) return
  await deleteTermSet(s.id)
  for (const t of terms.value) if (t.set_id === s.id) t.set_id = null
  sets.value = sets.value.filter(x => x.id !== s.id)
}

function addTerm(setId: string | null = null) {
  terms.value.push({ id: null, name: '', start_date: null, end_date: null, signup_open: null, signup_close: null, set_id: setId, sort_order: terms.value.length })
}
function removeTerm(r: TermRow) {
  if (r.id) removedTermIds.push(r.id)
  terms.value = terms.value.filter(t => t !== r)
}
async function saveTerms() {
  savingTerms.value = true
  try {
    if (removedTermIds.length) {
      for (const id of removedTermIds) await apiRemoveTerm(id)
      removedTermIds = []
    }
    for (let i = 0; i < terms.value.length; i++) {
      const r = terms.value[i]
      if (!r.name.trim() || !r.start_date || !r.end_date) continue
      const payload = {
        orgId: orgId.value,
        name: r.name.trim(),
        startDate: toIso(r.start_date),
        endDate: toIso(r.end_date),
        signupOpen: r.signup_open ? toIso(r.signup_open) : null,
        signupClose: r.signup_close ? toIso(r.signup_close) : null,
        setId: r.set_id,
        sortOrder: i,
      }
      if (r.id) await updateTerm(r.id, payload)
      else { const created = await createTerm(payload); r.id = created.id }
    }
    toast.add({ severity: 'success', summary: `${t('term', true)} saved`, life: 2500 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: `Could not save ${t('term', true, true)}`, detail: e?.message, life: 4000 })
  } finally {
    savingTerms.value = false
  }
}

// ---------- Timeline (visual view of every sequence, wizard-style) ----------
const MS_DAY = 86400000
const timeline = computed(() => {
  const rows = termSections.value
    .map(sec => ({
      name: sec.set?.name ?? `Main ${t('term', true, true)}`,
      terms: sec.list.filter(r => r.start_date && r.end_date),
    }))
    .filter(r => r.terms.length)
  if (!rows.length) return null
  const dates: number[] = []
  for (const r of rows) for (const tr of r.terms) {
    dates.push(tr.start_date!.getTime(), tr.end_date!.getTime())
    if (tr.signup_open) dates.push(tr.signup_open.getTime())
  }
  const min = Math.min(...dates) - 7 * MS_DAY
  const max = Math.max(...dates) + 7 * MS_DAY
  const span = max - min
  const pct = (d: Date | number) => Math.min(100, Math.max(0, ((typeof d === 'number' ? d : d.getTime()) - min) / span * 100))
  const fmt = (d: number) => new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })
  const now = Date.now()
  return {
    axisStart: fmt(min), axisEnd: fmt(max),
    today: now >= min && now <= max ? pct(now) : null,
    rows: rows.map(r => ({
      name: r.name,
      segments: r.terms.map(tr => {
        const st = tr.start_date!.getTime(), en = tr.end_date!.getTime()
        const weeks = Math.round((en - st) / (7 * MS_DAY))
        const suo = tr.signup_open ? tr.signup_open.getTime() : null
        const suc = tr.signup_close ? tr.signup_close.getTime() : en
        return {
          left: pct(st), width: Math.max(pct(en) - pct(st), 1.5),
          label: `${tr.name || 'Untitled'} · ${weeks} wks`,
          ticks: Array.from({ length: Math.max(weeks - 1, 0) }, (_, i) => ((i + 1) / weeks) * 100),
          signup: suo != null ? { left: pct(suo), width: Math.max(pct(suc) - pct(suo), 1) } : null,
        }
      }),
    })),
  }
})

// ---------- Membership plans ----------
const UNITS = [
  { label: 'week', value: 'week' },
  { label: 'month', value: 'month' },
  { label: 'year', value: 'year' },
]
interface OptionRow {
  id: string | null
  name: string
  period_unit: 'week' | 'month' | 'year'
  period_count: number
  price: number | null
  auto_renew: boolean
}
interface PlanRow {
  id: string | null
  name: string
  description: string
  color: string | null
  options: OptionRow[]
  _removedOptionIds: string[]
}
const plans = ref<PlanRow[]>([])
let removedPlanIds: string[] = []
const savingPlans = ref(false)

function addPlan() {
  plans.value.push({ id: null, name: '', description: '', color: '#1E2157', options: [], _removedOptionIds: [] })
}
function removePlan(i: number) {
  const p = plans.value[i]
  if (p.id) removedPlanIds.push(p.id)
  plans.value.splice(i, 1)
}
function addOption(p: PlanRow) {
  p.options.push({ id: null, name: '', period_unit: 'month', period_count: 1, price: null, auto_renew: true })
}
function removeOption(p: PlanRow, i: number) {
  const o = p.options[i]
  if (o.id) p._removedOptionIds.push(o.id)
  p.options.splice(i, 1)
}
async function savePlans() {
  savingPlans.value = true
  try {
    // Plan BASE rows go through the memberships seam (createPlan/updatePlan/removePlan).
    if (removedPlanIds.length) {
      for (const id of removedPlanIds) await apiRemovePlan(id)
      removedPlanIds = []
    }
    for (let i = 0; i < plans.value.length; i++) {
      const p = plans.value[i]
      if (!p.name.trim()) continue
      const planPayload = {
        orgId: orgId.value,
        name: p.name.trim(),
        description: p.description?.trim() || null,
        color: p.color || null,
        sortOrder: i,
      }
      if (p.id) await updatePlan(p.id, planPayload)
      else { const created = await createPlan(planPayload); p.id = created.id }
      if (!p.id) continue
      // A plan's duration options go through the memberships seam (create/update/
      // bulk-delete). The seam takes camelCase; the DECIMAL price passes through.
      if (p._removedOptionIds.length) {
        await removePlanOptions(p.id, p._removedOptionIds)
        p._removedOptionIds = []
      }
      for (let j = 0; j < p.options.length; j++) {
        const o = p.options[j]
        const optPayload = {
          planId: p.id,
          name: o.name?.trim() || null,
          periodUnit: o.period_unit,
          periodCount: Number(o.period_count) || 1,
          price: o.price,
          autoRenew: !!o.auto_renew,
          sortOrder: j,
        }
        if (o.id) await updatePlanOption(o.id, optPayload)
        else { const created = await createPlanOption(optPayload); o.id = created.id }
      }
    }
    toast.add({ severity: 'success', summary: 'Memberships saved', life: 2500 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Could not save memberships', detail: e?.message, life: 4000 })
  } finally {
    savingPlans.value = false
  }
}

// ---------- load ----------
async function load() {
  loading.value = true
  if (!orgId.value) { loading.value = false; return }
  const profile = await getProfile(orgId.value)
  if (profile?.currency) currency.value = profile.currency

  sets.value = await loadTermSets()
  const sp = await orgSports(orgId.value)
  sports.value = (sp ?? []).map((s: any) => ({ id: s.id, label: s.displayName || s.sport }))

  // loadTerms returns snake-cased OrgTerms; re-order to match the old query
  // (sort_order asc, then start_date) and wrap the ISO date strings as Dates.
  const t = (await loadTerms(orgId.value)).slice()
    .sort((a, b) => (a.sort_order - b.sort_order) || (a.start_date || '').localeCompare(b.start_date || ''))
  terms.value = t.map((r: any) => ({
    id: r.id, name: r.name,
    start_date: r.start_date ? new Date(r.start_date + 'T00:00:00') : null,
    end_date: r.end_date ? new Date(r.end_date + 'T00:00:00') : null,
    signup_open: r.signup_open ? new Date(r.signup_open + 'T00:00:00') : null,
    signup_close: r.signup_close ? new Date(r.signup_close + 'T00:00:00') : null,
    set_id: r.set_id ?? null,
    sort_order: r.sort_order ?? 0,
  }))

  // loadPlans returns snake-cased plans hydrated with their (snake) options.
  const planList = (await loadPlans(orgId.value)).slice()
    .sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name))
  const optsByPlan: Record<string, any[]> = Object.fromEntries(planList.map(p => [p.id, (p as any).options || []]))
  plans.value = planList.map((p: any) => ({
    id: p.id, name: p.name, description: p.description || '', color: p.color || '#1E2157',
    _removedOptionIds: [],
    options: (optsByPlan[p.id] || []).map((o: any) => ({
      id: o.id, name: o.name || '', period_unit: o.period_unit, period_count: o.period_count,
      price: o.price, auto_renew: o.auto_renew,
    })),
  }))
  loading.value = false
}

onMounted(load)
watch(orgId, v => { if (v) load() })
</script>

<template>
  <div class="p-3 sm:p-6">
    <div class="max-w-[1200px] space-y-5">
        <div>
          <p class="text-sm text-gray-500">Recurring plans (e.g. Senior) with duration options that roll over. Connect a plan to a {{ t('group', false, true) }} on the {{ t('group', false, true) }}'s page.</p>
        </div>

        <div v-if="loading" class="text-sm text-gray-400">Loading…</div>

        <template v-else>
          <!-- MEMBERSHIPS -->
          <AppCard title="Memberships" description="Recurring plans (e.g. Senior) with one or more duration options that roll over. A member keeps the same plan; they just pick a duration.">
            <div class="p-4 sm:p-5 space-y-4">
              <div v-for="(p, pi) in plans" :key="pi" class="rounded-xl border border-gray-200 overflow-hidden">
                <div class="flex items-center gap-2 px-3 py-2.5 bg-gray-50/60 border-b border-gray-100">
                  <input type="color" v-model="p.color" class="w-7 h-7 rounded cursor-pointer border-0 bg-transparent p-0 shrink-0" title="Plan colour" />
                  <InputText v-model="p.name" placeholder="Senior membership" class="flex-1 min-w-0" />
                  <button class="text-gray-400 hover:text-red-500 shrink-0" @click="removePlan(pi)"><i class="pi pi-trash" /></button>
                </div>
                <div class="p-3 space-y-3">
                  <InputText v-model="p.description" placeholder="Optional description" class="w-full" />

                  <!-- options -->
                  <div class="space-y-2">
                    <div v-if="p.options.length" class="hidden sm:grid grid-cols-[80px_1fr_140px_120px_40px] gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">
                      <span>Every</span><span>Unit</span><span>Price</span><span>Auto-renew</span><span></span>
                    </div>
                    <div v-for="(o, oi) in p.options" :key="oi"
                      class="grid grid-cols-2 sm:grid-cols-[80px_1fr_140px_120px_40px] gap-2 items-center">
                      <InputNumber v-model="o.period_count" :min="1" :max="60" class="w-20" :input-class="'w-20 text-center'" :use-grouping="false" />
                      <Select v-model="o.period_unit" :options="UNITS" optionLabel="label" optionValue="value" class="w-full" />
                      <InputNumber v-model="o.price" mode="currency" :currency="currency" locale="en-NZ" :min="0" placeholder="Price" class="w-full" />
                      <div class="flex items-center gap-2">
                        <ToggleSwitch v-model="o.auto_renew" />
                        <span class="text-xs text-gray-500 sm:hidden">Auto-renew</span>
                      </div>
                      <button class="text-gray-400 hover:text-red-500 justify-self-start sm:justify-self-center" @click="removeOption(p, oi)"><i class="pi pi-trash" /></button>
                    </div>
                    <p v-if="!p.options.length" class="text-xs text-gray-400">No duration options — add 1 month / 3 month etc.</p>
                    <button class="text-sm text-primary hover:underline" @click="addOption(p)">+ Add duration option</button>
                  </div>
                </div>
              </div>
              <p v-if="!plans.length" class="text-sm text-gray-400">No membership plans yet.</p>
              <div class="flex items-center justify-between pt-1">
                <button class="text-sm text-primary hover:underline" @click="addPlan">+ Add membership</button>
                <Button label="Save memberships" size="small" :loading="savingPlans"
                  style="background:#1E2157;border-color:#1E2157" @click="savePlans" />
              </div>
            </div>
          </AppCard>
        </template>
    </div>
  </div>
</template>
