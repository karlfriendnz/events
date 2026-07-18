<template>
  <div class="p-3 sm:p-6 w-full">
    <!-- Header -->
    <div class="mb-4 flex items-center gap-2">
      <NuxtLink to="/groups" class="text-gray-400 hover:text-gray-600"><i class="pi pi-chevron-left" /></NuxtLink>
      <div class="flex-1">
        <h1 class="text-lg sm:text-2xl font-semibold text-surface-900">{{ t('group', true) }} fees</h1>
        <p class="text-xs text-gray-500 mt-0.5">Every {{ t('group', false, true) }} and the fee options a {{ t('member', false, true) }} can choose to pay to join it.</p>
      </div>
    </div>

    <!-- Term filter + bulk add -->
    <div class="mb-4 flex flex-wrap items-center gap-2">
      <span class="text-xs font-bold uppercase tracking-wide text-gray-500">{{ t('term') }}</span>
      <Select v-model="termFilter" :options="termFilterOptions" optionLabel="label" optionValue="value" class="w-56" size="small" />
      <span class="text-xs text-gray-400 ml-1">{{ withFees }} of {{ rows.length }} {{ rows.length === 1 ? t('group', false, true) : t('group', true, true) }} have fees</span>
      <Button :label="`Add fee to ${t('group', true, true)}`" icon="pi pi-plus" size="small" class="ml-auto w-full sm:w-auto justify-center mt-2 sm:mt-0"
        style="background:#1E2157;border-color:#1E2157" @click="openBulk" />
    </div>

    <div v-if="loading" class="py-10 text-center text-sm text-gray-400">Loading…</div>
    <div v-else-if="!rows.length" class="py-10 text-center text-sm text-gray-400">No {{ t('group', true, true) }} in this {{ t('term', false, true) }}.</div>

    <!-- One card per group -->
    <div v-else class="space-y-3">
      <div v-for="r in rows" :key="r.group.id" class="card overflow-hidden">
        <div class="flex items-center gap-2 px-4 sm:px-5 py-3 border-b border-gray-100">
          <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: r.group.color || '#94a3b8' }" />
          <NuxtLink :to="`/groups/${r.group.id}`" class="font-semibold text-gray-800 hover:text-primary truncate">{{ r.group.name }}</NuxtLink>
          <span v-if="r.term" class="text-[11px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{{ r.term.name }}</span>
          <NuxtLink :to="`/groups/${r.group.id}#details`" class="ml-auto text-xs text-primary hover:underline whitespace-nowrap">
            {{ r.options.length ? 'Edit fees' : 'Add fees' }} →
          </NuxtLink>
        </div>

        <div v-if="!r.options.length" class="px-4 sm:px-5 py-3 text-sm text-gray-400">No fee options set.</div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm min-w-[520px]">
            <thead>
              <tr class="text-left text-xs font-bold uppercase tracking-wide text-gray-500 bg-gray-50 border-b border-gray-100">
                <th class="py-2 px-4 sm:px-5">Fee option</th>
                <th class="py-2 px-4 w-40">Type</th>
                <th class="py-2 px-4 sm:px-5 w-40 text-right">Price</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="o in r.options" :key="o.id" class="border-b border-gray-50 last:border-0 align-top">
                <td class="py-3 px-4 sm:px-5">
                  <div class="font-medium text-gray-800">{{ o.name }}</div>
                  <div v-if="o.items.length" class="mt-1 space-y-0.5">
                    <div v-for="it in o.items" :key="it.id" class="flex items-center justify-between gap-4 text-xs text-gray-500 max-w-xs">
                      <span>{{ it.name || '—' }}</span>
                      <span class="tabular-nums">{{ gf.fmtMoney(it.amount, orgCurrency) }}</span>
                    </div>
                  </div>
                </td>
                <td class="py-3 px-4">
                  <span class="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{{ gf.feeTypeLabel(o.fee_type) }}</span>
                </td>
                <td class="py-3 px-4 sm:px-5 text-right font-semibold text-gray-900 tabular-nums whitespace-nowrap">{{ gf.priceLabel(o, orgCurrency) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Bulk: add one fee option to many groups at once -->
    <Dialog v-model:visible="bulkOpen" modal :style="{ width: '95vw', maxWidth: '640px' }" :header="`Add a fee to multiple ${t('group', true, true)}`">
      <div class="space-y-4">
        <!-- which groups -->
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between">
            <label class="text-sm font-medium">Apply to {{ t('group', true, true) }}</label>
            <button type="button" class="text-xs text-primary hover:underline" @click="selectShownGroups">Select all shown</button>
          </div>
          <MultiSelect v-model="bulkGroupIds" :options="groupSelectOptions" optionLabel="label" optionValue="value"
            filter display="chip" :placeholder="`Choose ${t('group', true, true)}`" class="w-full" />
        </div>

        <!-- the fee option -->
        <div class="border border-gray-200 rounded-lg p-3 space-y-3">
          <InputText v-model="bulkOption.name" placeholder="Option name (e.g. Full upfront)" class="w-full" />
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Select v-model="bulkOption.fee_type" :options="gf.FEE_TYPES" optionLabel="label" optionValue="value" class="w-full" />
            <div v-if="bulkOption.fee_type === 'recurring'" class="flex gap-2">
              <InputNumber v-model="bulkOption.period_count" :min="1" class="w-16" :useGrouping="false" showButtons />
              <Select v-model="bulkOption.period_unit" :options="PERIOD_UNITS" optionLabel="label" optionValue="value" class="flex-1" />
            </div>
            <InputNumber v-else-if="bulkOption.fee_type === 'instalment'" v-model="bulkOption.instalment_count" :min="1" placeholder="Number of payments" class="w-full" :useGrouping="false" showButtons />
            <InputNumber v-else-if="bulkOption.fee_type === 'concession' || bulkOption.fee_type === 'per_session'" v-model="bulkOption.session_count" :min="1" placeholder="Number of sessions" class="w-full" :useGrouping="false" showButtons />
          </div>
          <div v-if="bulkOption.fee_type === 'recurring'" class="flex items-center gap-2 text-sm text-gray-600">
            <ToggleSwitch v-model="bulkOption.auto_renew" /> Auto-renew each period
          </div>
          <div v-if="bulkOption.fee_type === 'upfront'" class="flex items-center gap-2 text-sm text-gray-600">
            <ToggleSwitch v-model="bulkOption.prorata" /> Pro-rata (reduce the fee when joining mid-{{ t('term', false, true) }})
          </div>
          <div>
            <div class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Line items</div>
            <div v-for="(it, ii) in bulkOption.items" :key="it.id" class="flex items-center gap-2 mb-1.5">
              <InputText v-model="it.name" placeholder="e.g. Coaching" class="flex-1 min-w-0" />
              <InputNumber v-model="it.amount" mode="currency" :currency="orgCurrency" locale="en-NZ" :min="0" class="w-28 shrink-0" :inputStyle="{ width: '7rem' }" />
              <XeroAccountInput v-model="it.account" placeholder="GL" class="w-24 shrink-0" title="GL / Xero account code" />
              <Button icon="pi pi-times" text severity="secondary" class="shrink-0" @click="bulkOption.items.splice(ii, 1)" />
            </div>
            <div class="flex items-center justify-between mt-1">
              <button type="button" class="text-xs text-primary hover:underline" @click="addBulkItem">+ Add line item</button>
              <span class="text-sm font-semibold text-gray-800">Total {{ gf.priceLabel(bulkOption, orgCurrency) }}</span>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" text @click="bulkOpen = false" />
        <Button :label="`Add to ${bulkGroupIds.length} ${bulkGroupIds.length === 1 ? t('group', false, true) : t('group', true, true)}`"
          :disabled="!bulkGroupIds.length || savingBulk" :loading="savingBulk"
          style="background:#1E2157;border-color:#1E2157" @click="saveBulk" />
      </template>
    </Dialog>

    <Toast />
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import type { OrgTerm } from '~/composables/useTermsMemberships'
import type { GroupFeeOption } from '~/composables/useGroupFees'

const { orgId } = useOrg()
const groupsApi = useGroupsApi()
const financesApi = useFinancesApi()
const tm = useTermsMemberships()
const gf = useGroupFees()
const route = useRoute()
const toast = useToast()
const { ensureTerms, t } = useTerms()
void ensureTerms()

const PERIOD_UNITS = [{ label: 'week', value: 'week' }, { label: 'month', value: 'month' }, { label: 'year', value: 'year' }]

interface GroupRow { id: string; name: string; term_id: string | null; color: string | null }

const terms = ref<OrgTerm[]>([])
const termFilter = ref<string>('all')
const groups = ref<GroupRow[]>([])
const optionsByGroup = ref<Record<string, GroupFeeOption[]>>({})
const orgCurrency = ref('NZD')
const loading = ref(true)

const termFilterOptions = computed(() => [
  { label: `All ${t('term', true, true)}`, value: 'all' },
  ...terms.value.map(term => ({ label: term.name, value: term.id })),
  { label: `No ${t('term', false, true)}`, value: 'none' },
])

const { inActiveLocation: feesInLens } = useActiveLocation()
const rows = computed(() => {
  let gs = groups.value.filter(g => (g as any).kind !== 'membership' && feesInLens((g as any).location_id))
  if (termFilter.value === 'none') gs = gs.filter(g => !g.term_id)
  else if (termFilter.value !== 'all') gs = gs.filter(g => g.term_id === termFilter.value)
  return gs.map(g => ({
    group: g,
    term: terms.value.find(t => t.id === g.term_id) || null,
    options: optionsByGroup.value[g.id] || [],
  }))
})
const withFees = computed(() => rows.value.filter(r => r.options.length).length)

async function load() {
  if (!orgId.value) return
  loading.value = true
  const [gr, termList, opts, currency] = await Promise.all([
    groupsApi.list(orgId.value),
    tm.loadTerms(),
    groupsApi.feeOptionsByOrg(orgId.value),
    financesApi.orgCurrency(orgId.value).catch(() => null),
  ])
  // Seam returns camelCase; this page reads snake fields.
  groups.value = (gr || []).map((g: any) => ({
    id: g.id, name: g.name, term_id: g.termId ?? null, color: g.color ?? null,
    location_id: g.locationId ?? null, kind: g.kind ?? null,
  })).sort((a: any, b: any) => a.name.localeCompare(b.name)) as GroupRow[]
  terms.value = (termList || []) as OrgTerm[]
  orgCurrency.value = currency || 'NZD'

  // The seam already nests each option's line items; map the camelCase contract
  // to this page's snake GroupFeeOption shape (imported from useGroupFees).
  const byGroup: Record<string, GroupFeeOption[]> = {}
  for (const o of (opts || [])) {
    const snake: GroupFeeOption = {
      id: o.id, org_id: o.orgId, group_id: o.groupId, name: o.name,
      fee_type: o.feeType, period_unit: o.periodUnit ?? null, period_count: o.periodCount ?? 1,
      auto_renew: !!o.autoRenew, instalment_count: o.instalmentCount ?? null,
      session_count: o.sessionCount ?? null, prorata: !!o.prorata,
      due_date: o.dueDate ?? null,
      deposit_percent: o.depositPercent != null ? Number(o.depositPercent) : null,
      description: o.description ?? null, sort_order: o.sortOrder ?? 0, status: o.status ?? 'active',
      items: (o.items || []).map((it: any) => ({
        id: it.id, option_id: it.optionId, name: it.name,
        amount: Number(it.amount) || 0, account: it.account ?? null, sort_order: it.sortOrder ?? 0,
      })),
    }
    ;(byGroup[snake.group_id!] ??= []).push(snake)
  }
  optionsByGroup.value = byGroup

  // default term filter: ?term= wins, else the active term, else All
  const q = route.query.term as string | undefined
  if (q && (q === 'all' || q === 'none' || terms.value.some(t => t.id === q))) termFilter.value = q
  else {
    const today = new Date().toISOString().slice(0, 10)
    const active = terms.value.find(t => (t.start_date ?? '') <= today && (t.end_date ?? '') >= today)
    termFilter.value = active && groups.value.some(g => g.term_id === active.id) ? active.id : 'all'
  }
  loading.value = false
}

watch(orgId, load, { immediate: true })

// ── Bulk: add one fee option to many groups ──
const bulkOpen = ref(false)
const savingBulk = ref(false)
const bulkGroupIds = ref<string[]>([])
let bulkTmp = 0
const nextId = () => `tmp-${bulkTmp++}`
function blankBulkOption(): GroupFeeOption {
  return {
    id: nextId(), name: '', fee_type: 'upfront', period_unit: 'month', period_count: 1,
    auto_renew: false, instalment_count: 1, session_count: 10, prorata: false,
    description: null, sort_order: 0, status: 'active',
    items: [{ id: nextId(), name: '', amount: 0, account: null, sort_order: 0 }],
  }
}
const bulkOption = ref<GroupFeeOption>(blankBulkOption())

// Groups to choose from — labelled with their term, respecting the term filter.
const groupSelectOptions = computed(() => rows.value.map(r => ({
  label: r.term ? `${r.group.name} · ${r.term.name}` : r.group.name,
  value: r.group.id,
})))

function selectShownGroups() { bulkGroupIds.value = rows.value.map(r => r.group.id) }
function addBulkItem() { bulkOption.value.items.push({ id: nextId(), name: '', amount: 0, account: null, sort_order: bulkOption.value.items.length }) }
function openBulk() {
  bulkOption.value = blankBulkOption()
  bulkGroupIds.value = rows.value.map(r => r.group.id)   // default to the shown groups
  bulkOpen.value = true
}
async function saveBulk() {
  if (!bulkGroupIds.value.length) return
  savingBulk.value = true
  try {
    const n = await gf.addFeeOptionToGroups(bulkGroupIds.value, bulkOption.value)
    await load()
    bulkOpen.value = false
    toast.add({ severity: 'success', summary: `Fee added to ${n} ${n === 1 ? t('group', false, true) : t('group', true, true)}`, life: 3000 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Could not add fee', detail: e?.message, life: 4000 })
  } finally {
    savingBulk.value = false
  }
}
</script>
