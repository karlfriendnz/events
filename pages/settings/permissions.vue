<!--
  Permission groups (club level). Inherits the super-admin core templates:
   - a core template shows as "Inherited" (read-only) with an "Override" button;
   - overriding creates an editable local copy (source_group_id -> core);
   - "Reset to core" deletes the local copy, reverting to the template.
  Plus the club's own local groups. Assign people on any editable group.
-->
<script setup lang="ts">
const db = useDb()
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
  const [{ data: core }, { data: local }, { data: people }, { data: members }] = await Promise.all([
    (db.from as any)('permission_groups').select('*').eq('is_core', true).order('sort_order'),
    (db.from as any)('permission_groups').select('*').eq('org_id', orgId.value).order('sort_order'),
    (db.from as any)('persons').select('id, first_name, last_name').eq('org_id', orgId.value).order('last_name'),
    (db.from as any)('permission_group_members').select('group_id, person_id'),
  ])
  const memberBy: Record<string, string[]> = {}
  for (const m of members ?? []) (memberBy[m.group_id] ??= []).push(m.person_id)
  const overrideByCore: Record<string, any> = {}
  const pureLocal: any[] = []
  for (const g of local ?? []) { if (g.source_group_id) overrideByCore[g.source_group_id] = g; else pureLocal.push(g) }

  const list: Item[] = []
  for (const c of core ?? []) {
    const ov = overrideByCore[c.id]
    if (ov) list.push({ key: 'core:' + c.id, kind: 'override', name: ov.name, description: ov.description, permissions: ov.permissions ?? {}, coreId: c.id, localId: ov.id, _memberIds: memberBy[ov.id] ?? [] })
    else list.push({ key: 'core:' + c.id, kind: 'core', name: c.name, description: c.description, permissions: c.permissions ?? {}, coreId: c.id, _memberIds: [] })
  }
  for (const g of pureLocal) list.push({ key: 'local:' + g.id, kind: 'local', name: g.name, description: g.description, permissions: g.permissions ?? {}, localId: g.id, _memberIds: memberBy[g.id] ?? [] })
  items.value = list
  persons.value = (people ?? []).map((p: any) => ({ id: p.id, name: `${p.first_name} ${p.last_name}` }))
  if (!selected.value && list.length) selectedKey.value = list[0].key
  persons.value && (loading.value = false)
}

function newGroup() {
  const it: Item = { key: 'new:' + Math.random().toString(36).slice(2), kind: 'local', name: 'New group', description: '', permissions: {}, _memberIds: [], _new: true }
  items.value.push(it); selectedKey.value = it.key
}

async function override(it: Item) {
  // create an editable local copy of the core template
  const { data, error } = await (db.from as any)('permission_groups').insert({
    org_id: orgId.value, is_core: false, source_group_id: it.coreId,
    name: it.name, description: it.description, permissions: JSON.parse(JSON.stringify(it.permissions || {})),
  }).select('id').single()
  if (error) { toast.add({ severity: 'error', summary: 'Override failed', detail: error.message, life: 4000 }); return }
  toast.add({ severity: 'success', summary: 'Override created — now editable', life: 2500 })
  await load(); selectedKey.value = 'core:' + it.coreId
}
async function resetToCore(it: Item) {
  if (it.localId) await (db.from as any)('permission_groups').delete().eq('id', it.localId)
  toast.add({ severity: 'success', summary: 'Reset to core template', life: 2500 })
  await load(); selectedKey.value = 'core:' + it.coreId
}

async function save() {
  const g = selected.value; if (!g || g.kind === 'core' || !g.name.trim()) return
  saving.value = true
  let gid = g.localId
  if (g._new || !gid) {
    const { data, error } = await (db.from as any)('permission_groups').insert({
      org_id: orgId.value, is_core: false, name: g.name, description: g.description, permissions: g.permissions,
    }).select('id').single()
    if (error) { toast.add({ severity: 'error', summary: 'Save failed', detail: error.message, life: 4000 }); saving.value = false; return }
    gid = data.id
  } else {
    await (db.from as any)('permission_groups').update({ name: g.name, description: g.description, permissions: g.permissions, updated_at: new Date().toISOString() }).eq('id', gid)
  }
  await (db.from as any)('permission_group_members').delete().eq('group_id', gid)
  if (g._memberIds.length) await (db.from as any)('permission_group_members').insert(g._memberIds.map(pid => ({ group_id: gid, person_id: pid })))
  toast.add({ severity: 'success', summary: 'Saved', life: 2000 }); saving.value = false; await load()
}
async function removeLocal(it: Item) {
  if (it.localId) await (db.from as any)('permission_groups').delete().eq('id', it.localId)
  items.value = items.value.filter(x => x.key !== it.key); selectedKey.value = items.value[0]?.key ?? null
  if (it.localId) await load()
}

watch(orgId, () => { if (orgId.value) load() }, { immediate: true })
</script>

<template>
  <div class="p-6 max-w-6xl mx-auto">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h1 class="text-xl font-semibold text-gray-900">Permission Groups</h1>
        <p class="text-sm text-gray-500">Inherited core templates (overridable) plus your own groups. Assign people and set the CRUD grid.</p>
      </div>
    </div>

    <div class="grid grid-cols-[240px_1fr] gap-5">
      <!-- list -->
      <div class="card p-0 overflow-hidden h-fit">
        <div class="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
          <span class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Groups</span>
          <button class="text-xs text-[#1E2157] hover:underline" @click="newGroup">+ New</button>
        </div>
        <div v-if="loading" class="p-4 text-sm text-gray-400">Loading…</div>
        <button v-for="it in items" :key="it.key" type="button"
          class="w-full text-left px-4 py-2.5 text-sm border-b border-gray-50 hover:bg-gray-50 transition-colors flex items-center justify-between gap-2"
          :class="it.key === selectedKey ? 'bg-gray-50 font-medium text-[#1E2157]' : 'text-gray-700'"
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
        <div v-if="selected.kind === 'core'" class="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 text-sm text-blue-800 flex items-center justify-between">
          <span><i class="pi pi-lock mr-1.5" />Inherited from the platform core template (read-only).</span>
          <Button label="Override to customise" size="small" style="background:#1E2157;border-color:#1E2157" @click="override(selected)" />
        </div>
        <div v-else-if="selected.kind === 'override'" class="bg-amber-50 border border-amber-100 rounded-lg px-4 py-2.5 text-sm text-amber-800 flex items-center justify-between">
          <span><i class="pi pi-pencil mr-1.5" />Overriding the core template for this club.</span>
          <Button label="Reset to core" size="small" severity="warning" outlined @click="resetToCore(selected)" />
        </div>

        <div class="card p-5 grid grid-cols-2 gap-3">
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
          <Button label="Save" :loading="saving" style="background:#1E2157;border-color:#1E2157" @click="save" />
        </div>
      </div>
      <div v-else class="card p-8 text-center text-gray-400 text-sm">Select a group, or create one.</div>
    </div>
  </div>
</template>
