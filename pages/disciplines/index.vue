<!--
  Disciplines manager — defined and managed by the governing body (NSO) itself.
  Scoped to the current org. Disciplines form a hierarchy (e.g. Seniors >
  Premiers > B Grade). Clubs map their groups/events to these (<DisciplineLinker>).
-->
<script setup lang="ts">
const db = useDb()
const { orgId } = useOrg()
const toast = useToast()

interface Disc { id: string; org_id: string; name: string; sport: string | null; code: string | null; parent_id: string | null; sort_order?: number; depth?: number }

const org = ref<{ name: string; org_level: string } | null>(null)
const isGoverning = computed(() => !!org.value && isGoverningBody(org.value.org_level))
const disciplines = ref<Disc[]>([])
const loading = ref(true)

const form = reactive<{ name: string; sport: string; code: string; parent_id: string | null }>({ name: '', sport: '', code: '', parent_id: null })
const editingId = ref<string | null>(null)

// Effective parent key (treats orphaned parent_id as top-level).
const parentKey = (d: Disc) => (d.parent_id && disciplines.value.some(x => x.id === d.parent_id)) ? d.parent_id : null
// Siblings of a discipline, in display order (sort_order, then name as a tiebreak).
const sortSibs = (a: Disc, b: Disc) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)

// Depth-ordered tree (roots first, children indented), siblings by sort_order.
const ordered = computed<Disc[]>(() => {
  const byParent = new Map<string | null, Disc[]>()
  for (const d of disciplines.value) {
    const k = parentKey(d)
    ;(byParent.get(k) ?? byParent.set(k, []).get(k)!).push(d)
  }
  const out: Disc[] = []
  const walk = (p: string | null, depth: number) => {
    for (const d of (byParent.get(p) ?? []).slice().sort(sortSibs)) {
      out.push({ ...d, depth }); walk(d.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
})

// Drag-to-reorder AND drag-to-nest via native DnD. Dropping near a row's top/bottom
// edge reorders it as a sibling before/after the target; dropping on the middle
// nests it as a child of the target.
const byId = (id: string | null | undefined) => disciplines.value.find(d => d.id === id) || null
const childrenOf = (pid: string | null) => disciplines.value.filter(d => parentKey(d) === pid).sort(sortSibs)
// Is `nodeId` inside `ancestorId`'s subtree? (blocks dropping a row into its own descendants)
function isDescendant(nodeId: string, ancestorId: string) {
  let cur = byId(nodeId); const seen = new Set<string>()
  while (cur && cur.parent_id && !seen.has(cur.id)) {
    seen.add(cur.id)
    if (cur.parent_id === ancestorId) return true
    cur = byId(cur.parent_id)
  }
  return false
}

const draggingId = ref<string | null>(null)
const dropTarget = ref<{ id: string; mode: 'before' | 'after' | 'inside' } | null>(null)
const dropClass = (d: Disc) => {
  if (dropTarget.value?.id !== d.id) return ''
  return dropTarget.value.mode === 'inside' ? 'ring-2 ring-inset ring-primary/40 bg-primary/5'
    : dropTarget.value.mode === 'before' ? 'shadow-[inset_0_2px_0_0_var(--brand-primary)]'
    : 'shadow-[inset_0_-2px_0_0_var(--brand-primary)]'
}

function onDragStart(d: Disc, e: DragEvent) {
  draggingId.value = d.id
  if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', d.id) }
}
function onDragOver(d: Disc, e: DragEvent) {
  const dragId = draggingId.value
  if (!dragId || dragId === d.id || isDescendant(d.id, dragId)) { dropTarget.value = null; return }
  e.preventDefault()
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const y = e.clientY - r.top
  const mode = y < r.height * 0.28 ? 'before' : y > r.height * 0.72 ? 'after' : 'inside'
  dropTarget.value = { id: d.id, mode }
}
function onDragEnd() { draggingId.value = null; dropTarget.value = null }

async function onDrop(d: Disc) {
  const dragged = byId(draggingId.value)
  const target = byId(d.id)
  const mode = dropTarget.value?.mode
  onDragEnd()
  if (!dragged || !target || dragged.id === target.id || !mode) return
  if (isDescendant(target.id, dragged.id)) return

  const groupKey = mode === 'inside' ? target.id : parentKey(target)
  dragged.parent_id = groupKey
  const sibs = disciplines.value.filter(x => parentKey(x) === groupKey && x.id !== dragged.id).sort(sortSibs)
  let at = sibs.length
  if (mode !== 'inside') { const ti = sibs.findIndex(x => x.id === target.id); at = mode === 'before' ? ti : ti + 1 }
  sibs.splice(at, 0, dragged)
  sibs.forEach((x, i) => { x.sort_order = i })

  await Promise.all([
    (db.from as any)('disciplines').update({ parent_id: dragged.parent_id }).eq('id', dragged.id),
    ...sibs.map(x => (db.from as any)('disciplines').update({ sort_order: x.sort_order }).eq('id', x.id)),
  ])
}
// Parent options exclude self + descendants when editing (cycle-safe).
const parentOptions = computed(() => {
  const banned = new Set<string>()
  if (editingId.value) {
    banned.add(editingId.value)
    let added = true
    while (added) { added = false; for (const d of disciplines.value) if (d.parent_id && banned.has(d.parent_id) && !banned.has(d.id)) { banned.add(d.id); added = true } }
  }
  return disciplines.value.filter(d => !banned.has(d.id))
})

async function load() {
  loading.value = true
  const [{ data: o }, { data: discs }] = await Promise.all([
    (db.from as any)('organisations').select('name, org_level').eq('id', orgId.value).single(),
    (db.from as any)('disciplines').select('id, org_id, name, sport, code, parent_id, sort_order').eq('org_id', orgId.value).order('sort_order').order('name'),
  ])
  org.value = o ?? null
  disciplines.value = discs ?? []
  loading.value = false
}

function startEdit(d: Disc) { editingId.value = d.id; form.name = d.name; form.sport = d.sport ?? ''; form.code = d.code ?? ''; form.parent_id = d.parent_id }
function resetForm() { editingId.value = null; form.name = ''; form.sport = ''; form.code = ''; form.parent_id = null }

async function save() {
  if (!form.name.trim()) { toast.add({ severity: 'warn', summary: 'Name is required', life: 2500 }); return }
  const payload: any = { org_id: orgId.value, name: form.name.trim(), sport: form.sport.trim() || null, code: form.code.trim() || null, parent_id: form.parent_id }
  if (editingId.value) await (db.from as any)('disciplines').update(payload).eq('id', editingId.value)
  else {
    // New rows go to the end of their sibling group.
    const sibCount = disciplines.value.filter(x => parentKey(x) === (form.parent_id && disciplines.value.some(y => y.id === form.parent_id) ? form.parent_id : null)).length
    await (db.from as any)('disciplines').insert({ ...payload, sort_order: sibCount })
  }
  resetForm(); await load()
  toast.add({ severity: 'success', summary: 'Discipline saved', life: 2000 })
}
async function remove(d: Disc) { await (db.from as any)('disciplines').delete().eq('id', d.id); if (editingId.value === d.id) resetForm(); await load() }

watch(orgId, () => { if (orgId.value) load() }, { immediate: true })
</script>

<template>
  <div class="p-3 sm:p-6 max-w-4xl mx-auto space-y-5">
    <div>
      <h1 class="text-xl font-semibold text-gray-900">Disciplines</h1>
      <p class="text-sm text-gray-500">Canonical categories your member clubs map their groups & events to. Build a hierarchy (e.g. Seniors › Premiers › B Grade).</p>
    </div>

    <div v-if="!loading && !isGoverning" class="card p-6 text-sm text-gray-500">
      Disciplines are defined by governing bodies (associations / national bodies). This organisation is a club —
      map your groups & events to your governing bodies' disciplines from the group/event pages instead.
    </div>

    <template v-else>
      <!-- Add / edit -->
      <div class="card p-5">
        <h2 class="text-sm font-semibold text-gray-700 mb-3">{{ editingId ? 'Edit discipline' : 'New discipline' }}</h2>
        <div class="grid grid-cols-1 md:grid-cols-[1.3fr_1fr_0.7fr_1.2fr_auto] gap-3 items-end">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-gray-600">Name</label>
            <InputText v-model="form.name" placeholder="e.g. Premiers" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-gray-600">Sport</label>
            <InputText v-model="form.sport" placeholder="e.g. Cricket" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-gray-600">Code</label>
            <InputText v-model="form.code" placeholder="opt." />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-gray-600">Parent discipline</label>
            <Select v-model="form.parent_id" :options="parentOptions" option-label="name" option-value="id"
              placeholder="None (top level)" show-clear filter class="w-full" />
          </div>
          <div class="flex items-center gap-2">
            <Button :label="editingId ? 'Save' : 'Add'" style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="save" />
            <Button v-if="editingId" label="Cancel" severity="secondary" text @click="resetForm" />
          </div>
        </div>
      </div>

      <!-- Hierarchy -->
      <div class="card p-0 overflow-hidden">
        <div class="px-5 py-2.5 border-b border-gray-100 text-sm font-semibold text-gray-700">Discipline hierarchy</div>
        <div v-if="loading" class="p-5 text-sm text-gray-400">Loading…</div>
        <div v-else-if="!disciplines.length" class="p-5 text-sm text-gray-400">No disciplines yet — add one above.</div>
        <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <tbody>
            <tr v-for="d in ordered" :key="d.id" :data-id="d.id" draggable="true"
              class="border-b border-gray-50 hover:bg-gray-50/60 transition-shadow"
              :class="[dropClass(d), draggingId === d.id ? 'opacity-40' : '']"
              @dragstart="onDragStart(d, $event)" @dragover="onDragOver(d, $event)" @drop="onDrop(d)" @dragend="onDragEnd">
              <td class="w-8 pl-4">
                <i class="pi pi-bars text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing" v-tooltip.top="'Drag to reorder or nest'" />
              </td>
              <td class="px-3 py-2.5">
                <span :style="{ paddingLeft: (d.depth || 0) * 20 + 'px' }" class="inline-flex items-center gap-2">
                  <i v-if="d.depth" class="pi pi-angle-right text-gray-300 text-xs" />
                  <span class="font-medium text-gray-800">{{ d.name }}</span>
                </span>
              </td>
              <td class="px-3 py-2.5 text-gray-500">{{ d.sport || '—' }}</td>
              <td class="px-3 py-2.5 text-gray-400 text-xs">{{ d.code || '' }}</td>
              <td class="px-5 py-2.5 text-right whitespace-nowrap">
                <button class="text-xs text-primary hover:underline mr-3" @click="startEdit(d)">Edit</button>
                <button class="text-xs text-red-600 hover:underline" @click="remove(d)">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>
    </template>
  </div>
</template>
