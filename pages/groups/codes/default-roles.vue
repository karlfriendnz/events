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

interface RoleRow { _uid: number; groupKey: string; editable: boolean; id?: string; key: string; label: string; capabilities: string[] }
let uid = 1
const items = ref<RoleRow[]>([])
const loading = ref(true)
const saving = ref(false)
const groups = [{ key: 'default', label: 'Roles', addable: true }]

async function load() {
  loading.value = true
  const defs = await cr.ensureDefaults()
  items.value = defs.filter(d => d.code_lineage_id == null)
    .map(d => ({ _uid: uid++, groupKey: 'default', editable: true, id: d.id, key: d.key, label: d.label, capabilities: [...(d.capabilities ?? [])] }))
  loading.value = false
}
function addRole() {
  items.value.push({ _uid: uid++, groupKey: 'default', editable: true, key: '', label: 'New role', capabilities: [] })
}
function removeRole(row: RoleRow) { items.value = items.value.filter(r => r._uid !== row._uid) }

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

    <div v-if="loading" class="card p-6 text-sm text-gray-400">Loading…</div>
    <template v-else>
      <RolePermissions :groups="groups" :roles="items" :caps="cr.CODE_CAPABILITIES" @add="addRole" @remove="removeRole" />
      <div class="flex justify-end">
        <Button label="Save" :loading="saving" style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="save" />
      </div>
    </template>
  </div>
</template>
