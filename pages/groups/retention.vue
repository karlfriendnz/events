<!--
  /groups/retention — Retention report. Compare the club's membership across two
  terms (A → B) with an optional per-term class filter, and see the growth
  headline (New / Rejoined / Transferred / Remaining), a segmented bar, and a
  per-person status table with CSV export. Reads existing data only.
-->
<script setup lang="ts">
import { STATUS_META, type RetentionData, type RetentionStatus, type RetentionPerson } from '~/composables/useRetention'

const rr = useRetention()
const gc = useGroupCodes()
const { orgReady } = useOrg()
const { ensureTerms, t } = useTerms()
void ensureTerms()

const loading = ref(true)
const data = ref<RetentionData>({ terms: [], codes: [], memberTerms: {}, info: {}, outstanding: {} })

const termAId = ref<string>('')
const termBId = ref<string>('')
const filterA = ref<string[]>([])
const filterB = ref<string[]>([])
const statusFilter = ref<RetentionStatus | 'all'>('all')

async function load() {
  loading.value = true
  data.value = await rr.loadData()
  const termsByStart = [...data.value.terms].sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''))
  const present = new Set<string>()
  for (const byTerm of Object.values(data.value.memberTerms)) for (const t of Object.keys(byTerm)) present.add(t)
  const usable = termsByStart.filter(t => present.has(t.id))
  const b = usable[usable.length - 1] ?? termsByStart[termsByStart.length - 1]
  const a = (b ? termsByStart[termsByStart.findIndex(t => t.id === b.id) - 1] : null) ?? usable[usable.length - 2] ?? termsByStart[0]
  termBId.value = b?.id ?? ''
  termAId.value = (a && a.id !== b?.id ? a.id : termsByStart[0]?.id) ?? ''
  loading.value = false
}
watch(orgReady, r => { if (r) load() }, { immediate: true })

const termOptions = computed(() => data.value.terms.map(t => ({ label: t.name, value: t.id })))
const codeOptions = computed(() => gc.treeOptions(data.value.codes))
const termName = (id: string) => data.value.terms.find(t => t.id === id)?.name ?? '—'

const result = computed(() => rr.compute(data.value, termAId.value, termBId.value, filterA.value, filterB.value))
const STATUS_KEYS: RetentionStatus[] = ['transferred', 'rejoined', 'new', 'remaining']
const total = computed(() => result.value.people.length)
const growth = computed(() => result.value.countB - result.value.countA)
const growthPct = computed(() => result.value.countA ? Math.round((growth.value / result.value.countA) * 100) : null)

const shownPeople = computed(() => statusFilter.value === 'all' ? result.value.people : result.value.people.filter(p => p.status === statusFilter.value))
function segWidth(k: RetentionStatus) { return total.value ? (result.value.segments[k] / total.value) * 100 : 0 }

function money(n: number) { return n ? '$' + n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '' }
function fmtDate(d: string | null) { if (!d) return '—'; const [y, m, day] = d.slice(0, 10).split('-'); return `${day}/${m}/${y.slice(2)}` }

function exportCsv() {
  const head = ['Name', 'Phone', 'Email', 'Join date', 'Outstanding', `In ${termName(termAId.value)}`, `In ${termName(termBId.value)}`, 'Status']
  const esc = (v: any) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const rows = shownPeople.value.map((p: RetentionPerson) => [p.name, p.phone ?? '', p.email ?? '', p.joinDate ?? '', p.outstanding || '', p.inA ? 'Yes' : 'No', p.inB ? 'Yes' : 'No', STATUS_META[p.status].label])
  const csv = [head, ...rows].map(r => r.map(esc).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a'); a.href = url; a.download = `retention-${termName(termAId.value)}-to-${termName(termBId.value)}.csv`.replace(/\s+/g, '_'); a.click(); URL.revokeObjectURL(url)
}
function copyEmails() {
  const emails = [...new Set(shownPeople.value.map(p => p.email).filter(Boolean))].join(', ')
  if (emails) navigator.clipboard?.writeText(emails)
}
</script>

<template>
  <div class="p-3 sm:p-6 space-y-4 sm:space-y-5">
    <!-- header -->
    <div>
      <div class="flex items-center gap-2 text-xs text-gray-400 mb-1">
        <NuxtLink to="/groups" class="hover:text-primary">{{ t('group', true) }}</NuxtLink>
        <i class="pi pi-angle-right text-[10px]" />
        <span>Retention</span>
      </div>
      <h1 class="text-lg sm:text-2xl font-semibold text-gray-900">Retention report</h1>
      <p class="text-xs sm:text-sm text-gray-500 mt-0.5">Track who carried over, returned, joined and lapsed between two {{ t('term', true, true) }}.</p>
    </div>

    <!-- compare controls -->
    <div class="card p-3 sm:p-4">
      <div class="flex flex-col lg:flex-row lg:items-end gap-3">
        <div class="flex-1">
          <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1.5 block">From {{ t('term', false, true) }}</label>
          <div class="flex gap-2">
            <Select v-model="termAId" :options="termOptions" optionLabel="label" optionValue="value" class="flex-1" />
            <MultiSelect v-model="filterA" :options="codeOptions" optionLabel="label" optionValue="value" :placeholder="`All ${t('group', true, true)}`"
              display="chip" :maxSelectedLabels="1" :showToggleAll="false" filter class="w-40" />
          </div>
        </div>
        <div class="hidden lg:flex items-center justify-center pb-2 text-gray-300"><i class="pi pi-arrow-right" /></div>
        <div class="flex-1">
          <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1.5 block">To {{ t('term', false, true) }}</label>
          <div class="flex gap-2">
            <Select v-model="termBId" :options="termOptions" optionLabel="label" optionValue="value" class="flex-1" />
            <MultiSelect v-model="filterB" :options="codeOptions" optionLabel="label" optionValue="value" :placeholder="`All ${t('group', true, true)}`"
              display="chip" :maxSelectedLabels="1" :showToggleAll="false" filter class="w-40" />
          </div>
        </div>
      </div>
    </div>

    <div v-if="loading" class="card p-16 text-center text-gray-400 text-sm">
      <i class="pi pi-spin pi-spinner text-2xl mb-2 block" /> Crunching the numbers…
    </div>

    <div v-else-if="!data.terms.length || (termAId === termBId)" class="card p-12 text-center">
      <i class="pi pi-chart-line text-3xl text-gray-300 mb-3 block" />
      <p class="text-sm font-medium text-gray-700">{{ !data.terms.length ? `No ${t('term', true, true)} set up yet` : `Pick two different ${t('term', true, true)} to compare` }}</p>
      <p class="text-xs text-gray-400 mt-1">{{ !data.terms.length ? `Create ${t('term', true, true)} in Settings → Terms & memberships.` : `Choose a “from” and a “to” ${t('term', false, true)} above.` }}</p>
    </div>

    <template v-else>
      <!-- growth headline -->
      <div class="card p-5 sm:p-6">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p class="text-xs font-bold uppercase tracking-wide text-gray-400">Net growth · {{ termName(termAId) }} → {{ termName(termBId) }}</p>
            <div class="flex items-baseline gap-2 mt-1">
              <span class="text-4xl font-bold tabular-nums" :class="growth > 0 ? 'text-emerald-600' : growth < 0 ? 'text-red-600' : 'text-gray-700'">{{ growth > 0 ? '+' : '' }}{{ growth }}</span>
              <span v-if="growthPct != null" class="text-sm font-semibold" :class="growth > 0 ? 'text-emerald-500' : growth < 0 ? 'text-red-500' : 'text-gray-400'">{{ growth > 0 ? '+' : '' }}{{ growthPct }}%</span>
            </div>
          </div>
          <div class="flex items-center gap-6 sm:gap-8 text-right">
            <div>
              <p class="text-2xl font-bold text-gray-900 tabular-nums">{{ result.countA }}</p>
              <p class="text-xs text-gray-500">{{ termName(termAId) }}</p>
            </div>
            <i class="pi pi-arrow-right text-gray-300" />
            <div>
              <p class="text-2xl font-bold text-gray-900 tabular-nums">{{ result.countB }}</p>
              <p class="text-xs text-gray-500">{{ termName(termBId) }}</p>
            </div>
          </div>
        </div>

        <!-- segmented bar -->
        <div class="mt-5">
          <div class="flex h-3 rounded-full overflow-hidden bg-gray-100">
            <div v-for="k in STATUS_KEYS" :key="k" class="h-full transition-all first:rounded-l-full last:rounded-r-full"
              :style="{ width: segWidth(k) + '%', background: STATUS_META[k].color }" v-tooltip.top="`${STATUS_META[k].label}: ${result.segments[k]}`" />
          </div>
          <div class="flex flex-wrap gap-x-5 gap-y-2 mt-3">
            <button v-for="k in STATUS_KEYS" :key="k" type="button" @click="statusFilter = statusFilter === k ? 'all' : k"
              class="flex items-center gap-2 group" :class="statusFilter !== 'all' && statusFilter !== k ? 'opacity-40' : ''">
              <span class="w-2.5 h-2.5 rounded-sm" :style="{ background: STATUS_META[k].color }" />
              <span class="text-sm font-semibold text-gray-800 tabular-nums">{{ result.segments[k] }}</span>
              <span class="text-sm text-gray-500 group-hover:text-gray-800">{{ STATUS_META[k].label }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- table toolbar -->
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2 text-sm text-gray-500">
          <span v-if="statusFilter !== 'all'" class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold" :class="[STATUS_META[statusFilter].tint, STATUS_META[statusFilter].text]">
            {{ STATUS_META[statusFilter].label }}
            <button @click="statusFilter = 'all'"><i class="pi pi-times text-[10px]" /></button>
          </span>
          <span>{{ shownPeople.length }} {{ shownPeople.length === 1 ? 'person' : 'people' }}</span>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" class="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary px-3 py-1.5 rounded-lg border border-gray-200" @click="copyEmails"><i class="pi pi-envelope text-xs" /> Copy emails</button>
          <button type="button" class="inline-flex items-center gap-1.5 text-sm text-white px-3 py-1.5 rounded-lg" style="background:#1E2157" @click="exportCsv"><i class="pi pi-download text-xs" /> CSV</button>
        </div>
      </div>

      <!-- desktop table -->
      <div class="card p-0 overflow-hidden hidden md:block">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-xs text-gray-400 border-b border-gray-100 text-left">
                <th class="font-medium px-4 py-2.5">Name</th>
                <th class="font-medium px-3 py-2.5">Phone</th>
                <th class="font-medium px-3 py-2.5">Email</th>
                <th class="font-medium px-3 py-2.5">Join date</th>
                <th class="font-medium px-3 py-2.5">Overdue</th>
                <th class="font-medium px-3 py-2.5 text-center">{{ termName(termAId) }}</th>
                <th class="font-medium px-3 py-2.5 text-center">{{ termName(termBId) }}</th>
                <th class="font-medium px-3 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in shownPeople" :key="p.id" class="border-b border-gray-50 hover:bg-gray-50/60">
                <td class="px-4 py-2.5"><NuxtLink :to="`/people/${p.id}`" class="font-medium text-gray-800 hover:text-primary">{{ p.name }}</NuxtLink></td>
                <td class="px-3 py-2.5 text-gray-500">{{ p.phone || '—' }}</td>
                <td class="px-3 py-2.5 text-gray-500 max-w-[200px] truncate">{{ p.email || '—' }}</td>
                <td class="px-3 py-2.5 text-gray-500 tabular-nums">{{ fmtDate(p.joinDate) }}</td>
                <td class="px-3 py-2.5"><span v-if="p.outstanding" class="text-red-600 font-medium tabular-nums">{{ money(p.outstanding) }}</span><span v-else class="text-gray-300">—</span></td>
                <td class="px-3 py-2.5 text-center"><i v-if="p.inA" class="pi pi-check text-emerald-500 text-xs" /><span v-else class="text-gray-200">·</span></td>
                <td class="px-3 py-2.5 text-center"><i v-if="p.inB" class="pi pi-check text-emerald-500 text-xs" /><span v-else class="text-gray-200">·</span></td>
                <td class="px-3 py-2.5"><span class="inline-flex px-2 py-0.5 rounded-md text-xs font-semibold" :class="[STATUS_META[p.status].tint, STATUS_META[p.status].text]">{{ STATUS_META[p.status].label }}</span></td>
              </tr>
              <tr v-if="!shownPeople.length"><td colspan="8" class="px-4 py-10 text-center text-gray-400 text-sm">No people in this segment.</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- mobile cards -->
      <div class="md:hidden space-y-2">
        <NuxtLink v-for="p in shownPeople" :key="p.id" :to="`/people/${p.id}`" class="card p-3 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-medium text-gray-800 truncate">{{ p.name }}</p>
            <p class="text-xs text-gray-400 truncate">{{ p.email || p.phone || '—' }}<span v-if="p.outstanding" class="text-red-500"> · {{ money(p.outstanding) }} due</span></p>
          </div>
          <span class="shrink-0 inline-flex px-2 py-0.5 rounded-md text-xs font-semibold" :class="[STATUS_META[p.status].tint, STATUS_META[p.status].text]">{{ STATUS_META[p.status].label }}</span>
        </NuxtLink>
        <p v-if="!shownPeople.length" class="card p-8 text-center text-gray-400 text-sm">No people in this segment.</p>
      </div>
    </template>
  </div>
</template>
