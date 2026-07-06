<template>
  <div class="p-3 sm:p-6 w-full">
    <!-- Header -->
    <div class="mb-4 flex items-center gap-2">
      <NuxtLink to="/groups" class="text-gray-400 hover:text-gray-600">
        <i class="pi pi-chevron-left" />
      </NuxtLink>
      <div>
        <h1 class="text-lg sm:text-2xl font-semibold text-surface-900">Roll over {{ t('group', true, true) }}</h1>
        <p class="text-xs text-gray-500 mt-0.5">Recreate a {{ t('term', false, true) }}'s {{ t('group', true, true) }} into the next {{ t('term', false, true) }} — carry or reset staff and {{ t('member', true, true) }} per {{ t('group', false, true) }}.</p>
      </div>
      <NuxtLink to="/groups/term-wizard" class="ml-auto text-xs font-medium text-primary hover:underline whitespace-nowrap">Guided set-up →</NuxtLink>
    </div>

    <!-- Term pickers -->
    <div class="card p-4 sm:p-5 mb-4">
      <div class="flex flex-col sm:flex-row sm:items-end gap-4">
        <div class="flex flex-col gap-1.5 flex-1">
          <label class="text-xs font-bold uppercase tracking-wide text-gray-500">Roll over from</label>
          <Select v-model="sourceTermId" :options="termOptions" optionLabel="label" optionValue="value"
            :placeholder="`Choose a ${t('term', false, true)}`" class="w-full" />
        </div>
        <div class="hidden sm:flex items-center h-10 text-gray-300"><i class="pi pi-arrow-right" /></div>
        <div class="flex flex-col gap-1.5 flex-1">
          <label class="text-xs font-bold uppercase tracking-wide text-gray-500">Into</label>
          <Select v-model="targetTermId" :options="targetOptions" optionLabel="label" optionValue="value"
            :placeholder="`Choose a ${t('term', false, true)}`" class="w-full" />
        </div>
      </div>
      <p v-if="sameTerm" class="text-xs text-amber-600 mt-3">
        <i class="pi pi-exclamation-triangle mr-1" />Source and target are the same {{ t('term', false, true) }} — pick a different target.
      </p>
    </div>

    <!-- Groups table -->
    <div class="card overflow-hidden">
      <div v-if="loading" class="py-10 text-center text-sm text-gray-400">Loading…</div>
      <div v-else-if="!sourceTermId" class="py-10 text-center text-sm text-gray-400">Choose a source {{ t('term', false, true) }} to begin.</div>
      <div v-else-if="!rows.length" class="py-10 text-center text-sm text-gray-400">That {{ t('term', false, true) }} has no {{ t('group', true, true) }} to roll over.</div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm min-w-[760px]">
          <thead>
            <tr class="text-left text-xs font-bold uppercase tracking-wide text-gray-500 bg-gray-50 border-b border-gray-200">
              <th class="py-2.5 px-4 w-[34%]">
                <label class="inline-flex items-center gap-2 cursor-pointer normal-case tracking-normal">
                  <Checkbox :modelValue="allSelected" :binary="true" @update:modelValue="v => setAll(!!v)" />
                  <span>Name</span>
                </label>
              </th>
              <th class="py-2.5 px-4 w-[20%]">Details</th>
              <th class="py-2.5 px-4 w-[23%]">Staff</th>
              <th class="py-2.5 px-4 w-[23%]">{{ t('member', true) }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.source.id"
              class="border-b border-gray-100 align-top"
              :class="row.alreadyRolled ? 'opacity-55' : (row.include ? '' : 'bg-gray-50/40')">
              <!-- Name -->
              <td class="py-3 px-4">
                <div class="flex items-start gap-2" :style="{ paddingLeft: `${(row.source.depth - 1) * 1.1}rem` }">
                  <Checkbox v-model="row.include" :binary="true" :disabled="row.alreadyRolled" class="mt-1.5" />
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: row.source.color || '#94a3b8' }" />
                      <InputText v-model="row.name" :disabled="!row.include || row.alreadyRolled"
                        class="flex-1 text-sm py-1" :placeholder="row.source.name" />
                    </div>
                    <p v-if="row.alreadyRolled" class="text-[11px] text-amber-600 mt-1 ml-4">
                      <i class="pi pi-check-circle mr-1" />Already in {{ targetTermName }}
                    </p>
                  </div>
                </div>
              </td>

              <!-- Details -->
              <td class="py-3 px-4 text-xs">
                <div v-if="detailBits(row.source).length" class="space-y-0.5">
                  <div v-for="b in detailBits(row.source)" :key="b.label" class="flex gap-1.5">
                    <span class="text-gray-400">{{ b.label }}</span>
                    <span class="text-gray-700 font-medium">{{ b.value }}</span>
                  </div>
                </div>
                <span v-else class="text-gray-300">—</span>
              </td>

              <!-- Staff -->
              <td class="py-3 px-4">
                <div v-if="!row.alreadyRolled" :class="row.include ? '' : 'opacity-40 pointer-events-none select-none'">
                  <Segmented v-model="row.staffMode" />
                  <div class="mt-2 min-h-[30px]">
                    <button v-if="row.staffMode === 'pick'" type="button"
                      class="w-full max-w-[15rem] text-xs text-left px-2.5 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 flex items-center justify-between gap-2"
                      @click="row.include && openPick($event, row, 'staff')">
                      <span :class="row.staffIds.length ? 'text-gray-700' : 'text-gray-400'">
                        {{ row.staffIds.length }} of {{ row.source.staff.length }} selected
                      </span>
                      <i class="pi pi-chevron-down text-[10px] text-gray-400" />
                    </button>
                    <p v-else class="text-[11px] text-gray-400 pt-1">{{ carrySummary(row, 'staff') }}</p>
                  </div>
                </div>
                <span v-else class="text-xs text-gray-300">{{ row.source.staff.length }} on file</span>
              </td>

              <!-- Members -->
              <td class="py-3 px-4">
                <div v-if="!row.alreadyRolled" :class="row.include ? '' : 'opacity-40 pointer-events-none select-none'">
                  <Segmented v-model="row.memberMode" />
                  <div class="mt-2 min-h-[30px]">
                    <button v-if="row.memberMode === 'pick'" type="button"
                      class="w-full max-w-[15rem] text-xs text-left px-2.5 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 flex items-center justify-between gap-2"
                      @click="row.include && openPick($event, row, 'member')">
                      <span :class="row.memberIds.length ? 'text-gray-700' : 'text-gray-400'">
                        {{ row.memberIds.length }} of {{ row.source.members.length }} selected
                      </span>
                      <i class="pi pi-chevron-down text-[10px] text-gray-400" />
                    </button>
                    <p v-else class="text-[11px] text-gray-400 pt-1">{{ carrySummary(row, 'member') }}</p>
                  </div>
                </div>
                <span v-else class="text-xs text-gray-300">{{ row.source.members.length }} on file</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Footer action -->
    <div class="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <p class="text-xs text-gray-500">
        {{ selectedCount }} {{ selectedCount === 1 ? t('group', false, true) : t('group', true, true) }} will be created in
        <strong>{{ targetTermName || '—' }}</strong>.
      </p>
      <Button :label="`Create ${selectedCount} ${selectedCount === 1 ? t('group', false, true) : t('group', true, true)} for ${targetTermName || t('term', false, true)}`"
        icon="pi pi-copy" :loading="running" :disabled="!canRun"
        class="w-full sm:w-auto justify-center" style="background:#1E2157;border-color:#1E2157"
        @click="run" />
    </div>

    <!-- Pick people modal -->
    <Dialog v-model:visible="pickOpen" modal :style="{ width: '95vw', maxWidth: '460px' }" :header="pickTitle">
      <div class="flex flex-col gap-3">
        <IconField>
          <InputIcon class="pi pi-search" />
          <InputText v-model="pickSearch" placeholder="Search people" class="w-full" autofocus />
        </IconField>
        <div class="flex items-center justify-between text-xs">
          <span class="text-gray-500">{{ pickIds.length }} of {{ pickSource.length }} selected</span>
          <div class="flex gap-3">
            <button class="text-primary hover:underline" @click="pickSetAll(true)">Select all</button>
            <button class="text-gray-400 hover:underline" @click="pickSetAll(false)">None</button>
          </div>
        </div>
        <div class="max-h-[50vh] overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg">
          <label v-for="p in pickList" :key="p.id"
            class="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer">
            <Checkbox :modelValue="pickIds.includes(p.id)" :binary="true" @update:modelValue="() => togglePick(p.id)" />
            <span class="text-sm text-gray-700 truncate">{{ p.name }}</span>
          </label>
          <div v-if="!pickList.length" class="px-3 py-6 text-center text-sm text-gray-400">No matches</div>
        </div>
      </div>
      <template #footer>
        <Button label="Done" style="background:#1E2157;border-color:#1E2157" @click="pickOpen = false" />
      </template>
    </Dialog>

    <Toast />
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { h } from 'vue'
import type { OrgTerm } from '~/composables/useTermsMemberships'
import type { RolloverPlan, RolloverGroup, CarryMode } from '~/composables/useTermRollover'

const { orgId } = useOrg()
const toast = useToast()
const router = useRouter()
const route = useRoute()
const tm = useTermsMemberships()
const rollover = useTermRollover()
const { ensureTerms, t } = useTerms()
void ensureTerms()

interface Row extends RolloverPlan { alreadyRolled: boolean }

const GENDER_LABELS: Record<string, string> = { MALE: 'Male only', FEMALE: 'Female only', NON_BINARY: 'Non-binary only' }

const MODES: { label: string; value: CarryMode }[] = [
  { label: 'All', value: 'rollover' },
  { label: 'None', value: 'wipe' },
  { label: 'Pick', value: 'pick' },
]

// Small inline segmented pill toggle — [ All | None | Pick ].
const Segmented = (props: { modelValue: CarryMode }, { emit }: any) =>
  h('div', { class: 'inline-flex rounded-md border border-gray-200 overflow-hidden text-xs' },
    MODES.map(m => h('button', {
      type: 'button',
      key: m.value,
      class: ['px-2.5 py-1 font-medium transition-colors border-r border-gray-200 last:border-r-0',
        props.modelValue === m.value ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'],
      onClick: () => emit('update:modelValue', m.value),
    }, m.label)))
;(Segmented as any).props = ['modelValue']
;(Segmented as any).emits = ['update:modelValue']

const terms = ref<OrgTerm[]>([])
const sourceTermId = ref<string | null>(null)
const targetTermId = ref<string | null>(null)
const rows = ref<Row[]>([])
const loading = ref(false)
const running = ref(false)

// ── Pick-people modal ──
const pickOpen = ref(false)
const pickSearch = ref('')
const pickCtx = ref<{ row: Row; which: 'staff' | 'member' } | null>(null)

const pickSource = computed<RolloverGroup['staff']>(() => {
  const c = pickCtx.value
  if (!c) return []
  return c.which === 'staff' ? c.row.source.staff : c.row.source.members
})
const pickIds = computed<string[]>(() => {
  const c = pickCtx.value
  if (!c) return []
  return c.which === 'staff' ? c.row.staffIds : c.row.memberIds
})
const pickList = computed(() => {
  const q = pickSearch.value.trim().toLowerCase()
  return q ? pickSource.value.filter(p => p.name.toLowerCase().includes(q)) : pickSource.value
})
const pickTitle = computed(() => {
  const c = pickCtx.value
  if (!c) return ''
  const name = c.row.name?.trim() || c.row.source.name
  return `${name} — ${c.which === 'staff' ? `${t('coach', true)} & managers` : t('member', true)}`
})

function openPick(_e: Event, row: Row, which: 'staff' | 'member') {
  pickCtx.value = { row, which }
  pickSearch.value = ''
  pickOpen.value = true
}
function togglePick(id: string) {
  const c = pickCtx.value
  if (!c) return
  const arr = c.which === 'staff' ? c.row.staffIds : c.row.memberIds
  const i = arr.indexOf(id)
  if (i >= 0) arr.splice(i, 1)
  else arr.push(id)
}
function pickSetAll(v: boolean) {
  const c = pickCtx.value
  if (!c) return
  const all = pickSource.value.map(p => p.id)
  if (c.which === 'staff') c.row.staffIds = v ? all : []
  else c.row.memberIds = v ? all : []
}

const termOptions = computed(() => terms.value.map(t => ({ label: t.name, value: t.id })))
const targetOptions = computed(() => termOptions.value.filter(o => o.value !== sourceTermId.value))
const targetTermName = computed(() => terms.value.find(t => t.id === targetTermId.value)?.name ?? '')
const sameTerm = computed(() => !!sourceTermId.value && sourceTermId.value === targetTermId.value)
const selectedCount = computed(() => rows.value.filter(r => r.include && !r.alreadyRolled).length)
const selectable = computed(() => rows.value.filter(r => !r.alreadyRolled))
const allSelected = computed(() => selectable.value.length > 0 && selectable.value.every(r => r.include))
const canRun = computed(() => !!targetTermId.value && !sameTerm.value && selectedCount.value > 0 && !running.value)

function setAll(v: boolean) {
  for (const r of rows.value) if (!r.alreadyRolled) r.include = v
}

// Read-only "Details" rows for a group — its configured attributes.
function detailBits(g: RolloverGroup): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = []
  if (g.code) out.push({ label: t('code'), value: g.code })
  if (g.age_range) out.push({ label: 'Ages', value: g.age_range })
  if (g.gender_restriction) out.push({ label: 'Gender', value: GENDER_LABELS[g.gender_restriction] ?? g.gender_restriction })
  if (g.capacity != null) out.push({ label: 'Capacity', value: String(g.capacity) })
  if (g.term_fee != null) out.push({ label: 'Fee', value: tm.fmtMoney(g.term_fee) })
  const subs = Array.isArray(g.sub_groups) ? g.sub_groups.length : 0
  if (subs) out.push({ label: `Sub-${t('group', true)}`, value: String(subs) })
  return out
}

// One-line summary of what carries for a column.
function carrySummary(row: Row, which: 'staff' | 'member'): string {
  const list = which === 'staff' ? row.source.staff : row.source.members
  const mode = which === 'staff' ? row.staffMode : row.memberMode
  const ids = which === 'staff' ? row.staffIds : row.memberIds
  const noun = which === 'staff' ? t('coach', false, true) : t('member', false, true)
  const plural = which === 'staff' ? t('coach', true, true) : t('member', true, true)
  const n = mode === 'wipe' ? 0 : mode === 'pick' ? ids.length : list.length
  if (mode === 'wipe') return `Start empty · ${list.length} not carried`
  return `Carry ${n} ${n === 1 ? noun : plural}`
}

function nextTermAfter(id: string | null): string | null {
  const src = terms.value.find(t => t.id === id)
  if (!src) return null
  const later = terms.value
    .filter(t => t.id !== id && (t.start_date ?? '') > (src.start_date ?? ''))
    .sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''))
  return later[0]?.id ?? null
}

async function loadRows() {
  if (!sourceTermId.value) { rows.value = []; return }
  loading.value = true
  const [groups, rolled] = await Promise.all([
    rollover.loadTermGroups(sourceTermId.value),
    targetTermId.value ? rollover.lineagesInTerm(targetTermId.value) : Promise.resolve(new Set<string>()),
  ])
  rows.value = groups.map(g => {
    const alreadyRolled = !!g.lineage_id && rolled.has(g.lineage_id)
    return {
      source: g,
      include: !alreadyRolled,
      name: g.name,
      staffMode: 'rollover' as CarryMode,
      staffIds: g.staff.map(s => s.id),
      memberMode: 'rollover' as CarryMode,
      memberIds: g.members.map(m => m.id),
      alreadyRolled,
    } as Row
  })
  loading.value = false
}

async function refreshRolled() {
  if (!targetTermId.value) { rows.value.forEach(r => { r.alreadyRolled = false }); return }
  const rolled = await rollover.lineagesInTerm(targetTermId.value)
  for (const r of rows.value) {
    r.alreadyRolled = !!r.source.lineage_id && rolled.has(r.source.lineage_id)
    if (r.alreadyRolled) r.include = false
  }
}

async function run() {
  if (!canRun.value) return
  const targetTerm = terms.value.find(t => t.id === targetTermId.value)
  if (!targetTerm) return
  running.value = true
  try {
    const { created } = await rollover.rollOverGroups(targetTerm, rows.value.filter(r => !r.alreadyRolled))
    toast.add({ severity: 'success', summary: `Created ${created} ${created === 1 ? t('group', false, true) : t('group', true, true)} in ${targetTerm.name}`, life: 3000 })
    router.push(`/groups?term=${targetTerm.id}`)
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Rollover failed', detail: e?.message ?? String(e), life: 5000 })
  } finally {
    running.value = false
  }
}

watch(sourceTermId, loadRows)
watch(targetTermId, refreshRolled)

async function init() {
  if (!orgId.value) return
  terms.value = await tm.loadTerms()
  const src = (await rollover.mostRecentTermWithGroups(terms.value))
    ?? terms.value[terms.value.length - 1]?.id ?? null
  sourceTermId.value = (route.query.from as string) || src
  targetTermId.value = (route.query.to as string) || nextTermAfter(sourceTermId.value)
  await loadRows()
}

watch(orgId, init, { immediate: true })
</script>
