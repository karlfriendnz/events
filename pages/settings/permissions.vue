<!--
  Permission groups (club level). Inherits the super-admin core templates:
   - a core template shows as "Inherited" (read-only) with an "Override" button;
   - overriding creates an editable local copy (source_group_id -> core);
   - "Reset to core" deletes the local copy, reverting to the template.
  Plus the club's own local groups. Assign people on any editable group.
-->
<script setup lang="ts">
// Permission-group editor, fully on the seam: reads the org's groups (core templates
// merged in) + persons + the per-group membership edges, and writes create/override/
// update/delete + set-members through useRolesApi.
const roles = useRolesApi()
const peopleApi = usePeopleApi()
const { orgId } = useOrg()
const toast = useToast()

interface Item {
  key: string
  kind: 'core' | 'override' | 'local'
  name: string
  description: string | null
  permissions: PermissionMap
  coreId?: string
  localId?: string
  _memberIds: string[]
  _new?: boolean
}

const items = ref<Item[]>([])
const persons = ref<{ id: string; name: string }[]>([])
const selectedKey = ref<string | null>(null)
const selected = computed(() => items.value.find(i => i.key === selectedKey.value) || null)
const loading = ref(true)
const saving = ref(false)

async function load() {
  loading.value = true
  const [groups, people, members] = await Promise.all([
    roles.permissionGroups(orgId.value),
    peopleApi.list(orgId.value),
    roles.permissionGroupMembers(orgId.value),
  ])
  const memberBy: Record<string, string[]> = {}
  for (const m of members) (memberBy[m.groupId] ??= []).push(m.personId)
  // The merged list carries both the core templates (isCore, orgId null) and this
  // club's own rows (orgId = ours: an override when sourceGroupId is set, else local).
  const core = groups.filter(g => g.isCore)
  const overrideByCore: Record<string, typeof groups[number]> = {}
  const pureLocal: typeof groups = []
  for (const g of groups.filter(g => !g.isCore && g.orgId === orgId.value)) {
    if (g.sourceGroupId) overrideByCore[g.sourceGroupId] = g; else pureLocal.push(g)
  }

  const list: Item[] = []
  for (const c of core) {
    const ov = overrideByCore[c.id]
    if (ov) list.push({ key: 'core:' + c.id, kind: 'override', name: ov.name, description: ov.description, permissions: ov.grants ?? {}, coreId: c.id, localId: ov.id, _memberIds: memberBy[ov.id] ?? [] })
    else list.push({ key: 'core:' + c.id, kind: 'core', name: c.name, description: c.description, permissions: c.grants ?? {}, coreId: c.id, _memberIds: [] })
  }
  for (const g of pureLocal) list.push({ key: 'local:' + g.id, kind: 'local', name: g.name, description: g.description, permissions: g.grants ?? {}, localId: g.id, _memberIds: memberBy[g.id] ?? [] })
  items.value = list
  persons.value = people.map(p => ({ id: p.id, name: `${p.firstName} ${p.lastName}` }))
  if (!selected.value && list.length) selectedKey.value = list[0].key
  loading.value = false
}

function newGroup() {
  const it: Item = { key: 'new:' + Math.random().toString(36).slice(2), kind: 'local', name: 'New group', description: '', permissions: {}, _memberIds: [], _new: true }
  items.value.push(it); selectedKey.value = it.key
}

async function override(it: Item) {
  // create an editable local copy of the core template
  try {
    await roles.createPermissionGroup({
      orgId: orgId.value, sourceGroupId: it.coreId,
      name: it.name, description: it.description, grants: JSON.parse(JSON.stringify(it.permissions || {})),
    })
    toast.add({ severity: 'success', summary: 'Override created — now editable', life: 2500 })
    await load(); selectedKey.value = 'core:' + it.coreId
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Override failed', detail: e?.message, life: 4000 })
  }
}
async function resetToCore(it: Item) {
  if (it.localId) await roles.removePermissionGroup(it.localId, orgId.value)
  toast.add({ severity: 'success', summary: 'Reset to core template', life: 2500 })
  await load(); selectedKey.value = 'core:' + it.coreId
}

async function save() {
  const g = selected.value; if (!g || g.kind === 'core' || !g.name.trim()) return
  saving.value = true
  try {
    let gid = g.localId
    if (g._new || !gid) {
      const created = await roles.createPermissionGroup({
        orgId: orgId.value, name: g.name, description: g.description, grants: g.permissions,
      })
      gid = created.id
    } else {
      await roles.updatePermissionGroup(gid, { orgId: orgId.value, name: g.name, description: g.description, grants: g.permissions })
    }
    await roles.setPermissionGroupMembers(gid!, orgId.value, g._memberIds)
    toast.add({ severity: 'success', summary: 'Saved', life: 2000 }); await load()
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Save failed', detail: e?.message, life: 4000 })
  } finally {
    saving.value = false
  }
}
async function removeLocal(it: Item) {
  if (it.localId) await roles.removePermissionGroup(it.localId, orgId.value)
  items.value = items.value.filter(x => x.key !== it.key); selectedKey.value = items.value[0]?.key ?? null
  if (it.localId) await load()
}

watch(orgId, () => { if (orgId.value) load() }, { immediate: true })
</script>

<template>
  <div class="p-3 sm:p-6 min-h-full flex flex-col">
    <div class="flex flex-col md:flex-row gap-4 md:gap-6 flex-1 min-h-0">
      <SettingsNav />
      <div class="flex-1 min-w-0 settings-fill">
        <Tabs value="perm">
          <TabPanels>
            <TabPanel value="perm" class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-gray-900">Permission Groups</h1>
        <p class="text-sm text-gray-500">Inherited core templates (overridable) plus your own groups. Assign people and set the CRUD grid.</p>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-5">
      <!-- list -->
      <div class="card p-0 overflow-hidden h-fit">
        <div class="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
          <span class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Groups</span>
          <button class="text-xs text-primary hover:underline" @click="newGroup">+ New</button>
        </div>
        <div v-if="loading" class="p-4 text-sm text-gray-400">Loading…</div>
        <button v-for="it in items" :key="it.key" type="button"
          class="w-full text-left px-4 py-2.5 text-sm border-b border-gray-50 hover:bg-gray-50 transition-colors flex items-center justify-between gap-2"
          :class="it.key === selectedKey ? 'bg-gray-50 font-medium text-primary' : 'text-gray-700'"
          @click="selectedKey = it.key">
          <span class="truncate">{{ it.name }}</span>
          <span class="text-[9px] uppercase tracking-wide shrink-0"
            :class="it.kind === 'core' ? 'text-gray-400' : it.kind === 'override' ? 'text-amber-500' : 'text-emerald-500'">
            {{ it.kind === 'core' ? 'inherited' : it.kind === 'override' ? 'override' : 'local' }}
          </span>
        </button>
      </div>

      <!-- editor -->
      <div v-if="selected" class="space-y-4">
        <div v-if="selected.kind === 'core'" class="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 text-sm text-blue-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span><i class="pi pi-lock mr-1.5" />Inherited from the platform core template (read-only).</span>
          <Button label="Override to customise" size="small" style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="override(selected)" />
        </div>
        <div v-else-if="selected.kind === 'override'" class="bg-amber-50 border border-amber-100 rounded-lg px-4 py-2.5 text-sm text-amber-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span><i class="pi pi-pencil mr-1.5" />Overriding the core template for this club.</span>
          <Button label="Reset to core" size="small" severity="warning" outlined @click="resetToCore(selected)" />
        </div>

        <div class="card p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Group name</label>
            <InputText v-model="selected.name" :disabled="selected.kind === 'core'" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Members</label>
            <MultiSelect v-model="selected._memberIds" :options="persons" option-label="name" option-value="id" filter
              placeholder="Assign people" class="w-full" :max-selected-labels="3" :disabled="selected.kind === 'core'" />
          </div>
        </div>

        <PermissionGrid v-model="selected.permissions" :readonly="selected.kind === 'core'" />

        <div v-if="selected.kind !== 'core'" class="flex items-center justify-between">
          <button v-if="selected.kind === 'local'" class="text-sm text-red-600 hover:underline" @click="removeLocal(selected)">Delete group</button>
          <span v-else />
          <Button label="Save" :loading="saving" style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="save" />
        </div>
      </div>
      <div v-else class="card p-8 text-center text-gray-400 text-sm">Select a group, or create one.</div>
    </div>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </div>
  </div>
</template>
