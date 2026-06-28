<!--
  Settings → Roles. The configurable catalogue of SCOPED (per-resource) roles —
  what a person can DO on a group or an event. A role is just a name + the set of
  capabilities it grants ("can add members", "can communicate with the group",
  "can take attendance"…). Defined ONCE here at the component level, then
  assignable across ALL groups / ALL events (not configured per instance) — the
  org builds the roles however it wants.

  Master-detail layout, mirroring Settings → User type (permissions): a left list
  (Group roles + Event roles) and a right editor pane (role name + a capability
  matrix). Persists to scoped_role_defs (migration 184). The code registry
  (SCOPED_ROLES / SCOPED_CAPABILITIES) seeds the defaults the first time + remains
  the fallback when an org has no saved rows. role_group (staff/member, used for
  the roster split) is DERIVED from the ticked capabilities, not picked.
-->
<script setup lang="ts">
const db = useDb()
const { orgId } = useOrg()
const toast = useToast()
const scoped = useScopedRoles()

type ResType = 'group' | 'event'
interface RoleRow {
  _uid: number
  type: ResType
  key: string            // stable slug stored in roles[]; '' = new (derived on save)
  label: string
  capabilities: string[]
}

const SECTIONS: { type: ResType; title: string }[] = [
  { type: 'group', title: 'Group roles' },
  { type: 'event', title: 'Event roles' },
]

const items = ref<RoleRow[]>([])
const selectedUid = ref<number | null>(null)
const selected = computed(() => items.value.find(r => r._uid === selectedUid.value) || null)
const loading = ref(true)
const saving = ref(false)
let uid = 0

function rowsFor(type: ResType) { return items.value.filter(r => r.type === type) }
function capsFor(type: ResType) { return SCOPED_CAPABILITIES[type] }
function roleManages(row: RoleRow) { return roleRuns(row.type, row.capabilities) }
function slugify(s: string) {
  return (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function load() {
  loading.value = true
  const id = orgId.value
  if (!id) { loading.value = false; return }
  ;(db.from as any)('scoped_role_defs')
    .select('resource_type, key, label, capabilities, sort_order')
    .eq('org_id', id).order('sort_order')
    .then(({ data }: any) => {
      const list: RoleRow[] = []
      for (const { type } of SECTIONS) {
        const saved = (data ?? []).filter((r: any) => r.resource_type === type)
        const src = saved.length
          ? saved.map((r: any) => ({ key: r.key, label: r.label, capabilities: r.capabilities ?? [] }))
          : SCOPED_ROLES[type].map(r => ({ key: r.key, label: r.label, capabilities: [...r.capabilities] }))
        for (const r of src) list.push({ _uid: uid++, type, ...r } as RoleRow)
      }
      items.value = list
      if (!selected.value && list.length) selectedUid.value = list[0]._uid
      loading.value = false
    })
}

function addRole(type: ResType) {
  const it: RoleRow = { _uid: uid++, type, key: '', label: 'New role', capabilities: ['view'] }
  items.value.push(it); selectedUid.value = it._uid
}
function removeRole(it: RoleRow) {
  items.value = items.value.filter(r => r._uid !== it._uid)
  selectedUid.value = items.value[0]?._uid ?? null
  save()
}
function toggleCap(row: RoleRow, cap: string) {
  const i = row.capabilities.indexOf(cap)
  if (i === -1) row.capabilities.push(cap)
  else row.capabilities.splice(i, 1)
}

async function save() {
  const id = orgId.value
  if (!id) return
  const inserts: any[] = []
  let bad = ''
  for (const { type } of SECTIONS) {
    const seen = new Set<string>()
    rowsFor(type).forEach((r, idx) => {
      const label = (r.label || '').trim()
      if (!label) { bad = bad || 'Every role needs a name.'; return }
      let key = r.key || slugify(label) || `role_${idx}`
      let k = key, n = 2
      while (seen.has(k)) k = `${key}_${n++}`
      seen.add(k); r.key = k
      inserts.push({
        org_id: id, resource_type: type, key: k, label,
        role_group: roleRuns(type, r.capabilities) ? 'staff' : 'member', // derived
        capabilities: r.capabilities, field_type: null, sort_order: idx,
      })
    })
  }
  if (bad) { toast.add({ severity: 'warn', summary: bad, life: 3000 }); return }
  saving.value = true
  try {
    await (db.from as any)('scoped_role_defs').delete().eq('org_id', id)
    if (inserts.length) {
      const { error } = await (db.from as any)('scoped_role_defs').insert(inserts)
      if (error) throw error
    }
    await scoped.loadRoleDefs(true)
    toast.add({ severity: 'success', summary: 'Roles saved', life: 2000 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Could not save', detail: e?.message, life: 3500 })
  }
  saving.value = false
}

watch(orgId, () => { if (orgId.value) load() }, { immediate: true })
</script>

<template>
  <div class="p-3 sm:p-6 min-h-full flex flex-col">
    <div class="flex flex-col md:flex-row gap-4 md:gap-6 flex-1 min-h-0">
      <SettingsNav />
      <div class="flex-1 min-w-0 settings-fill">
        <Tabs value="roles">
          <TabPanels>
            <TabPanel value="roles" class="space-y-4">

    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-gray-900">Roles</h1>
        <p class="text-sm text-gray-500">Build your own roles — a role is a name plus what it lets the person do. Define it once and assign it on any group or event.</p>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-5">
      <!-- list -->
      <div class="card p-0 overflow-hidden h-fit">
        <div v-if="loading" class="p-4 text-sm text-gray-400">Loading…</div>
        <template v-for="s in SECTIONS" :key="s.type">
          <div class="px-4 py-2.5 bg-gray-50/60 border-b border-gray-100 flex items-center justify-between">
            <span class="text-xs font-semibold text-gray-600 uppercase tracking-wide">{{ s.title }}</span>
            <button class="text-xs text-primary hover:underline" @click="addRole(s.type)">+ Add</button>
          </div>
          <button v-for="it in rowsFor(s.type)" :key="it._uid" type="button"
            class="w-full text-left px-4 py-2.5 text-sm border-b border-gray-50 hover:bg-gray-50 transition-colors flex items-center justify-between gap-2"
            :class="it._uid === selectedUid ? 'bg-gray-50 font-medium text-primary' : 'text-gray-700'"
            @click="selectedUid = it._uid">
            <span class="truncate">{{ it.label || 'Untitled' }}</span>
            <span v-if="roleManages(it)" class="text-[9px] uppercase tracking-wide shrink-0 text-amber-500">manages</span>
          </button>
        </template>
      </div>

      <!-- editor -->
      <div v-if="selected" class="space-y-4">
        <div class="card p-5">
          <div class="flex flex-col gap-1.5 sm:max-w-sm">
            <label class="text-sm font-medium">Role name</label>
            <InputText v-model="selected.label" placeholder="e.g. Manager" />
          </div>
        </div>

        <!-- capability matrix (permissions-grid styling) -->
        <div class="card p-0 overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
                <th class="text-left px-4 py-2 font-medium">This role can…</th>
                <th class="px-3 py-2 font-medium text-center w-24">Allowed</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in capsFor(selected.type)" :key="c.key" class="border-b border-gray-50 hover:bg-gray-50/60">
                <td class="px-4 py-2.5 align-top">
                  <button class="block text-left text-gray-800 hover:text-primary font-medium"
                    @click="toggleCap(selected, c.key)">{{ c.label }}</button>
                  <p class="mt-0.5 text-[11px] leading-snug text-gray-400 max-w-[46ch]">{{ c.hint }}</p>
                </td>
                <td class="px-3 py-2.5 text-center align-top">
                  <input type="checkbox" class="w-4 h-4 accent-primary cursor-pointer"
                    :checked="selected.capabilities.includes(c.key)"
                    @change="toggleCap(selected, c.key)" />
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

            </TabPanel>
          </TabPanels>
        </Tabs>
        <Toast />
      </div>
    </div>
  </div>
</template>
