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
const { toIso, periodLabel } = useTermsMemberships()

const currency = ref('NZD')
const loading = ref(true)

// ---------- Terms ----------
interface TermRow {
  id: string | null
  name: string
  start_date: Date | null
  end_date: Date | null
  sort_order: number
}
const terms = ref<TermRow[]>([])
let removedTermIds: string[] = []
const savingTerms = ref(false)

function addTerm() {
  terms.value.push({ id: null, name: '', start_date: null, end_date: null, sort_order: terms.value.length })
}
function removeTerm(i: number) {
  const r = terms.value[i]
  if (r.id) removedTermIds.push(r.id)
  terms.value.splice(i, 1)
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
        sort_order: i,
      }
      if (r.id) await (db.from as any)('org_terms').update(payload).eq('id', r.id)
      else {
        const { data } = await (db.from as any)('org_terms').insert(payload).select('id').single()
        if (data) r.id = data.id
      }
    }
    toast.add({ severity: 'success', summary: 'Terms saved', life: 2500 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Could not save terms', detail: e?.message, life: 4000 })
  } finally {
    savingTerms.value = false
  }
}

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

  const { data: t } = await (db.from as any)('org_terms')
    .select('id, name, start_date, end_date, sort_order')
    .eq('org_id', orgId.value)
    .order('sort_order', { ascending: true, nullsFirst: false }).order('start_date')
  terms.value = (t || []).map((r: any) => ({
    id: r.id, name: r.name,
    start_date: r.start_date ? new Date(r.start_date + 'T00:00:00') : null,
    end_date: r.end_date ? new Date(r.end_date + 'T00:00:00') : null,
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
          <h1 class="text-lg sm:text-2xl font-semibold text-gray-900">Terms & memberships</h1>
          <p class="text-sm text-gray-500">Define how your club runs groups — fixed <strong>terms</strong> (date ranges) and/or recurring <strong>memberships</strong>. Connect them to groups on each group's page.</p>
        </div>

        <div v-if="loading" class="text-sm text-gray-400">Loading…</div>

        <template v-else>
          <!-- TERMS -->
          <AppCard title="Terms" description="Shared date ranges (e.g. Term 1 2026). Attach a group to one or more terms on the group page.">
            <div class="space-y-2">
              <div v-if="terms.length" class="hidden sm:grid grid-cols-[1fr_160px_160px_40px] gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">
                <span>Name</span><span>Starts</span><span>Ends</span><span></span>
              </div>
              <div v-for="(t, i) in terms" :key="i"
                class="grid grid-cols-1 sm:grid-cols-[1fr_160px_160px_40px] gap-2 items-center">
                <InputText v-model="t.name" placeholder="Term 1 2026" class="w-full" />
                <DatePicker v-model="t.start_date" dateFormat="d M yy" showIcon class="w-full" placeholder="Start" />
                <DatePicker v-model="t.end_date" dateFormat="d M yy" showIcon class="w-full" placeholder="End" />
                <button class="text-gray-400 hover:text-red-500 justify-self-start sm:justify-self-center" @click="removeTerm(i)">
                  <i class="pi pi-trash" />
                </button>
              </div>
              <p v-if="!terms.length" class="text-sm text-gray-400 py-2">No terms yet.</p>
              <div class="flex items-center justify-between pt-1">
                <button class="text-sm text-primary hover:underline" @click="addTerm">+ Add term</button>
                <Button label="Save terms" size="small" :loading="savingTerms"
                  style="background:#1E2157;border-color:#1E2157" @click="saveTerms" />
              </div>
            </div>
          </AppCard>

          <!-- MEMBERSHIPS -->
          <AppCard title="Memberships" description="Recurring plans (e.g. Senior) with one or more duration options that roll over. A member keeps the same plan; they just pick a duration.">
            <div class="space-y-4">
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
