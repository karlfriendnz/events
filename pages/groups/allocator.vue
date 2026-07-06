<template>
  <div class="p-3 sm:p-6">
    <!-- Header -->
    <div class="mb-4 flex items-start justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <NuxtLink to="/groups" class="text-gray-400 hover:text-gray-600"><i class="pi pi-chevron-left" /></NuxtLink>
          <h1 class="text-lg sm:text-2xl font-semibold text-surface-900">Team allocation</h1>
        </div>
        <p class="text-xs sm:text-sm text-surface-500 mt-0.5">
          Drag people from a source {{ t('group', false, true) }} into the destination {{ t('group', true, true) }}. Each move is saved instantly.
        </p>
      </div>
    </div>

    <!-- Controls -->
    <div class="card p-3 sm:p-4 mb-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="flex flex-col gap-1">
          <label class="text-xs font-bold uppercase tracking-wide text-gray-500">{{ t('term') }}</label>
          <Select v-model="term" :options="termOptions" optionLabel="label" optionValue="value" size="small" class="w-full" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-bold uppercase tracking-wide text-gray-500">Source {{ t('group', false, true) }}</label>
          <Select v-model="sourceGroupId" :options="sourceOptions" optionLabel="label" optionValue="value"
            optionGroupLabel="label" optionGroupChildren="items" :placeholder="`Choose a ${t('group', false, true)}…`" size="small"
            class="w-full" showClear filter />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-bold uppercase tracking-wide text-gray-500">Destination {{ t('code', true, true) }}</label>
          <MultiSelect v-model="destCodeIds" :options="codeOptions" optionLabel="label" optionValue="value"
            :placeholder="`Choose ${t('code', true, true)}…`" size="small" class="w-full" display="chip" filter />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-bold uppercase tracking-wide text-gray-500">Search</label>
          <InputText v-model="search" :placeholder="`${searchCount} match${searchCount === 1 ? '' : 'es'}`"
            size="small" class="w-full" />
        </div>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        <!-- Capacity filter -->
        <div class="flex items-center gap-1">
          <button v-for="f in capacityFilters" :key="f.value" type="button"
            class="px-2.5 py-1 text-xs font-medium rounded border transition-colors"
            :class="capacityFilter === f.value ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'"
            @click="capacityFilter = f.value">
            {{ f.label }} <span class="tabular-nums opacity-70">{{ f.count() }}</span>
          </button>
        </div>
        <!-- Highlight duplicates -->
        <label class="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
          <ToggleSwitch v-model="highlightDuplicates" />
          Highlight duplicates
          <span v-if="highlightDuplicates && duplicateIds.size" class="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold tabular-nums">
            {{ duplicateIds.size }}
          </span>
        </label>
      </div>
    </div>

    <!-- Board -->
    <div class="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
      <!-- Source pool -->
      <div class="card p-0 overflow-hidden self-start">
        <div class="bg-primary text-white px-4 py-2.5 flex items-center justify-between">
          <span class="text-sm font-semibold truncate">{{ sourceGroup?.name || `Source ${t('group', false, true)}` }}</span>
          <span class="text-xs opacity-80 tabular-nums shrink-0">{{ visibleSourcePeople.length }}</span>
        </div>
        <div class="p-2 min-h-[120px] max-h-[70vh] overflow-y-auto"
          :class="dragOver === sourceGroupId ? 'bg-primary/5' : ''"
          @dragover.prevent="sourceGroupId && (dragOver = sourceGroupId)" @dragleave="dragOver = '__none__'"
          @drop.prevent="sourceGroupId && onDrop(sourceGroupId)">
          <p v-if="!sourceGroupId" class="text-xs text-gray-400 text-center py-8">Pick a source {{ t('group', false, true) }} to see its people.</p>
          <p v-else-if="!visibleSourcePeople.length" class="text-xs text-gray-400 text-center py-8">
            {{ (peopleByGroup[sourceGroupId] || []).length ? 'No matches.' : `This ${t('group', false, true)} has no people.` }}
          </p>
          <div v-for="p in visibleSourcePeople" :key="p.id" draggable="true"
            @dragstart="onDragStart($event, p, sourceGroupId!)"
            class="flex items-center gap-2 px-2.5 py-1.5 mb-1 rounded border border-gray-200 bg-white hover:border-primary cursor-move">
            <span class="flex-1 min-w-0">
              <span class="block text-sm font-medium text-gray-800 truncate">{{ p.name }}</span>
              <span v-if="personMeta(p)" class="block text-xs text-gray-400 truncate">{{ personMeta(p) }}</span>
            </span>
            <!-- Mobile move-to picker (drag is hard on small screens) -->
            <Select v-if="destGroups.length" :modelValue="null" :options="moveOptions(sourceGroupId!)"
              optionLabel="label" optionValue="value" placeholder="Move…" size="small"
              class="lg:hidden w-28 shrink-0 text-xs"
              @update:modelValue="v => v && quickMove(p, sourceGroupId!, v)" />
          </div>
        </div>
      </div>

      <!-- Destination groups grouped by code -->
      <div>
        <p v-if="!destCodeIds.length" class="card p-8 text-center text-sm text-gray-400">
          Choose one or more destination {{ t('code', true, true) }} to show their {{ t('group', true, true) }}.
        </p>
        <div v-for="grp in destByCode" :key="grp.codeId" class="mb-4">
          <div class="flex items-center gap-2 mb-2">
            <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: grp.color || '#94a3b8' }" />
            <h2 class="text-sm font-semibold text-gray-700">{{ grp.codeName }}</h2>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            <div v-for="g in grp.groups" :key="g.id"
              class="card p-0 overflow-hidden flex flex-col"
              :class="dragOver === g.id ? 'ring-2 ring-primary' : ''">
              <div class="px-3 py-2 border-b border-gray-100 flex items-center justify-between gap-2">
                <NuxtLink :to="`/groups/${g.id}`" class="text-sm font-semibold text-gray-800 truncate hover:text-primary">{{ g.name }}</NuxtLink>
                <span class="text-xs font-semibold tabular-nums shrink-0 px-1.5 py-0.5 rounded"
                  :class="countClass(g)">{{ capacityLabel(g) }}</span>
              </div>
              <div class="p-2 min-h-[80px] flex-1"
                :class="dragOver === g.id ? 'bg-primary/5' : ''"
                @dragover.prevent="dragOver = g.id" @dragleave="dragOver = '__none__'" @drop.prevent="onDrop(g.id)">
                <p v-if="!visiblePeople(g.id).length" class="text-xs text-gray-300 text-center py-4">Drop people here</p>
                <div v-for="p in visiblePeople(g.id)" :key="p.id" draggable="true"
                  @dragstart="onDragStart($event, p, g.id)"
                  class="flex items-center gap-2 px-2 py-1 mb-1 rounded border bg-white cursor-move group"
                  :class="highlightDuplicates && duplicateIds.has(p.id) ? 'border-amber-400 bg-amber-50' : 'border-gray-200 hover:border-primary'">
                  <span class="flex-1 min-w-0">
                    <span class="block text-sm text-gray-800 truncate">{{ p.name }}</span>
                    <span v-if="personMeta(p)" class="block text-xs text-gray-400 truncate">{{ personMeta(p) }}</span>
                  </span>
                  <button v-if="sourceGroupId && sourceGroupId !== g.id" type="button" title="Move back to source"
                    class="text-gray-300 hover:text-primary shrink-0"
                    @click="quickMove(p, g.id, sourceGroupId)"><i class="pi pi-arrow-left text-xs" /></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <Toast />
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'

const db = useDb()
const { orgId } = useOrg()
const toast = useToast()
const tm = useTermsMemberships()
const codes = useGroupCodes()
const allocator = useTeamAllocator()
const { ensureTerms, t } = useTerms()
void ensureTerms()

interface AllocGroup {
  id: string
  name: string
  color: string | null
  code_id: string | null
  capacity: number | null
  term_id: string | null
  sort_order: number | null
}

const terms = ref<{ id: string; name: string; start_date: string | null; end_date: string | null }[]>([])
const groupRows = ref<AllocGroup[]>([])
const codeRows = ref<GroupCode[]>([])
const codesById = computed(() => Object.fromEntries(codeRows.value.map(c => [c.id, c])) as Record<string, GroupCode>)

// Controls
const term = ref<string>('all')
const sourceGroupId = ref<string | null>(null)
const destCodeIds = ref<string[]>([])
const search = ref('')
const capacityFilter = ref<'all' | 'full' | 'incomp'>('all')
const highlightDuplicates = ref(false)

// person cache keyed by group id
const peopleByGroup = reactive<Record<string, AllocPerson[]>>({})

const termOptions = computed(() => [
  { label: `All ${t('term', true, true)}`, value: 'all' },
  ...terms.value.map(tr => ({ label: tr.name, value: tr.id })),
])

// A group belongs to the selected term (via its code chain, else its own term).
// 'all' matches everything.
function groupInTerm(g: AllocGroup): boolean {
  if (term.value === 'all') return true
  return codes.effectiveTermId(g, codesById.value) === term.value
}

// Source select — groups by code (a "No code" bucket for code-less groups).
const sourceOptions = computed(() => {
  const eligible = groupRows.value.filter(groupInTerm)
  const byCode: Record<string, AllocGroup[]> = {}
  for (const g of eligible) (byCode[g.code_id ?? '__none__'] ??= []).push(g)
  const out: { label: string; items: { label: string; value: string }[] }[] = []
  const sortedCodes = [...codeRows.value].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name))
  for (const c of sortedCodes) {
    const gs = byCode[c.id]
    if (gs?.length) out.push({ label: c.name, items: sortGroups(gs).map(g => ({ label: g.name, value: g.id })) })
  }
  if (byCode['__none__']?.length) out.push({ label: `No ${t('code', false, true)}`, items: sortGroups(byCode['__none__']).map(g => ({ label: g.name, value: g.id })) })
  return out
})

// Destination codes — only codes that actually contain in-term groups.
const codeOptions = computed(() => {
  const withGroups = new Set(groupRows.value.filter(groupInTerm).map(g => g.code_id).filter(Boolean) as string[])
  return [...codeRows.value]
    .filter(c => withGroups.has(c.id))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name))
    .map(c => ({ label: c.name, value: c.id }))
})

function sortGroups(gs: AllocGroup[]) {
  return [...gs].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name))
}

const sourceGroup = computed(() => groupRows.value.find(g => g.id === sourceGroupId.value) ?? null)

// Destination groups: in a chosen code, in term, not the source group.
const destGroups = computed(() =>
  groupRows.value.filter(g =>
    g.code_id && destCodeIds.value.includes(g.code_id) &&
    g.id !== sourceGroupId.value && groupInTerm(g)))

// Apply the capacity filter to which dest groups render.
const filteredDestGroups = computed(() => {
  if (capacityFilter.value === 'all') return destGroups.value
  return destGroups.value.filter(g => {
    if (g.capacity == null) return false // infinite groups only show under All
    const full = groupCount(g.id) >= g.capacity
    return capacityFilter.value === 'full' ? full : !full
  })
})

// Group the dest groups under their code for rendering.
const destByCode = computed(() => {
  const byCode: Record<string, AllocGroup[]> = {}
  for (const g of filteredDestGroups.value) (byCode[g.code_id as string] ??= []).push(g)
  const sortedCodes = [...codeRows.value].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name))
  return sortedCodes
    .filter(c => byCode[c.id]?.length)
    .map(c => ({ codeId: c.id, codeName: c.name, color: c.color, groups: sortGroups(byCode[c.id]) }))
})

function groupCount(gid: string) { return peopleByGroup[gid]?.length ?? 0 }

// A person appearing in 2+ destination groups.
const duplicateIds = computed(() => {
  const seen: Record<string, number> = {}
  for (const g of destGroups.value) for (const p of peopleByGroup[g.id] ?? []) seen[p.id] = (seen[p.id] ?? 0) + 1
  return new Set(Object.keys(seen).filter(id => seen[id] > 1))
})

// ── Search ──
function matches(p: AllocPerson) {
  const q = search.value.trim().toLowerCase()
  if (!q) return true
  return p.name.toLowerCase().includes(q) || (p.email ?? '').toLowerCase().includes(q)
}
const visibleSourcePeople = computed(() => (sourceGroupId.value ? (peopleByGroup[sourceGroupId.value] ?? []) : []).filter(matches))
function visiblePeople(gid: string) { return (peopleByGroup[gid] ?? []).filter(matches) }
const searchCount = computed(() => {
  if (!search.value.trim()) return 0
  let n = visibleSourcePeople.value.length
  for (const g of destGroups.value) n += visiblePeople(g.id).length
  return n
})

// ── Person meta line (age · gender) ──
function personMeta(p: AllocPerson) {
  const bits: string[] = []
  const age = allocator.ageFromDob(p.dob)
  if (age != null) bits.push(`${age} yrs`)
  if (p.gender) bits.push(p.gender.charAt(0) + p.gender.slice(1).toLowerCase())
  return bits.join(' · ')
}

// ── Capacity display ──
function capacityLabel(g: AllocGroup) {
  return g.capacity == null ? String(groupCount(g.id)) : `${groupCount(g.id)}/${g.capacity}`
}
function countClass(g: AllocGroup) {
  if (g.capacity == null) return 'bg-gray-100 text-gray-500'
  const n = groupCount(g.id)
  if (n > g.capacity) return 'bg-red-100 text-red-700'
  if (n >= g.capacity) return 'bg-emerald-100 text-emerald-700'
  return 'bg-amber-100 text-amber-700'
}

// ── Capacity filter tab counts ──
const capacityFilters = computed(() => {
  const limited = destGroups.value.filter(g => g.capacity != null)
  const full = limited.filter(g => groupCount(g.id) >= (g.capacity as number))
  return [
    { value: 'all' as const, label: 'All', count: () => destGroups.value.length },
    { value: 'full' as const, label: 'Full', count: () => `${full.length}/${limited.length}` },
    { value: 'incomp' as const, label: 'Incomplete', count: () => `${limited.length - full.length}/${limited.length}` },
  ]
})

// ── Drag & drop (native, mirrors the sub-groups board in groups/[id].vue) ──
const dragging = ref<{ person: AllocPerson; from: string } | null>(null)
const dragOver = ref('__none__')
function onDragStart(e: DragEvent, person: AllocPerson, from: string) {
  dragging.value = { person, from }
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}
async function onDrop(toGroupId: string) {
  dragOver.value = '__none__'
  const d = dragging.value
  dragging.value = null
  if (!d) return
  await doMove(d.person, d.from, toGroupId)
}
// Mobile / button-driven move.
async function quickMove(person: AllocPerson, from: string, to: string) {
  await doMove(person, from, to)
}
// Move options for a source person on mobile (every dest group).
function moveOptions(from: string) {
  return destGroups.value.filter(g => g.id !== from).map(g => ({ label: g.name, value: g.id }))
}

async function doMove(person: AllocPerson, from: string, to: string) {
  if (from === to) return
  const target = groupRows.value.find(g => g.id === to)
  const already = (peopleByGroup[to] ?? []).some(p => p.id === person.id)
  if (already) {
    // Already in the destination — just take them out of the source.
    removeLocal(from, person.id)
    const res = await allocator.movePerson(person, from, to, target?.term_id ?? null)
    if (!res.ok) { toast.add({ severity: 'error', summary: 'Move failed', detail: res.error?.message, life: 4000 }); await reloadGroup(from) }
    return
  }
  if (target && target.capacity != null && groupCount(to) >= target.capacity) {
    toast.add({ severity: 'warn', summary: `${target.name} is over capacity`, detail: `Now ${groupCount(to) + 1}/${target.capacity}`, life: 3000 })
  }
  // Optimistic local move, then persist.
  removeLocal(from, person.id)
  ;(peopleByGroup[to] ??= []).push(person)
  peopleByGroup[to].sort((a, b) => a.name.localeCompare(b.name))
  const res = await allocator.movePerson(person, from, to, target?.term_id ?? null)
  if (!res.ok) {
    toast.add({ severity: 'error', summary: 'Move failed', detail: res.error?.message, life: 4000 })
    await Promise.all([reloadGroup(from), reloadGroup(to)])
  }
}
function removeLocal(gid: string, personId: string) {
  if (peopleByGroup[gid]) peopleByGroup[gid] = peopleByGroup[gid].filter(p => p.id !== personId)
}
async function reloadGroup(gid: string) {
  const res = await allocator.loadPeopleForGroups([gid])
  peopleByGroup[gid] = res[gid] ?? []
}

// ── Loading ──
async function loadPeople() {
  const ids = new Set<string>()
  if (sourceGroupId.value) ids.add(sourceGroupId.value)
  for (const g of destGroups.value) ids.add(g.id)
  const need = [...ids].filter(id => !peopleByGroup[id])
  if (!need.length) return
  const res = await allocator.loadPeopleForGroups(need)
  for (const id of need) peopleByGroup[id] = res[id] ?? []
}

async function load() {
  if (!orgId.value) return
  const [termList, codeList, { data: gRows }] = await Promise.all([
    tm.loadTerms(),
    codes.loadCodes(),
    (db.from as any)('member_groups')
      .select('id, name, color, code_id, capacity, term_id, sort_order')
      .eq('org_id', orgId.value)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name'),
  ])
  terms.value = termList ?? []
  codeRows.value = codeList ?? []
  groupRows.value = (gRows ?? []) as AllocGroup[]
  // Default to the active term (spanning today) if it has groups, else all.
  const today = new Date().toISOString().slice(0, 10)
  const active = terms.value.find(tr => (tr.start_date ?? '') <= today && (tr.end_date ?? '') >= today)
  term.value = active && groupRows.value.some(g => codes.effectiveTermId(g, codesById.value) === active.id) ? active.id : 'all'
}

// Reload people whenever the source or destination set changes.
watch([sourceGroupId, destCodeIds], loadPeople)
watch(orgId, load, { immediate: true })
</script>
