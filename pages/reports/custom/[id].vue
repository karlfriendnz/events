<!--
  Custom report builder (migration 250). Filter people by any field — gender,
  age (from DOB), role/type, member position, membership, or a custom field —
  and get the matching list. e.g. "all girls under 15 who are strikers".
  Save it (appears on /reports), export CSV. id === 'new' starts a fresh one.
-->
<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const db = useDb()
const { orgId } = useOrg()
const toast = useToast()
const cr = useCustomReports()
const { resolvePersonTypes } = useOrgFieldPolicy()
const { resolveFields } = useOrgFieldPolicy()

const isNew = computed(() => route.params.id === 'new')
const reportId = ref<string | null>(isNew.value ? null : String(route.params.id))
const name = ref('Untitled report')
const match = ref<'all' | 'any'>('all')
const filters = ref<any[]>([])
const columns = ref<string[]>(['first_name', 'last_name', 'gender', 'age'])
const results = ref<any[]>([])
const ran = ref(false)
const loading = ref(true)
const saving = ref(false)

useBreadcrumbs([{ label: 'Reports', to: '/reports' }, { label: () => name.value }])

// ── Field catalogue for the builder ──
const personTypes = ref<{ label: string; value: string }[]>([])
const positions = ref<string[]>([])
const customFields = ref<{ key: string; label: string; field_type: string; options: string[] }[]>([])

const FIELD_DEFS = computed(() => [
  { key: 'first_name', label: 'First name', type: 'text' },
  { key: 'last_name', label: 'Last name', type: 'text' },
  { key: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Non-binary', 'Unspecified'] },
  { key: 'age', label: 'Age', type: 'number' },
  { key: 'membership_type', label: 'Membership type', type: 'text' },
  { key: 'role', label: 'Role / type', type: 'select', options: personTypes.value.map(t => t.label) },
  { key: 'position', label: 'Position', type: 'select', options: positions.value },
  { key: 'email', label: 'Email', type: 'text' },
  { key: 'phone', label: 'Phone', type: 'text' },
  ...customFields.value.map(f => ({ key: `cf:${f.key}`, label: f.label, type: f.field_type === 'number' ? 'number' : (f.options.length ? 'select' : 'text'), options: f.options })),
])
const fieldOptions = computed(() => FIELD_DEFS.value.map(f => ({ label: f.label, value: f.key })))
function fieldDef(key: string) { return FIELD_DEFS.value.find(f => f.key === key) }
function fieldLabel(key: string) { return key === 'age' ? 'Age' : (fieldDef(key)?.label ?? key) }
const columnOptions = computed(() => FIELD_DEFS.value.filter(f => f.key !== 'age').map(f => ({ label: f.label, value: f.key })).concat([{ label: 'Age', value: 'age' }]))

async function load() {
  if (!orgId.value) return
  loading.value = true
  const [types, defs, { data: mships }] = await Promise.all([
    resolvePersonTypes(orgId.value),
    resolveFields(orgId.value),
    (db.from as any)('member_group_memberships').select('positions, group:member_groups!inner(org_id)').eq('group.org_id', orgId.value),
  ])
  personTypes.value = (types ?? []).filter((t: any) => (t.kind ?? 'person') === 'person').map((t: any) => ({ label: t.label, value: t.key }))
  customFields.value = (defs ?? []).map((f: any) => ({ key: f.id, label: f.label, field_type: f.field_type, options: Array.isArray(f.options) ? f.options : (f.options?.choices ?? []) }))
  const posSet = new Set<string>()
  for (const m of (mships ?? [])) for (const p of (m.positions ?? [])) if (p) posSet.add(p)
  positions.value = [...posSet].sort()

  if (reportId.value) {
    const r = await cr.getReport(reportId.value)
    if (r) { name.value = r.name; match.value = r.config.match; filters.value = r.config.filters.map((f: any) => ({ ...f })); columns.value = r.config.columns }
  }
  if (!filters.value.length) addFilter()
  loading.value = false
}
onMounted(load)

let fid = 0
function addFilter() { filters.value.push({ id: `f_${Date.now().toString(36)}${fid++}`, field: 'gender', op: 'eq', value: '' }) }
function removeFilter(i: number) { filters.value.splice(i, 1) }
function onFilterField(f: any) { const d = fieldDef(f.field); f.value = ''; if (d?.type === 'number') f.op = 'lt'; else f.op = 'eq' }
function opsFor(f: any) {
  const d = fieldDef(f.field)
  if (d?.type === 'number') return cr.REPORT_OPS.filter(o => ['lt', 'gt', 'between', 'eq', 'set', 'empty'].includes(o.value))
  if (f.field === 'role' || f.field === 'position') return cr.REPORT_OPS.filter(o => ['includes', 'eq', 'neq', 'set', 'empty'].includes(o.value))
  return cr.REPORT_OPS.filter(o => ['eq', 'neq', 'contains', 'set', 'empty'].includes(o.value))
}

function config(): any { return { match: match.value, filters: filters.value, columns: columns.value } }
async function run() {
  results.value = await cr.runReport(config())
  ran.value = true
}
function cellValue(p: any, key: string) {
  const v = cr.personValue(p, key)
  return Array.isArray(v) ? v.join(', ') : (v ?? '')
}
function personName(p: any) { return `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || '—' }

async function save() {
  saving.value = true
  if (reportId.value) { await cr.updateReport(reportId.value, { name: name.value, config: config() }) }
  else { const r = await cr.createReport(name.value, config()); reportId.value = r?.id ?? null; if (reportId.value) router.replace(`/reports/custom/${reportId.value}`) }
  saving.value = false
  toast.add({ severity: 'success', summary: 'Report saved', life: 2000 })
}
async function remove() {
  if (!reportId.value) { navigateTo('/reports'); return }
  await cr.deleteReport(reportId.value)
  navigateTo('/reports')
}
function exportCsv() {
  const cols = columns.value
  const header = cols.map(fieldLabel)
  const lines = results.value.map(p => cols.map(c => `"${String(cellValue(p, c)).replace(/"/g, '""')}"`).join(','))
  const csv = [header.join(','), ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${name.value || 'report'}.csv`; a.click()
}
</script>

<template>
  <div class="p-3 sm:p-6 max-w-5xl mx-auto space-y-4">
    <div v-if="loading" class="text-sm text-gray-400">Loading…</div>
    <template v-else>
      <div class="flex items-start justify-between gap-3">
        <input v-model="name" class="text-lg sm:text-2xl font-semibold text-gray-900 bg-transparent border-0 focus:ring-0 focus:outline-none p-0 w-full" placeholder="Report name" />
        <div class="flex items-center gap-2 shrink-0">
          <Button label="Save" size="small" :loading="saving" @click="save" style="background:#1E2157;border-color:#1E2157" />
        </div>
      </div>

      <!-- Builder -->
      <div class="card p-4 sm:p-5 space-y-3">
        <div class="flex items-center gap-2 text-sm text-gray-600">
          Show people where
          <Select v-model="match" :options="[{label:'all',value:'all'},{label:'any',value:'any'}]" optionLabel="label" optionValue="value" size="small" class="w-24" />
          of these match:
        </div>
        <div v-for="(f, i) in filters" :key="f.id" class="flex flex-col sm:flex-row sm:items-center gap-2">
          <Select v-model="f.field" :options="fieldOptions" optionLabel="label" optionValue="value" class="w-full sm:w-48" @change="onFilterField(f)" />
          <Select v-model="f.op" :options="opsFor(f)" optionLabel="label" optionValue="value" class="w-full sm:w-36" />
          <!-- value input by field/op -->
          <template v-if="f.op !== 'set' && f.op !== 'empty'">
            <div v-if="f.op === 'between'" class="flex items-center gap-1.5 flex-1">
              <InputNumber v-model="f.value.min" placeholder="min" class="w-full" @update:modelValue="v => f.value = { ...f.value, min: v }" />
              <span class="text-gray-400 text-xs">and</span>
              <InputNumber v-model="f.value.max" placeholder="max" class="w-full" @update:modelValue="v => f.value = { ...f.value, max: v }" />
            </div>
            <InputNumber v-else-if="fieldDef(f.field)?.type === 'number'" v-model="f.value" class="flex-1 w-full" />
            <MultiSelect v-else-if="f.op === 'includes'" v-model="f.value" :options="(fieldDef(f.field)?.options ?? [])" display="chip" class="flex-1 w-full" placeholder="Choose…" />
            <Select v-else-if="fieldDef(f.field)?.type === 'select'" v-model="f.value" :options="(fieldDef(f.field)?.options ?? [])" editable class="flex-1 w-full" placeholder="Value" />
            <InputText v-else v-model="f.value" class="flex-1 w-full" placeholder="Value" />
          </template>
          <button type="button" class="text-gray-300 hover:text-red-500 shrink-0 self-center" @click="removeFilter(i)"><i class="pi pi-times-circle" /></button>
        </div>
        <div class="flex items-center justify-between">
          <button type="button" class="text-sm text-primary hover:underline" @click="addFilter"><i class="pi pi-plus text-[10px] mr-1" />Add filter</button>
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-400">Columns:</span>
            <MultiSelect v-model="columns" :options="columnOptions" optionLabel="label" optionValue="value" display="chip" class="w-64" placeholder="Columns" :maxSelectedLabels="3" />
          </div>
        </div>
        <div class="pt-2 border-t border-gray-100">
          <Button label="Run report" icon="pi pi-play" size="small" @click="run" style="background:#1E2157;border-color:#1E2157" />
        </div>
      </div>

      <!-- Results -->
      <div v-if="ran" class="card p-0 overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
          <p class="text-sm font-semibold text-gray-800">{{ results.length }} {{ results.length === 1 ? 'person' : 'people' }}</p>
          <button type="button" class="text-xs text-primary hover:underline" :disabled="!results.length" @click="exportCsv"><i class="pi pi-download text-[10px] mr-1" />Export CSV</button>
        </div>
        <p v-if="!results.length" class="p-8 text-center text-sm text-gray-400">No one matches these filters.</p>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
                <th class="text-left px-4 py-2 font-medium">Name</th>
                <th v-for="c in columns.filter(x => x !== 'first_name' && x !== 'last_name')" :key="c" class="text-left px-3 py-2 font-medium">{{ fieldLabel(c) }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in results" :key="p.id" class="border-b border-gray-50 hover:bg-gray-50/60">
                <td class="px-4 py-2"><NuxtLink :to="`/people/${p.id}`" class="font-medium text-gray-800 hover:text-primary hover:underline">{{ personName(p) }}</NuxtLink></td>
                <td v-for="c in columns.filter(x => x !== 'first_name' && x !== 'last_name')" :key="c" class="px-3 py-2 text-gray-600">{{ cellValue(p, c) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="flex justify-start">
        <button type="button" class="text-sm text-gray-400 hover:text-red-500" @click="remove"><i class="pi pi-trash text-xs mr-1" />Delete report</button>
      </div>
    </template>
    <Toast />
  </div>
</template>
