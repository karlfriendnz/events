<!--
  Permission groups manager. Create named permission groups, set their CRUD
  grid across every registered function (PERMISSION_RESOURCES — extend that list
  as we build), and assign people to the group. Org-scoped.
-->
<script setup lang="ts">
const db = useDb()
const { orgId } = useOrg()
const toast = useToast()

interface Grp {
  id: string
  name: string
  description: string | null
  permissions: PermissionMap
  sort_order: number
  _memberIds: string[]
  _new?: boolean
}

const groups = ref<Grp[]>([])
const persons = ref<{ id: string; name: string }[]>([])
const selectedId = ref<string | null>(null)
const loading = ref(true)
const saving = ref(false)
const selected = computed(() => groups.value.find(g => g.id === selectedId.value) || null)

const resourcesByArea = computed(() =>
  PERMISSION_AREAS.map(area => ({ area, items: PERMISSION_RESOURCES.filter(r => r.area === area) })))

async function load() {
  loading.value = true
  const [{ data: grpData }, { data: people }, { data: members }] = await Promise.all([
    (db.from as any)('permission_groups').select('*').eq('org_id', orgId.value).order('sort_order').order('name'),
    (db.from as any)('persons').select('id, first_name, last_name').eq('org_id', orgId.value).order('last_name'),
    (db.from as any)('permission_group_members').select('group_id, person_id'),
  ])
  const memberBy: Record<string, string[]> = {}
  for (const m of members ?? []) (memberBy[m.group_id] ??= []).push(m.person_id)
  groups.value = (grpData ?? []).map((g: any) => ({
    ...g, permissions: g.permissions ?? {}, _memberIds: memberBy[g.id] ?? [],
  }))
  persons.value = (people ?? []).map((p: any) => ({ id: p.id, name: `${p.first_name} ${p.last_name}` }))
  if (!selectedId.value && groups.value.length) selectedId.value = groups.value[0].id
  loading.value = false
}

function newGroup() {
  const g: Grp = {
    id: 'tmp-' + Math.random().toString(36).slice(2),
    name: 'New group', description: '', permissions: {}, sort_order: groups.value.length, _memberIds: [], _new: true,
  }
  groups.value.push(g)
  selectedId.value = g.id
}

function isOn(res: string, action: PermAction): boolean {
  return !!selected.value?.permissions?.[res]?.[action]
}
function setOn(res: string, action: PermAction, val: boolean) {
  if (!selected.value) return
  const p = selected.value.permissions
  p[res] = { ...(p[res] || {}), [action]: val }
}
function toggleResource(res: string, val: boolean) {
  const r = PERMISSION_RESOURCES.find(x => x.key === res)
  if (!r) return
  for (const a of resourceActions(r)) setOn(res, a, val)
}
function toggleColumn(action: PermAction, val: boolean) {
  for (const r of PERMISSION_RESOURCES) if (resourceActions(r).includes(action)) setOn(r.key, action, val)
}

async function save() {
  const g = selected.value
  if (!g || !g.name.trim()) return
  saving.value = true
  let gid = g.id
  if (g._new) {
    const { data, error } = await (db.from as any)('permission_groups').insert({
      org_id: orgId.value, name: g.name, description: g.description, permissions: g.permissions, sort_order: g.sort_order,
    }).select('id').single()
    if (error) { toast.add({ severity: 'error', summary: 'Save failed', detail: error.message, life: 4000 }); saving.value = false; return }
    gid = data.id; g.id = gid; g._new = false; selectedId.value = gid
  } else {
    await (db.from as any)('permission_groups').update({
      name: g.name, description: g.description, permissions: g.permissions, updated_at: new Date().toISOString(),
    }).eq('id', gid)
  }
  // members: delete-then-insert
  await (db.from as any)('permission_group_members').delete().eq('group_id', gid)
  if (g._memberIds.length) {
    await (db.from as any)('permission_group_members').insert(g._memberIds.map(pid => ({ group_id: gid, person_id: pid })))
  }
  toast.add({ severity: 'success', summary: 'Permission group saved', life: 2500 })
  saving.value = false
}

async function removeGroup() {
  const g = selected.value
  if (!g) return
  if (!g._new) await (db.from as any)('permission_groups').delete().eq('id', g.id)
  groups.value = groups.value.filter(x => x.id !== g.id)
  selectedId.value = groups.value[0]?.id ?? null
}

watch(orgId, () => { if (orgId.value) load() }, { immediate: true })
</script>

<template>
  <div class="p-6 max-w-6xl mx-auto">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h1 class="text-xl font-semibold text-gray-900">Permission Groups</h1>
        <p class="text-sm text-gray-500">Create roles with a CRUD grid across every function, and assign people to them.</p>
      </div>
    </div>

    <div class="grid grid-cols-[220px_1fr] gap-5">
      <!-- Group list -->
      <div class="card p-0 overflow-hidden h-fit">
        <div class="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
          <span class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Groups</span>
          <button class="text-xs text-[#1E2157] hover:underline" @click="newGroup">+ New</button>
        </div>
        <div v-if="loading" class="p-4 text-sm text-gray-400">Loading…</div>
        <div v-else-if="!groups.length" class="p-4 text-sm text-gray-400">No groups yet.</div>
        <button v-for="g in groups" :key="g.id" type="button"
          class="w-full text-left px-4 py-2.5 text-sm border-b border-gray-50 hover:bg-gray-50 transition-colors flex items-center justify-between"
          :class="g.id === selectedId ? 'bg-gray-50 font-medium text-[#1E2157]' : 'text-gray-700'"
          @click="selectedId = g.id">
          <span class="truncate">{{ g.name }}<span v-if="g._new" class="text-[10px] text-amber-500"> ·new</span></span>
          <span class="text-[10px] text-gray-400">{{ g._memberIds.length }}</span>
        </button>
      </div>

      <!-- Editor -->
      <div v-if="selected" class="space-y-4">
        <div class="card p-5 space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium">Group name</label>
              <InputText v-model="selected.name" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium">Members</label>
              <MultiSelect v-model="selected._memberIds" :options="persons" option-label="name" option-value="id"
                filter placeholder="Assign people" class="w-full" :maxSelectedLabels="3" />
            </div>
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Description</label>
            <InputText v-model="selected.description" placeholder="What this group can do" />
          </div>
        </div>

        <!-- CRUD grid -->
        <div class="card p-0 overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
                <th class="text-left px-4 py-2 font-medium">Function</th>
                <th v-for="a in PERM_ACTIONS" :key="a.key" class="px-3 py-2 font-medium text-center w-20">
                  <div class="flex flex-col items-center gap-0.5">
                    <span>{{ a.label }}</span>
                    <button class="text-[10px] text-gray-400 hover:text-[#1E2157]" title="Toggle column"
                      @click="toggleColumn(a.key, true)">all</button>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <template v-for="block in resourcesByArea" :key="block.area">
                <tr class="bg-gray-50/60">
                  <td :colspan="PERM_ACTIONS.length + 1" class="px-4 py-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{{ block.area }}</td>
                </tr>
                <tr v-for="r in block.items" :key="r.key" class="border-b border-gray-50 hover:bg-gray-50/60">
                  <td class="px-4 py-2">
                    <button class="text-gray-800 hover:text-[#1E2157] font-medium" title="Toggle row"
                      @click="toggleResource(r.key, !isOn(r.key, 'read'))">{{ r.label }}</button>
                  </td>
                  <td v-for="a in PERM_ACTIONS" :key="a.key" class="px-3 py-2 text-center">
                    <input type="checkbox" class="w-4 h-4 accent-[#1E2157] cursor-pointer"
                      :checked="isOn(r.key, a.key)"
                      @change="setOn(r.key, a.key, ($event.target as HTMLInputElement).checked)" />
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <div class="flex items-center justify-between">
          <button class="text-sm text-red-600 hover:underline" @click="removeGroup">Delete group</button>
          <Button label="Save" :loading="saving" style="background:#1E2157;border-color:#1E2157" @click="save" />
        </div>
      </div>
      <div v-else class="card p-8 text-center text-gray-400 text-sm">
        Select a group, or create a new one.
      </div>
    </div>
  </div>
</template>
