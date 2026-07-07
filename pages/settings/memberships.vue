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
const db = useDb()
const { orgId } = useOrg()
const toast = useToast()
const { ensureTerms, t } = useTerms()
void ensureTerms()
const { toIso, periodLabel, loadTermSets, createTermSet, renameTermSet, setTermSetSport, setTermSetLocations, deleteTermSet } = useTermsMemberships()
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
      await (db.from as any)('org_terms').delete().in('id', removedTermIds)
      removedTermIds = []
    }
    for (let i = 0; i < terms.value.length; i++) {
      const r = terms.value[i]
      if (!r.name.trim() || !r.start_date || !r.end_date) continue
      const payload = {
        org_id: orgId.value,
        name: r.name.trim(),
        start_date: toIso(r.start_date),
        end_date: toIso(r.end_date),
        signup_open: r.signup_open ? toIso(r.signup_open) : null,
        signup_close: r.signup_close ? toIso(r.signup_close) : null,
        set_id: r.set_id,
        sort_order: i,
      }
      if (r.id) await (db.from as any)('org_terms').update(payload).eq('id', r.id)
      else {
        const { data } = await (db.from as any)('org_terms').insert(payload).select('id').single()
        if (data) r.id = data.id
      }
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
    if (removedPlanIds.length) {
      await (db.from as any)('membership_plans').delete().in('id', removedPlanIds)
      removedPlanIds = []
    }
    for (let i = 0; i < plans.value.length; i++) {
      const p = plans.value[i]
      if (!p.name.trim()) continue
      const planPayload = {
        org_id: orgId.value,
        name: p.name.trim(),
        description: p.description?.trim() || null,
        color: p.color || null,
        sort_order: i,
      }
      if (p.id) await (db.from as any)('membership_plans').update(planPayload).eq('id', p.id)
      else {
        const { data } = await (db.from as any)('membership_plans').insert(planPayload).select('id').single()
        if (data) p.id = data.id
      }
      if (!p.id) continue
      if (p._removedOptionIds.length) {
        await (db.from as any)('membership_plan_options').delete().in('id', p._removedOptionIds)
        p._removedOptionIds = []
      }
      for (let j = 0; j < p.options.length; j++) {
        const o = p.options[j]
        const optPayload = {
          plan_id: p.id,
          name: o.name?.trim() || null,
          period_unit: o.period_unit,
          period_count: Number(o.period_count) || 1,
          price: o.price,
          auto_renew: !!o.auto_renew,
          sort_order: j,
        }
        if (o.id) await (db.from as any)('membership_plan_options').update(optPayload).eq('id', o.id)
        else {
          const { data } = await (db.from as any)('membership_plan_options').insert(optPayload).select('id').single()
          if (data) o.id = data.id
        }
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
  const { data: org } = await (db.from as any)('organisations').select('currency').eq('id', orgId.value).maybeSingle()
  if (org?.currency) currency.value = org.currency

  sets.value = await loadTermSets()
  const { data: sp } = await (db.from as any)('org_sports')
    .select('id, sport, display_name').eq('org_id', orgId.value).order('sort_order')
  sports.value = (sp ?? []).map((s: any) => ({ id: s.id, label: s.display_name || s.sport }))

  const { data: t } = await (db.from as any)('org_terms')
    .select('id, name, start_date, end_date, signup_open, signup_close, set_id, sort_order')
    .eq('org_id', orgId.value)
    .order('sort_order', { ascending: true, nullsFirst: false }).order('start_date')
  terms.value = (t || []).map((r: any) => ({
    id: r.id, name: r.name,
    start_date: r.start_date ? new Date(r.start_date + 'T00:00:00') : null,
    end_date: r.end_date ? new Date(r.end_date + 'T00:00:00') : null,
    signup_open: r.signup_open ? new Date(r.signup_open + 'T00:00:00') : null,
    signup_close: r.signup_close ? new Date(r.signup_close + 'T00:00:00') : null,
    set_id: r.set_id ?? null,
    sort_order: r.sort_order ?? 0,
  }))

  const { data: pl } = await (db.from as any)('membership_plans')
    .select('id, name, description, color, sort_order')
    .eq('org_id', orgId.value)
    .order('sort_order', { ascending: true, nullsFirst: false }).order('name')
  const planList = (pl || []) as any[]
  let optsByPlan: Record<string, any[]> = {}
  if (planList.length) {
    const { data: opts } = await (db.from as any)('membership_plan_options')
      .select('id, plan_id, name, period_unit, period_count, price, auto_renew, sort_order')
      .in('plan_id', planList.map(p => p.id))
      .order('sort_order', { ascending: true, nullsFirst: false })
    for (const o of (opts || [])) (optsByPlan[o.plan_id] ||= []).push(o)
  }
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
  <div class="p-3 sm:p-6 min-h-full flex flex-col">
    <div class="flex flex-col md:flex-row gap-4 md:gap-6 flex-1 min-h-0">
      <SettingsNav />
      <div class="flex-1 min-w-0 space-y-5">
        <div>
          <h1 class="text-lg sm:text-2xl font-semibold text-gray-900">{{ t('term', true) }} & memberships</h1>
          <p class="text-sm text-gray-500">Define how your club runs {{ t('group', true, true) }} — fixed <strong>{{ t('term', true, true) }}</strong> (date ranges) and/or recurring <strong>memberships</strong>. Connect them to {{ t('group', true, true) }} on each {{ t('group', false, true) }}'s page.</p>
        </div>

        <div v-if="loading" class="text-sm text-gray-400">Loading…</div>

        <template v-else>
          <!-- TERMS -->
          <AppCard :title="t('term', true)" :description="`Shared date ranges (e.g. Term 1 2026). Attach a ${t('group', false, true)} to one or more ${t('term', true, true)} on the ${t('group', false, true)} page. The sign-up window controls when ${t('member', true, true)} can register for that ${t('term', false, true)}'s ${t('group', true, true)} — leave it blank to open right away and close when the ${t('term', false, true)} ends.`">
            <div class="p-4 sm:p-5 space-y-8">
              <!-- Current / Past / Timeline tabs -->
              <div class="flex gap-5 border-b border-gray-100 -mt-1">
                <button type="button" class="pb-2 -mb-px border-b-2 text-sm font-medium transition-colors"
                  :class="seasonsTab === 'current' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'"
                  @click="seasonsTab = 'current'">Current {{ t('term', true, true) }}</button>
                <button type="button" class="pb-2 -mb-px border-b-2 text-sm font-medium transition-colors"
                  :class="seasonsTab === 'past' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'"
                  @click="seasonsTab = 'past'">Past {{ t('term', true, true) }}<span v-if="pastCount" class="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{{ pastCount }}</span></button>
              </div>

              <!-- Visual view — every sequence on one time axis (wizard-style) -->
              <div v-if="seasonsTab === 'current' && timeline" class="space-y-3 pb-2 border-b border-gray-100">
                <div class="space-y-4">
                  <div v-for="row in timeline.rows" :key="row.name" class="flex items-center gap-3">
                    <span class="w-28 shrink-0 text-[11px] font-semibold text-gray-400 text-right truncate">{{ row.name }}</span>
                    <div class="relative flex-1 h-12">
                      <!-- sign-up lane -->
                      <div v-for="(seg, i) in row.segments" :key="`su${i}`">
                        <div v-if="seg.signup" class="absolute top-0 h-2.5 rounded-full bg-emerald-400/80"
                          :style="{ left: seg.signup.left + '%', width: seg.signup.width + '%' }"
                          v-tooltip.top="'Sign-ups open'" />
                      </div>
                      <!-- term lane -->
                      <div v-for="(seg, i) in row.segments" :key="`t${i}`"
                        class="absolute top-3.5 bottom-0 rounded-lg flex items-center overflow-hidden" style="background:#1E2157"
                        :style="{ left: seg.left + '%', width: seg.width + '%' }">
                        <span v-for="(tick, j) in seg.ticks" :key="j" class="absolute top-0 bottom-0 w-px bg-white/25" :style="{ left: tick + '%' }" />
                        <span class="relative text-[11px] font-semibold text-white px-2.5 truncate">{{ seg.label }}</span>
                      </div>
                      <!-- today -->
                      <div v-if="timeline.today != null" class="absolute -top-1 -bottom-1 w-0.5 bg-red-500 rounded" :style="{ left: timeline.today + '%' }" />
                    </div>
                  </div>
                </div>
                <div class="flex justify-between pl-[7.75rem] text-[11px] text-gray-400">
                  <span>{{ timeline.axisStart }}</span>
                  <span v-if="timeline.today != null" class="text-red-500 font-medium">Today</span>
                  <span>{{ timeline.axisEnd }}</span>
                </div>
              </div>

              <!-- One section per term set. The default (main) sequence first;
                   each set is an independent sequence — rollover never crosses sets. -->
              <div v-for="sec in termSections" v-show="onListTab" :key="sec.key" class="space-y-2">
                <div v-if="sets.length || sec.set" class="flex items-center gap-2">
                  <template v-if="sec.set">
                    <input v-model="sec.set.name" @change="onRenameSet(sec.set)"
                      class="text-base font-semibold text-gray-900 bg-transparent border border-transparent hover:border-gray-200 focus:border-[#1E2157] focus:bg-white focus:ring-1 focus:ring-[#1E2157] rounded-md px-1.5 -mx-1.5 py-0.5 outline-none transition-colors" />
                    <Select v-if="sportOptions.length > 1" :model-value="sec.set.sport_id" :options="sportOptions"
                      optionLabel="label" optionValue="value" size="small" class="w-40"
                      v-tooltip.top="'Connect this sequence to a sport'"
                      @update:modelValue="(v: string | null) => onSetSport(sec.set!, v)" />
                    <MultiSelect v-if="locationOptions.length > 1" :model-value="sec.set.location_ids ?? []" :options="locationOptions"
                      optionLabel="label" optionValue="value" size="small" display="chip" class="w-56"
                      placeholder="All locations" v-tooltip.top="'Which locations run this sequence — empty = whole club'"
                      @update:modelValue="(v: string[]) => onSetLocations(sec.set!, v)" />
                    <button class="text-gray-300 hover:text-red-500" title="Delete this term set (its terms move to the main sequence)" @click="removeSet(sec.set)"><i class="pi pi-times-circle text-sm" /></button>
                  </template>
                  <span v-else class="text-base font-semibold text-gray-900">Main {{ t('term', true, true) }}</span>
                </div>
                <div class="lg:rounded-lg lg:border lg:border-gray-200 lg:overflow-hidden space-y-2 lg:space-y-0">
                <div v-if="sec.list.length" class="hidden lg:grid grid-cols-[1fr_170px_170px_170px_170px_40px] gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-2.5 bg-gray-50 border-b border-gray-200">
                  <span>Name</span><span>Starts</span><span>Ends</span><span v-tooltip.top="`When ${t('member', false, true)} registration opens. Blank = open right away.`">Sign-up opens</span><span v-tooltip.top="`When registration closes. Blank = when the ${t('term', false, true)} ends.`">Sign-up closes</span><span></span>
                </div>
                <div v-for="t in sec.list" :key="t.id ?? t.sort_order + t.name"
                  class="grid grid-cols-1 lg:grid-cols-[1fr_170px_170px_170px_170px_40px] gap-2 lg:items-center rounded-lg lg:rounded-none border border-gray-100 lg:border-0 lg:border-b lg:border-gray-100 lg:last:border-b-0 p-3 lg:px-3 lg:py-2">
                  <div class="flex items-center gap-3">
                    <label class="lg:hidden w-28 shrink-0 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</label>
                    <InputText v-model="t.name" placeholder="Term 1 2026" class="w-full flex-1 min-w-0" />
                  </div>
                  <div class="flex items-center gap-3">
                    <label class="lg:hidden w-28 shrink-0 text-xs font-semibold text-gray-500 uppercase tracking-wide">Starts</label>
                    <DatePicker v-model="t.start_date" dateFormat="d M yy" showIcon class="w-full flex-1 min-w-0" placeholder="Start" />
                  </div>
                  <div class="flex items-center gap-3">
                    <label class="lg:hidden w-28 shrink-0 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ends</label>
                    <DatePicker v-model="t.end_date" dateFormat="d M yy" showIcon class="w-full flex-1 min-w-0" placeholder="End" />
                  </div>
                  <div class="flex items-center gap-3">
                    <label class="lg:hidden w-28 shrink-0 text-xs font-semibold text-gray-500 uppercase tracking-wide">Sign-up opens</label>
                    <DatePicker v-model="t.signup_open" dateFormat="d M yy" showIcon class="w-full flex-1 min-w-0" placeholder="Right away" />
                  </div>
                  <div class="flex items-center gap-3">
                    <label class="lg:hidden w-28 shrink-0 text-xs font-semibold text-gray-500 uppercase tracking-wide">Sign-up closes</label>
                    <DatePicker v-model="t.signup_close" dateFormat="d M yy" showIcon class="w-full flex-1 min-w-0" placeholder="Term end" />
                  </div>
                  <button class="text-gray-400 hover:text-red-500 justify-self-end lg:justify-self-center" @click="removeTerm(t)">
                    <i class="pi pi-trash" />
                  </button>
                </div>
                </div>
                <p v-if="!sec.list.length" class="text-sm text-gray-400">No {{ t('term', true, true) }} in this sequence yet.</p>
                <button v-if="seasonsTab === 'current'" class="text-sm text-primary hover:underline" @click="addTerm(sec.set?.id ?? null)">+ Add {{ t('term', false, true) }}</button>
              </div>
              <p v-if="seasonsTab === 'past' && !termSections.length" class="text-sm text-gray-400">No past {{ t('term', true, true) }} yet — once a {{ t('term', false, true) }}'s end date has gone by it moves here.</p>

              <div v-show="onListTab" class="flex items-center justify-between pt-1 border-t border-gray-100">
                <button v-if="seasonsTab === 'current'" class="text-sm text-gray-400 hover:text-primary transition-colors mt-2" :title="`A separate, unconnected sequence of ${t('term', true, true)} — e.g. the Seniors' two halves`" @click="addSet">+ New {{ t('term', false, true) }} set</button>
                <span v-if="seasonsTab !== 'current'" />
                <Button :label="`Save ${t('term', true, true)}`" size="small" :loading="savingTerms" class="mt-2"
                  style="background:#1E2157;border-color:#1E2157" @click="saveTerms" />
              </div>
            </div>
          </AppCard>

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
                      <InputNumber v-model="o.period_count" :min="1" :max="60" class="w-full" showButtons buttonLayout="stacked" :inputStyle="{ width: '3rem' }" />
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
  </div>
</template>
