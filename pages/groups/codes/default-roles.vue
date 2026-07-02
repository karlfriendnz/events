<!--
  Default staff roles (/groups/codes/default-roles) — the org-wide roles every
  code inherits (Manager, Coach…). Edited here ONCE; each code's settings page
  shows them read-only. Master-detail design matching /settings/roles: a left
  role list + a right capability matrix editor.
-->
<script setup lang="ts">
const cr = useCodeRoles()
const { orgId } = useOrg()
const toast = useToast()

interface RoleRow { _uid: number; id?: string; key: string; label: string; capabilities: string[] }
let uid = 1
const items = ref<RoleRow[]>([])
const selectedUid = ref<number | null>(null)
const selected = computed(() => items.value.find(r => r._uid === selectedUid.value) || null)
const loading = ref(true)
const saving = ref(false)

async function load() {
  loading.value = true
  const defs = await cr.ensureDefaults()
  items.value = defs.filter(d => d.code_lineage_id == null)
    .map(d => ({ _uid: uid++, id: d.id, key: d.key, label: d.label, capabilities: [...(d.capabilities ?? [])] }))
  if (!selected.value && items.value.length) selectedUid.value = items.value[0]._uid
  loading.value = false
}
function addRole() {
  const it: RoleRow = { _uid: uid++, key: '', label: 'New role', capabilities: [] }
  items.value.push(it); selectedUid.value = it._uid
}
function removeRole(row: RoleRow) {
  items.value = items.value.filter(r => r._uid !== row._uid)
  selectedUid.value = items.value[0]?._uid ?? null
}
function toggleCap(row: RoleRow, cap: string) {
  const i = row.capabilities.indexOf(cap)
  if (i === -1) row.capabilities.push(cap); else row.capabilities.splice(i, 1)
}
const roleManages = (row: RoleRow) => row.capabilities.includes('add_people') || row.capabilities.includes('create_groups')

async function save() {
  saving.value = true
  await cr.saveRolesForScope(null, items.value.filter(r => r.label.trim()).map((r, i) => ({
    code_lineage_id: null, key: r.key || cr.slug(r.label), label: r.label.trim(), capabilities: r.capabilities, sort_order: i,
  })))
  saving.value = false
  await load()
  toast.add({ severity: 'success', summary: 'Default roles saved', life: 1600 })
}

watch(orgId, () => { if (orgId.value) load() }, { immediate: true })
</script>

<template>
  <div class="p-3 sm:p-6 max-w-5xl mx-auto space-y-4">
    <div>
      <NuxtLink to="/groups/codes" class="text-sm text-gray-500 hover:text-primary inline-flex items-center gap-1">
        <i class="pi pi-arrow-left text-xs" /> Organise codes
      </NuxtLink>
      <h1 class="text-lg sm:text-2xl font-semibold text-gray-900 mt-2">Default staff roles</h1>
      <p class="text-sm text-gray-500">The roles every code inherits. Each code can add its own on top — edit those on the code's settings page.</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-5">
      <!-- list -->
      <div class="card p-0 overflow-hidden h-fit">
        <div class="px-4 py-2.5 bg-gray-50/60 border-b border-gray-100 flex items-center justify-between">
          <span class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Roles</span>
          <button class="text-xs text-primary hover:underline" @click="addRole">+ Add</button>
        </div>
        <div v-if="loading" class="p-4 text-sm text-gray-400">Loading…</div>
        <button v-for="it in items" :key="it._uid" type="button"
          class="w-full text-left px-4 py-2.5 text-sm border-b border-gray-50 hover:bg-gray-50 transition-colors flex items-center justify-between gap-2"
          :class="it._uid === selectedUid ? 'bg-gray-50 font-medium text-primary' : 'text-gray-700'"
          @click="selectedUid = it._uid">
          <span class="truncate">{{ it.label || 'Untitled' }}</span>
          <span v-if="roleManages(it)" class="text-[9px] uppercase tracking-wide shrink-0 text-amber-500">manages</span>
        </button>
        <div v-if="!loading && !items.length" class="p-4 text-sm text-gray-400">No roles.</div>
      </div>

      <!-- editor -->
      <div v-if="selected" class="space-y-4">
        <div class="card p-5">
          <div class="flex flex-col gap-1.5 sm:max-w-sm">
            <label class="text-sm font-medium">Role name</label>
            <InputText v-model="selected.label" placeholder="e.g. Manager" />
          </div>
        </div>

        <div class="card p-0 overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
                <th class="text-left px-4 py-2 font-medium">This role can…</th>
                <th class="px-3 py-2 font-medium text-center w-24">Allowed</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in cr.CODE_CAPABILITIES" :key="c.key" class="border-b border-gray-50 hover:bg-gray-50/60">
                <td class="px-4 py-2.5 align-top">
                  <button class="block text-left text-gray-800 hover:text-primary font-medium" @click="toggleCap(selected, c.key)">{{ c.label }}</button>
                  <p class="mt-0.5 text-[11px] leading-snug text-gray-400 max-w-[46ch]">{{ c.description }}</p>
                </td>
                <td class="px-3 py-2.5 text-center align-top">
                  <input type="checkbox" class="w-4 h-4 accent-primary cursor-pointer"
                    :checked="selected.capabilities.includes(c.key)" @change="toggleCap(selected, c.key)" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="flex items-center justify-between">
          <button class="text-sm text-red-600 hover:underline" @click="removeRole(selected)">Delete role</button>
          <Button label="Save" :loading="saving" style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="save" />
        </div>
      </div>
      <div v-else class="card p-8 text-center text-gray-400 text-sm">Select a role, or add one.</div>
    </div>
  </div>
</template>
