<!--
  PROTOTYPE · People types setup. ONE source of truth — the club's OWN person
  types (no global tier, no ancestor types pulled in, so no duplicates / no
  two-concept confusion). Each type: Layout · Fields · Permissions · Reports.
  Personal details + Communication are global core fields (set at /proto/core-fields)
  and show locked here. Field-level NSO inheritance is unaffected (a field can still
  be inherited + locked via <ProtoFieldEditor>).
-->
<script setup lang="ts">
const db = useDb()
const { orgId } = useOrg()
const toast = useToast()
const { loadOrgTypes, resolveFields, fieldAppliesTo } = useOrgFieldPolicy()
const { CORE_SECTIONS, coreStatus, loadConfig } = useCoreFields()

const STANDARD = [
  { key: 'member', label: 'Member', is_access: false },
  { key: 'parent', label: 'Parent', is_access: false },
  { key: 'emergency_contact', label: 'Emergency contact', is_access: false },
  { key: 'committee', label: 'Committee', is_access: true },
  { key: 'manager', label: 'Manager', is_access: true },
  { key: 'admin', label: 'Admin', is_access: true },
]

const types = ref<any[]>([])
const fields = ref<any[]>([])
const coreConfig = ref<any>({ required: {}, enabled: {} })
const coreSections = computed(() => CORE_SECTIONS.map(s => ({
  ...s, fields: s.fields.map(f => ({ ...f, status: coreStatus(coreConfig.value, f) })).filter(f => f.status !== 'off'),
})))
const selectedKey = ref<string | null>(null)
const selected = computed(() => types.value.find(t => t.key === selectedKey.value) || null)
const tab = ref<'layout' | 'fields' | 'permissions' | 'reports'>('layout')
const editingField = ref<any>(null)
const loading = ref(true)
const saving = ref(false)
const adding = ref(false)
const newLabel = ref('')

const applicableFields = computed(() =>
  selected.value ? fields.value.filter(f => fieldAppliesTo(f, selected.value.key)) : [])
const fieldTargetOptions = computed(() =>
  selected.value ? [{ key: selected.value.key, label: selected.value.label }] : [])

function slugify(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') }

async function load() {
  loading.value = true
  const id = orgId.value
  if (!id) { loading.value = false; return }
  const [all, flds, ce] = await Promise.all([loadOrgTypes(id), resolveFields(id), loadConfig()])
  coreConfig.value = ce
  types.value = all.filter((t: any) => (t.kind ?? 'person') === 'person')
    .map((t: any) => ({ ...t, permissions: t.permissions ?? {} }))
  fields.value = flds
  if ((!selected.value) && types.value.length) selectedKey.value = types.value[0].key
  loading.value = false
}

async function seedStandard() {
  const existing = new Set(types.value.map(t => t.key))
  const rows = STANDARD.filter(s => !existing.has(s.key)).map((s, i) => ({
    org_id: orgId.value, key: s.key, label: s.label, kind: 'person',
    is_access: s.is_access, min_count: 0, max_count: null, sort_order: types.value.length + i,
  }))
  if (rows.length) {
    const { error } = await (db.from as any)('person_target_types').insert(rows)
    if (error) { toast.add({ severity: 'error', summary: 'Failed', detail: error.message, life: 4000 }); return }
  }
  await load(); if (!selectedKey.value && types.value.length) selectedKey.value = types.value[0].key
  toast.add({ severity: 'success', summary: 'Standard types added', life: 2000 })
}

async function addType() {
  const label = newLabel.value.trim()
  if (!label || !orgId.value) return
  const { error } = await (db.from as any)('person_target_types').insert({
    org_id: orgId.value, key: slugify(label) || 'type_' + Date.now(), label,
    kind: 'person', is_access: false, min_count: 0, max_count: null, sort_order: types.value.length,
  })
  if (error) { toast.add({ severity: 'error', summary: 'Failed', detail: error.message, life: 4000 }); return }
  newLabel.value = ''; adding.value = false
  await load(); selectedKey.value = slugify(label)
}
async function removeType(t: any) {
  if (!confirm(`Delete the "${t.label}" type?`)) return
  await (db.from as any)('person_target_types').delete().eq('id', t.id)
  selectedKey.value = null; await load()
}

async function addField(p: any) {
  const { error } = await (db.from as any)('field_definitions').insert({
    org_id: orgId.value, label: p.label, field_type: p.type, is_required: p.required,
    options: p.options, help_text: p.placeholder || null,
    targets: (p.targets?.length ? p.targets : [selected.value?.key]),
    target: (p.targets?.length ? p.targets[0] : selected.value?.key),
    rules: [], sort_order: fields.value.length,
  })
  if (error) { toast.add({ severity: 'error', summary: 'Failed', detail: error.message, life: 4000 }); return }
  toast.add({ severity: 'success', summary: `Field "${p.label}" added`, life: 2000 })
  fields.value = await resolveFields(orgId.value!)
}
async function onFieldChanged() { fields.value = await resolveFields(orgId.value!); editingField.value = null }
watch(selectedKey, () => { editingField.value = null })

async function savePermissions() {
  const t = selected.value
  if (!t) return
  saving.value = true
  await (db.from as any)('person_target_types').update({ permissions: t.permissions, is_access: !!t.is_access }).eq('id', t.id)
  saving.value = false
  toast.add({ severity: 'success', summary: 'Saved', life: 2000 })
}

watch(orgId, load, { immediate: true })
</script>

<template>
  <div class="p-3 sm:p-6 min-h-full flex flex-col">
    <div class="flex flex-col md:flex-row gap-4 md:gap-6 flex-1 min-h-0">
      <ProtoNav />
      <div class="flex-1 min-w-0">
        <div class="mb-4 flex items-start justify-between gap-3">
          <div>
            <h1 class="text-xl font-semibold text-gray-900">People types</h1>
            <p class="text-sm text-gray-500">The kinds of people your club tracks — their fields, profile layout and what they can do.</p>
          </div>
          <button v-if="types.length" class="text-xs text-primary hover:underline shrink-0" @click="seedStandard">+ Add standard set</button>
        </div>

        <div v-if="loading" class="text-sm text-gray-400">Loading…</div>

        <!-- empty state -->
        <div v-else-if="!types.length" class="card p-8 text-center">
          <p class="text-sm text-gray-600 mb-1">No people types yet.</p>
          <p class="text-xs text-gray-400 mb-4">Start from the standard set, or add your own.</p>
          <Button label="Add standard set (Member, Parent, Coach…)" size="small" @click="seedStandard" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-5">
          <!-- type list -->
          <div class="card p-0 overflow-hidden h-fit">
            <div class="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
              <span class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Types</span>
              <button class="text-xs text-primary hover:underline" @click="adding = !adding">+ New</button>
            </div>
            <div v-if="adding" class="p-3 border-b border-gray-100 flex gap-2">
              <InputText v-model="newLabel" placeholder="e.g. Coach" class="flex-1" size="small" @keyup.enter="addType" />
              <Button label="Add" size="small" @click="addType" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
            </div>
            <button v-for="t in types" :key="t.key" type="button"
              class="w-full text-left px-4 py-2.5 text-sm border-b border-gray-50 hover:bg-gray-50 transition-colors flex items-center justify-between gap-2"
              :class="t.key === selectedKey ? 'bg-gray-50 font-medium text-primary' : 'text-gray-700'"
              @click="selectedKey = t.key">
              <span class="truncate flex items-center gap-1.5">{{ t.label }}<i v-if="t.is_access" v-tooltip.top="'Grants access (permissions)'" class="pi pi-shield text-[10px] text-emerald-400" /></span>
            </button>
          </div>

          <!-- editor -->
          <div v-if="selected" class="space-y-3">
            <div class="flex gap-1 border-b border-gray-200">
              <button v-for="tb in (['layout','fields','permissions','reports'] as const)" :key="tb"
                class="px-3 py-2 text-sm font-medium border-b-2 -mb-px capitalize transition-colors"
                :class="tab === tb ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'"
                @click="tab = tb">{{ tb }}</button>
            </div>

            <!-- LAYOUT -->
            <div v-show="tab === 'layout'">
              <PersonFormBuilder :key="selected.key" :target="selected.key" :target-label="selected.label" :org-id="orgId!" />
            </div>

            <!-- FIELDS -->
            <div v-show="tab === 'fields'" class="space-y-3">
              <div class="card p-0 overflow-hidden border-dashed">
                <div class="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide"><i class="pi pi-lock text-[10px] mr-1" />Global fields</span>
                  <NuxtLink to="/proto/core-fields" class="text-[11px] text-primary hover:underline">Set globally →</NuxtLink>
                </div>
                <div v-for="s in coreSections" :key="s.key">
                  <div class="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">{{ s.label }}</div>
                  <div v-for="f in s.fields" :key="f.key" class="px-4 py-1.5 border-b border-gray-50 flex items-center justify-between text-sm text-gray-500">
                    <span>{{ f.label }}</span>
                    <span class="text-[10px] uppercase tracking-wide font-medium"
                      :class="f.status === 'required' ? 'text-rose-500' : f.status === 'conditional' ? 'text-amber-500' : 'text-gray-300'">
                      {{ f.status === 'required' ? 'required' : f.status === 'conditional' ? 'when needed' : 'optional' }}
                    </span>
                  </div>
                </div>
                <p class="px-4 py-2 text-[11px] text-gray-400">Personal details &amp; communication are the same for everyone — set in <NuxtLink to="/proto/core-fields" class="text-primary hover:underline">Personal &amp; communication</NuxtLink>.</p>
              </div>

              <div class="card p-0 overflow-hidden">
                <div class="px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">{{ selected.label }} fields</div>
                <div v-if="!applicableFields.length" class="px-4 py-3 text-sm text-gray-400">No fields yet.</div>
                <button v-for="f in applicableFields" :key="f.id" type="button"
                  class="w-full text-left px-4 py-2 border-b border-gray-50 flex items-center justify-between text-sm hover:bg-gray-50 transition-colors"
                  :class="editingField?.id === f.id ? 'bg-gray-50' : ''" @click="editingField = f">
                  <span class="flex items-center gap-1.5 text-gray-800">
                    <i v-if="f.inherited" class="pi pi-lock text-[10px] text-blue-400" />{{ f.label }}
                  </span>
                  <span class="flex items-center gap-2">
                    <span class="text-[11px] text-gray-400">{{ f.field_type }}</span>
                    <span v-if="f.is_required" class="text-[9px] uppercase tracking-wide text-rose-500">required</span>
                    <span v-if="f.inherited" class="text-[9px] uppercase tracking-wide text-blue-400">NSO</span>
                    <i v-else class="pi pi-pencil text-[10px] text-gray-300" />
                  </span>
                </button>
              </div>
              <ProtoFieldEditor v-if="editingField" :key="editingField.id" :field="editingField"
                @saved="onFieldChanged" @deleted="onFieldChanged" @close="editingField = null" />
              <FieldCreator v-else :person-types="fieldTargetOptions" @add="addField" />
            </div>

            <!-- PERMISSIONS -->
            <div v-show="tab === 'permissions'" class="space-y-3">
              <div class="flex items-center justify-between">
                <p class="text-xs text-gray-500">What a {{ selected.label }} can do across the club. A person's real access is the union of all their people types.</p>
                <label class="flex items-center gap-2 text-xs text-gray-600 shrink-0"><ToggleSwitch v-model="selected.is_access" />Grants access</label>
              </div>
              <PermissionGrid v-model="selected.permissions" />
              <div class="flex justify-end">
                <Button label="Save permissions" size="small" :loading="saving" @click="savePermissions" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
              </div>
            </div>

            <!-- REPORTS (stub) -->
            <div v-show="tab === 'reports'" class="card p-6 text-center text-sm text-gray-400">
              Reports for {{ selected.label }} — count, breakdowns by field. <span class="block text-xs mt-1">(Prototype placeholder.)</span>
            </div>

            <div class="pt-1">
              <button class="text-sm text-red-600 hover:underline" @click="removeType(selected)">Delete this type</button>
            </div>
          </div>
          <div v-else class="card p-8 text-center text-gray-400 text-sm">Select a type, or add one.</div>
        </div>
        <Toast />
      </div>
    </div>
  </div>
</template>
