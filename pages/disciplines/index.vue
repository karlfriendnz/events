<!--
  Disciplines manager — defined and managed by the governing body (NSO) itself.
  Scoped to the current org. Disciplines form a hierarchy (e.g. Seniors >
  Premiers > B Grade). Clubs map their groups/events to these (<DisciplineLinker>).
-->
<script setup lang="ts">
const db = useDb()
const { orgId } = useOrg()
const toast = useToast()

interface Disc { id: string; org_id: string; name: string; sport: string | null; code: string | null; parent_id: string | null; depth?: number }

const org = ref<{ name: string; org_level: string } | null>(null)
const isGoverning = computed(() => !!org.value && org.value.org_level !== 'CLUB')
const disciplines = ref<Disc[]>([])
const loading = ref(true)

const form = reactive<{ name: string; sport: string; code: string; parent_id: string | null }>({ name: '', sport: '', code: '', parent_id: null })
const editingId = ref<string | null>(null)

// Depth-ordered tree (roots first, children indented).
const ordered = computed<Disc[]>(() => {
  const byParent = new Map<string | null, Disc[]>()
  for (const d of disciplines.value) {
    const k = d.parent_id && disciplines.value.some(x => x.id === d.parent_id) ? d.parent_id : null
    ;(byParent.get(k) ?? byParent.set(k, []).get(k)!).push(d)
  }
  const out: Disc[] = []
  const walk = (p: string | null, depth: number) => {
    for (const d of (byParent.get(p) ?? []).sort((a, b) => a.name.localeCompare(b.name))) {
      out.push({ ...d, depth }); walk(d.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
})
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
    (db.from as any)('disciplines').select('id, org_id, name, sport, code, parent_id').eq('org_id', orgId.value).order('name'),
  ])
  org.value = o ?? null
  disciplines.value = discs ?? []
  loading.value = false
}

function startEdit(d: Disc) { editingId.value = d.id; form.name = d.name; form.sport = d.sport ?? ''; form.code = d.code ?? ''; form.parent_id = d.parent_id }
function resetForm() { editingId.value = null; form.name = ''; form.sport = ''; form.code = ''; form.parent_id = null }

async function save() {
  if (!form.name.trim()) { toast.add({ severity: 'warn', summary: 'Name is required', life: 2500 }); return }
  const payload = { org_id: orgId.value, name: form.name.trim(), sport: form.sport.trim() || null, code: form.code.trim() || null, parent_id: form.parent_id }
  if (editingId.value) await (db.from as any)('disciplines').update(payload).eq('id', editingId.value)
  else await (db.from as any)('disciplines').insert(payload)
  resetForm(); await load()
  toast.add({ severity: 'success', summary: 'Discipline saved', life: 2000 })
}
async function remove(d: Disc) { await (db.from as any)('disciplines').delete().eq('id', d.id); if (editingId.value === d.id) resetForm(); await load() }

watch(orgId, () => { if (orgId.value) load() }, { immediate: true })
</script>

<template>
  <div class="p-6 max-w-4xl mx-auto space-y-5">
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
            <Button :label="editingId ? 'Save' : 'Add'" style="background:#1E2157;border-color:#1E2157" @click="save" />
            <Button v-if="editingId" label="Cancel" severity="secondary" text @click="resetForm" />
          </div>
        </div>
      </div>

      <!-- Hierarchy -->
      <div class="card p-0 overflow-hidden">
        <div class="px-5 py-2.5 border-b border-gray-100 text-sm font-semibold text-gray-700">Discipline hierarchy</div>
        <div v-if="loading" class="p-5 text-sm text-gray-400">Loading…</div>
        <div v-else-if="!disciplines.length" class="p-5 text-sm text-gray-400">No disciplines yet — add one above.</div>
        <table v-else class="w-full text-sm">
          <tbody>
            <tr v-for="d in ordered" :key="d.id" class="border-b border-gray-50 hover:bg-gray-50/60">
              <td class="px-5 py-2.5">
                <span :style="{ paddingLeft: (d.depth || 0) * 20 + 'px' }" class="inline-flex items-center gap-2">
                  <i v-if="d.depth" class="pi pi-angle-right text-gray-300 text-xs" />
                  <span class="font-medium text-gray-800">{{ d.name }}</span>
                </span>
              </td>
              <td class="px-3 py-2.5 text-gray-500">{{ d.sport || '—' }}</td>
              <td class="px-3 py-2.5 text-gray-400 text-xs">{{ d.code || '' }}</td>
              <td class="px-5 py-2.5 text-right whitespace-nowrap">
                <button class="text-xs text-[#1E2157] hover:underline mr-3" @click="startEdit(d)">Edit</button>
                <button class="text-xs text-red-600 hover:underline" @click="remove(d)">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
