<!--
  Disciplines manager (super-admin portal). NSO-owned canonical categories that
  local club groups/events map back to. Create/edit/delete disciplines per
  governing body (NATIONAL / ASSOCIATION / REGIONAL orgs).
-->
<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const db = useDb()
const user = useSupabaseUser()
const toast = useToast()
const isSuper = computed(() => ((user.value as any)?.app_metadata?.role) === 'super_admin')

interface Disc { id: string; org_id: string; name: string; sport: string | null; code: string | null }
const govOrgs = ref<{ id: string; name: string; org_level: string }[]>([])
const disciplines = ref<Disc[]>([])
const loading = ref(true)

const form = reactive<{ org_id: string | null; name: string; sport: string; code: string }>({ org_id: null, name: '', sport: '', code: '' })
const editingId = ref<string | null>(null)

const byOrg = computed(() =>
  govOrgs.value
    .map(o => ({ org: o, items: disciplines.value.filter(d => d.org_id === o.id) }))
    .filter(g => g.items.length || true))

async function load() {
  loading.value = true
  const [{ data: orgs }, { data: discs }] = await Promise.all([
    (db.from as any)('organisations').select('id, name, org_level').neq('org_level', 'CLUB').order('name'),
    (db.from as any)('disciplines').select('id, org_id, name, sport, code').order('sport').order('name'),
  ])
  govOrgs.value = orgs ?? []
  disciplines.value = discs ?? []
  if (!form.org_id && govOrgs.value.length) form.org_id = govOrgs.value[0].id
  loading.value = false
}

function startEdit(d: Disc) {
  editingId.value = d.id
  form.org_id = d.org_id; form.name = d.name; form.sport = d.sport ?? ''; form.code = d.code ?? ''
}
function resetForm() {
  editingId.value = null; form.name = ''; form.sport = ''; form.code = ''
}

async function save() {
  if (!form.org_id || !form.name.trim()) { toast.add({ severity: 'warn', summary: 'Pick a governing body and a name', life: 3000 }); return }
  const payload = { org_id: form.org_id, name: form.name.trim(), sport: form.sport.trim() || null, code: form.code.trim() || null }
  if (editingId.value) {
    await (db.from as any)('disciplines').update(payload).eq('id', editingId.value)
  } else {
    await (db.from as any)('disciplines').insert(payload)
  }
  resetForm()
  await load()
  toast.add({ severity: 'success', summary: 'Discipline saved', life: 2000 })
}

async function remove(d: Disc) {
  await (db.from as any)('disciplines').delete().eq('id', d.id)
  if (editingId.value === d.id) resetForm()
  await load()
}

onMounted(() => { if (!isSuper.value) { navigateTo('/'); return } load() })
</script>

<template>
  <div v-if="isSuper" class="p-6 md:p-8 max-w-5xl mx-auto space-y-5">
    <div>
      <h1 class="text-xl font-semibold text-gray-900">Disciplines</h1>
      <p class="text-sm text-gray-500">Canonical NSO categories that clubs map their groups & events to (for cross-club roll-up reporting).</p>
    </div>

    <!-- Add / edit -->
    <div class="card p-5">
      <h2 class="text-sm font-semibold text-gray-700 mb-3">{{ editingId ? 'Edit discipline' : 'New discipline' }}</h2>
      <div class="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_0.8fr_auto] gap-3 items-end">
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-gray-600">Governing body</label>
          <Select v-model="form.org_id" :options="govOrgs" option-label="name" option-value="id" filter class="w-full" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-gray-600">Name</label>
          <InputText v-model="form.name" placeholder="e.g. Seniors" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-gray-600">Sport</label>
          <InputText v-model="form.sport" placeholder="e.g. Cricket" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-gray-600">Code</label>
          <InputText v-model="form.code" placeholder="opt." />
        </div>
        <div class="flex items-center gap-2">
          <Button :label="editingId ? 'Save' : 'Add'" style="background:#1E2157;border-color:#1E2157" @click="save" />
          <Button v-if="editingId" label="Cancel" severity="secondary" text @click="resetForm" />
        </div>
      </div>
    </div>

    <!-- List grouped by governing body -->
    <div v-if="loading" class="text-sm text-gray-400">Loading…</div>
    <div v-else class="space-y-4">
      <div v-for="g in byOrg" :key="g.org.id" class="card p-0 overflow-hidden">
        <div class="px-5 py-2.5 border-b border-gray-100 flex items-center justify-between">
          <span class="text-sm font-semibold text-gray-700">{{ g.org.name }}</span>
          <span class="text-[11px] text-gray-400">{{ orgLevelLabel(g.org.org_level) }}</span>
        </div>
        <div v-if="!g.items.length" class="px-5 py-3 text-sm text-gray-400">No disciplines yet.</div>
        <table v-else class="w-full text-sm">
          <tbody>
            <tr v-for="d in g.items" :key="d.id" class="border-b border-gray-50 hover:bg-gray-50/60">
              <td class="px-5 py-2.5 font-medium text-gray-800">{{ d.name }}</td>
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
    </div>
  </div>
</template>
