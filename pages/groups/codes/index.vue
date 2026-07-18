<!--
  Code hierarchy manager — drag codes inside codes.

  Codes (migration 205) are the containers that hold member groups and pass down
  their term. This page is the dedicated hierarchy editor: a drag-to-reorder /
  drag-to-nest tree (same interaction as /disciplines). Dropping a code on
  another's middle nests it as a child (sets group_codes.parent_id); dropping
  near a row's top/bottom edge reorders it as a sibling (sets sort_order).
  Creating/renaming/recolouring codes + setting each code's term also lives here.
-->
<script setup lang="ts">
import type { GroupCode } from '~/composables/useGroupCodes'

const groupsApi = useGroupsApi()
const { orgId } = useOrg()
const toast = useToast()
const gc = useGroupCodes()
const cr = useCodeRoles()
const tm = useTermsMemberships()
const { ensureTerms, t } = useTerms()
void ensureTerms()

const PALETTE = ['#1E2157', '#2563EB', '#0f766e', '#059669', '#9333ea', '#EC4899', '#c2410c', '#be123c', '#8B5CF6', '#64748b']

const codes = ref<GroupCode[]>([])
const groups = ref<Array<{ id: string; code_id: string | null }>>([])
const terms = ref<Array<{ id: string; name: string }>>([])
const roleDefs = ref<any[]>([])
const codeStaff = ref<any[]>([])
const loading = ref(true)
const codesById = computed(() => Object.fromEntries(codes.value.map(c => [c.id, c])) as Record<string, GroupCode>)

// Per-code staff coverage: for each effective staff role, how many people are
// assigned at code level (own + inherited) vs the required minimum (role_minimums,
// resolved up the code chain). Only roles with someone assigned or a requirement.
function roleCoverage(c: GroupCode) {
  const roles = cr.rolesForCode(c, codesById.value, roleDefs.value)
  const mins = gc.effectiveRoleMins({ code_id: c.id }, codesById.value)
  const counts: Record<string, number> = {}
  for (const s of cr.staffForCode(c, codesById.value, codeStaff.value, codes.value)) counts[s.role_key] = (counts[s.role_key] ?? 0) + 1
  return roles.map((r: any) => ({ key: r.key, label: r.label, have: counts[r.key] ?? 0, need: mins[r.key] ?? 0 }))
    .filter((x: any) => x.have > 0 || x.need > 0)
}

const form = reactive<{ name: string; color: string; parent_id: string | null; term_id: string | null }>({
  name: '', color: PALETTE[0], parent_id: null, term_id: null,
})
const editingId = ref<string | null>(null)

const termName = (id: string | null | undefined) => (id && terms.value.find(t => t.id === id)?.name) || null
const groupCount = (codeId: string) => groups.value.filter(g => g.code_id === codeId).length

// Effective parent key (treats an orphaned parent_id as top-level).
const parentKey = (c: GroupCode) => (c.parent_id && codes.value.some(x => x.id === c.parent_id)) ? c.parent_id : null
const sortSibs = (a: GroupCode, b: GroupCode) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)

// Depth-ordered tree (roots first, children indented), siblings by sort_order.
const ordered = computed<Array<GroupCode & { depth: number }>>(() => {
  const byParent = new Map<string | null, GroupCode[]>()
  for (const c of codes.value) {
    const k = parentKey(c)
    ;(byParent.get(k) ?? byParent.set(k, []).get(k)!).push(c)
  }
  const out: Array<GroupCode & { depth: number }> = []
  const walk = (p: string | null, depth: number) => {
    for (const c of (byParent.get(p) ?? []).slice().sort(sortSibs)) {
      out.push({ ...c, depth }); walk(c.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
})

// ── Drag-to-reorder AND drag-to-nest (native DnD, mirrors /disciplines) ──
const byId = (id: string | null | undefined) => codes.value.find(c => c.id === id) || null
// Is `nodeId` inside `ancestorId`'s subtree? (blocks dropping a code into its own descendants)
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
const dropClass = (c: GroupCode) => {
  if (dropTarget.value?.id !== c.id) return ''
  return dropTarget.value.mode === 'inside' ? 'ring-2 ring-inset ring-primary/40 bg-primary/5'
    : dropTarget.value.mode === 'before' ? 'shadow-[inset_0_2px_0_0_var(--brand-primary)]'
    : 'shadow-[inset_0_-2px_0_0_var(--brand-primary)]'
}

function onDragStart(c: GroupCode, e: DragEvent) {
  draggingId.value = c.id
  if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', c.id) }
}
function onDragOver(c: GroupCode, e: DragEvent) {
  const dragId = draggingId.value
  if (!dragId || dragId === c.id || isDescendant(c.id, dragId)) { dropTarget.value = null; return }
  e.preventDefault()
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const y = e.clientY - r.top
  const mode = y < r.height * 0.28 ? 'before' : y > r.height * 0.72 ? 'after' : 'inside'
  dropTarget.value = { id: c.id, mode }
}
function onDragEnd() { draggingId.value = null; dropTarget.value = null }

async function onDrop(c: GroupCode) {
  const dragged = byId(draggingId.value)
  const target = byId(c.id)
  const mode = dropTarget.value?.mode
  onDragEnd()
  if (!dragged || !target || dragged.id === target.id || !mode) return
  if (isDescendant(target.id, dragged.id)) return

  const groupKey = mode === 'inside' ? target.id : parentKey(target)
  dragged.parent_id = groupKey
  const sibs = codes.value.filter(x => parentKey(x) === groupKey && x.id !== dragged.id).sort(sortSibs)
  let at = sibs.length
  if (mode !== 'inside') { const ti = sibs.findIndex(x => x.id === target.id); at = mode === 'before' ? ti : ti + 1 }
  sibs.splice(at, 0, dragged)
  sibs.forEach((x, i) => { x.sort_order = i })

  await Promise.all([
    gc.updateCode(dragged.id, { parent_id: dragged.parent_id }),
    ...sibs.map(x => gc.updateCode(x.id, { sort_order: x.sort_order })),
  ])
  toast.add({ severity: 'success', summary: 'Moved', life: 1200 })
}

// Parent options exclude self + descendants when editing (cycle-safe).
const parentOptions = computed(() => {
  const banned = new Set<string>()
  if (editingId.value) {
    banned.add(editingId.value)
    let added = true
    while (added) { added = false; for (const c of codes.value) if (c.parent_id && banned.has(c.parent_id) && !banned.has(c.id)) { banned.add(c.id); added = true } }
  }
  return codes.value.filter(c => !banned.has(c.id))
})

async function load() {
  if (!orgId.value) return
  loading.value = true
  const [loaded, gs, loadedTerms, defs, staff] = await Promise.all([
    gc.loadCodes(),
    groupsApi.list(orgId.value),
    tm.loadTerms(),
    cr.ensureDefaults(),
    cr.loadStaff(),
  ])
  codes.value = loaded
  groups.value = (gs ?? []).map((g: any) => ({ id: g.id, code_id: g.codeId ?? null }))
  terms.value = loadedTerms ?? []
  roleDefs.value = defs ?? []
  codeStaff.value = staff ?? []
  loading.value = false
}

function startEdit(c: GroupCode) {
  editingId.value = c.id
  form.name = c.name; form.color = c.color || PALETTE[0]; form.parent_id = c.parent_id; form.term_id = c.term_id
}
function resetForm() { editingId.value = null; form.name = ''; form.color = PALETTE[0]; form.parent_id = null; form.term_id = null }

async function save() {
  if (!form.name.trim()) { toast.add({ severity: 'warn', summary: 'Name is required', life: 2500 }); return }
  if (editingId.value) {
    await gc.updateCode(editingId.value, { name: form.name.trim(), color: form.color, parent_id: form.parent_id, term_id: form.term_id })
  } else {
    // New codes go to the end of their sibling group.
    const sibCount = codes.value.filter(x => parentKey(x) === (form.parent_id && codes.value.some(y => y.id === form.parent_id) ? form.parent_id : null)).length
    await gc.createCode({ name: form.name.trim(), color: form.color, parent_id: form.parent_id, term_id: form.term_id, sort_order: sibCount })
  }
  resetForm(); await load()
  toast.add({ severity: 'success', summary: `${t('code')} saved`, life: 2000 })
}

async function remove(c: GroupCode) {
  // deleteCode reparents child codes + groups up to this code's parent first.
  await gc.deleteCode(c.id)
  if (editingId.value === c.id) resetForm()
  await load()
  toast.add({ severity: 'success', summary: `${t('code')} deleted`, life: 2000 })
}

watch(orgId, () => { if (orgId.value) load() }, { immediate: true })
</script>

<template>
  <div class="p-3 sm:p-6 min-h-full">
    <div class="flex flex-col md:flex-row gap-4 md:gap-6">
      <GroupSettingsNav />
      <div class="flex-1 min-w-0 max-w-4xl space-y-5">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h1 class="text-lg sm:text-2xl font-semibold text-gray-900">{{ t('code') }} hierarchy</h1>
        <p class="text-sm text-gray-500">Drag a {{ t('code', false, true) }} onto another to nest it; drag to a row's top/bottom edge to reorder. {{ t('code', true) }} hold your {{ t('group', true, true) }} and pass down their {{ t('term', false, true) }}.</p>
      </div>
      <div class="flex items-center gap-3 shrink-0 mt-1">
        <NuxtLink to="/groups/codes/default-roles" class="text-sm font-semibold text-primary hover:underline whitespace-nowrap inline-flex items-center gap-1">
          <i class="pi pi-users text-xs" /> Default roles
        </NuxtLink>
        <NuxtLink to="/groups" class="text-sm text-primary hover:underline whitespace-nowrap">← {{ t('group', true) }}</NuxtLink>
      </div>
    </div>

    <!-- Add / edit -->
    <div class="card p-5">
      <h2 class="text-sm font-semibold text-gray-700 mb-3">{{ editingId ? `Edit ${t('code', false, true)}` : `New ${t('code', false, true)}` }}</h2>
      <div class="grid grid-cols-1 md:grid-cols-[1.4fr_1.1fr_1.1fr_auto] gap-3 items-end">
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-gray-600">Name</label>
          <InputText v-model="form.name" placeholder="e.g. Step 6" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-gray-600">Parent {{ t('code', false, true) }}</label>
          <Select v-model="form.parent_id" :options="parentOptions" option-label="name" option-value="id"
            placeholder="None (top level)" show-clear filter class="w-full" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-gray-600">{{ t('term') }}</label>
          <Select v-model="form.term_id" :options="terms" option-label="name" option-value="id"
            :placeholder="`No ${t('term', false, true)}`" show-clear class="w-full" />
        </div>
        <div class="flex items-center gap-2">
          <Button :label="editingId ? 'Save' : 'Add'" style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="save" />
          <Button v-if="editingId" label="Cancel" severity="secondary" text @click="resetForm" />
        </div>
      </div>
      <div class="mt-3 flex items-center gap-2">
        <span class="text-xs font-medium text-gray-600 mr-1">Colour</span>
        <button v-for="c in PALETTE" :key="c" type="button" @click="form.color = c"
          class="w-6 h-6 rounded-full border-2 transition"
          :class="form.color === c ? 'border-gray-800 scale-110' : 'border-transparent'"
          :style="{ background: c }" />
      </div>
    </div>

    <!-- Hierarchy -->
    <div class="card p-0 overflow-hidden">
      <div class="px-5 py-2.5 border-b border-gray-100 text-sm font-semibold text-gray-700">{{ t('code', true) }}</div>
      <div v-if="loading" class="p-5 text-sm text-gray-400">Loading…</div>
      <div v-else-if="!codes.length" class="p-5 text-sm text-gray-400">No {{ t('code', true, true) }} yet — add one above.</div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <tbody>
            <tr v-for="c in ordered" :key="c.id" :data-id="c.id" draggable="true"
              class="border-b border-gray-50 hover:bg-gray-50/60 transition-shadow"
              :class="[dropClass(c), draggingId === c.id ? 'opacity-40' : '']"
              @dragstart="onDragStart(c, $event)" @dragover="onDragOver(c, $event)" @drop="onDrop(c)" @dragend="onDragEnd">
              <td class="w-8 pl-4">
                <i class="pi pi-bars text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing" v-tooltip.top="'Drag to reorder or nest'" />
              </td>
              <td class="px-3 py-2.5">
                <span :style="{ paddingLeft: (c.depth || 0) * 20 + 'px' }" class="inline-flex items-center gap-2">
                  <i v-if="c.depth" class="pi pi-angle-right text-gray-300 text-xs" />
                  <span class="w-2.5 h-2.5 rounded shrink-0" :style="{ background: c.color || '#94a3b8' }" />
                  <span class="font-medium text-gray-800">{{ c.name }}</span>
                </span>
              </td>
              <td class="px-3 py-2.5">
                <span v-if="termName(c.term_id)" class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{{ termName(c.term_id) }}</span>
                <span v-else class="text-xs text-gray-300">no {{ t('term', false, true) }}</span>
              </td>
              <td class="px-3 py-2.5 text-gray-500 text-xs whitespace-nowrap">{{ groupCount(c.id) }} {{ groupCount(c.id) === 1 ? t('group', false, true) : t('group', true, true) }}</td>
              <td class="px-3 py-2.5">
                <div v-if="roleCoverage(c).length" class="flex flex-wrap gap-1" v-tooltip.top="`${t('code')} staff assigned / minimum required per role`">
                  <span v-for="rc in roleCoverage(c)" :key="rc.key"
                    class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                    :class="rc.need && rc.have < rc.need ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'">
                    {{ rc.label }} {{ rc.have }}<template v-if="rc.need">/{{ rc.need }}</template>
                  </span>
                </div>
                <span v-else class="text-xs text-gray-300">—</span>
              </td>
              <td class="px-5 py-2.5 text-right whitespace-nowrap">
                <NuxtLink :to="`/groups/codes/${c.id}`" class="text-xs text-primary hover:underline mr-3">Settings</NuxtLink>
                <button class="text-xs text-red-600 hover:underline" @click="remove(c)">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
    </div>
  </div>
</template>
