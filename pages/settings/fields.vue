<!--
  Settings · Types & fields. The live "two screens, one engine" editor (promoted
  from the /proto prototype). ONE source of truth = the club's OWN person/entity
  types (no NSO type-inheritance confusion; field-level NSO inheritance still
  applies via resolveFields). A top toggle switches People ↔ Entities.

  Each type: Layout · Fields · (Permissions for people / Members for entities) ·
  Reports — the shared engine. Permissions are a facet of a PERSON type
  (person_target_types.permissions + is_access); member slots define an ENTITY's
  roster (person_target_types.member_slots).
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

const kind = ref<'person' | 'entity'>('person')
const allTypes = ref<any[]>([])
const fields = ref<any[]>([])
const coreConfig = ref<any>({ required: {}, enabled: {} })
const coreSections = computed(() => CORE_SECTIONS.map(s => ({
  ...s, fields: s.fields.map(f => ({ ...f, status: coreStatus(coreConfig.value, f) })).filter(f => f.status !== 'off'),
})))

const personTypes = computed(() => allTypes.value.filter(t => (t.kind ?? 'person') === 'person'))
const entityTypes = computed(() => allTypes.value.filter(t => t.kind === 'entity'))
const types = computed(() => kind.value === 'person' ? personTypes.value : entityTypes.value)

// editingKey null = the TYPES TABLE; set = the editor for that type.
const editingKey = ref<string | null>(null)
const selected = computed(() => types.value.find(t => t.key === editingKey.value) || null)
const tab = ref<'layout' | 'fields' | 'access'>('layout')
function openEditor(key: string, t: 'layout' | 'fields' | 'access') { editingKey.value = key; tab.value = t }
function backToTable() { editingKey.value = null }
const accessTabLabel = computed(() => kind.value === 'person' ? 'permissions' : 'members')
const editingField = ref<any>(null)
const loading = ref(true)
const saving = ref(false)
const adding = ref(false)
const newLabel = ref('')

const applicableFields = computed(() =>
  selected.value ? fields.value.filter(f => fieldAppliesTo(f, selected.value!.key)) : [])
const fieldTargetOptions = computed(() =>
  selected.value ? [{ key: selected.value.key, label: selected.value.label }] : [])
const personTypeOptions = computed(() => personTypes.value.map(t => ({ label: t.label, value: t.key })))

function slugify(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') }

async function load() {
  loading.value = true
  const id = orgId.value
  if (!id) { loading.value = false; return }
  const [all, flds, ce] = await Promise.all([loadOrgTypes(id), resolveFields(id), loadConfig()])
  coreConfig.value = ce
  allTypes.value = (all ?? []).map((t: any) => ({
    ...t, permissions: t.permissions ?? {}, member_slots: t.member_slots ?? [],
  }))
  fields.value = flds
  loading.value = false
}

function switchKind(k: 'person' | 'entity') {
  kind.value = k
  editingKey.value = null
}

async function seedStandard() {
  const existing = new Set(personTypes.value.map(t => t.key))
  const rows = STANDARD.filter(s => !existing.has(s.key)).map((s, i) => ({
    org_id: orgId.value, key: s.key, label: s.label, kind: 'person',
    is_access: s.is_access, min_count: 0, max_count: null, sort_order: personTypes.value.length + i,
  }))
  if (rows.length) {
    const { error } = await (db.from as any)('person_target_types').insert(rows)
    if (error) { toast.add({ severity: 'error', summary: 'Failed', detail: error.message, life: 4000 }); return }
  }
  await load()
  toast.add({ severity: 'success', summary: 'Standard types added', life: 2000 })
}

async function addType() {
  const label = newLabel.value.trim()
  if (!label || !orgId.value) return
  const { error } = await (db.from as any)('person_target_types').insert({
    org_id: orgId.value, key: slugify(label) || 'type_' + Date.now(), label,
    kind: kind.value, is_access: false, min_count: 0, max_count: null, sort_order: types.value.length,
  })
  if (error) { toast.add({ severity: 'error', summary: 'Failed', detail: error.message, life: 4000 }); return }
  newLabel.value = ''; adding.value = false
  await load(); openEditor(slugify(label), 'layout')
}
async function removeType(t: any) {
  if (!confirm(`Delete the "${t.label}" type?`)) return
  await (db.from as any)('person_target_types').delete().eq('id', t.id)
  editingKey.value = null; await load()
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
watch(editingKey, () => { editingField.value = null })

async function savePermissions() {
  const t = selected.value
  if (!t) return
  saving.value = true
  await (db.from as any)('person_target_types').update({ permissions: t.permissions, is_access: !!t.is_access }).eq('id', t.id)
  saving.value = false
  toast.add({ severity: 'success', summary: 'Saved', life: 2000 })
}

// Entity member slots
function addSlot() {
  selected.value!.member_slots.push({ person_type: personTypes.value[0]?.key ?? 'member', label: '', min: 1, max: null, role: '' })
}
function removeSlot(i: number) { selected.value!.member_slots.splice(i, 1) }
async function saveMembers() {
  const t = selected.value
  if (!t) return
  saving.value = true
  await (db.from as any)('person_target_types').update({ member_slots: t.member_slots }).eq('id', t.id)
  saving.value = false
  toast.add({ severity: 'success', summary: 'Members saved', life: 2000 })
}

watch(orgId, load, { immediate: true })
</script>

<template>
  <div class="p-3 sm:p-6 flex flex-col md:flex-row gap-4 md:gap-6">
    <SettingsNav />
    <div class="flex-1 min-w-0">
      <div class="mb-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold text-gray-900">Types &amp; fields</h1>
          <p class="text-sm text-gray-500">The kinds of people and entities your club tracks — their fields, profile layout, and {{ kind === 'person' ? 'what they can do' : "who's in them" }}.</p>
        </div>
        <button v-if="kind === 'person' && personTypes.length" class="text-xs text-primary hover:underline shrink-0 self-start sm:self-auto" @click="seedStandard">+ Add standard set</button>
      </div>

      <!-- People / Entities toggle -->
      <div class="inline-flex rounded-lg border border-gray-200 p-0.5 mb-4">
        <button v-for="k in (['person','entity'] as const)" :key="k" type="button"
          class="px-4 py-1.5 text-sm font-medium rounded-md transition-colors"
          :class="kind === k ? 'bg-primary text-white' : 'text-gray-500 hover:text-gray-800'"
          @click="switchKind(k)">{{ k === 'person' ? 'People' : 'Entities' }}</button>
      </div>

      <div v-if="loading" class="text-sm text-gray-400">Loading…</div>

      <!-- empty state -->
      <div v-else-if="!types.length" class="card p-8 text-center">
        <p class="text-sm text-gray-600 mb-1">No {{ kind === 'person' ? 'people' : 'entity' }} types yet.</p>
        <p class="text-xs text-gray-400 mb-4">{{ kind === 'person' ? 'Start from the standard set, or add your own.' : 'Add one (Team, Business, Family…).' }}</p>
        <Button v-if="kind === 'person'" label="Add standard set (Member, Parent, Coach…)" size="small" @click="seedStandard" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
        <div v-else class="flex items-center gap-2 justify-center max-w-sm mx-auto">
          <InputText v-model="newLabel" placeholder="e.g. Team" size="small" @keyup.enter="addType" />
          <Button label="Add" size="small" @click="addType" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
        </div>
      </div>

      <!-- TABLE of types: Name · Layout · Fields · Permissions/Members -->
      <div v-else-if="!editingKey" class="card p-0 overflow-hidden max-w-3xl">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
              <th class="text-left px-4 sm:px-5 py-2.5 font-medium">{{ kind === 'person' ? 'Person type' : 'Entity type' }}</th>
              <th class="text-left px-3 py-2.5 font-medium w-28">Layout</th>
              <th class="text-left px-3 py-2.5 font-medium w-24">Fields</th>
              <th class="text-left px-3 py-2.5 font-medium w-36">{{ kind === 'person' ? 'Permissions' : 'Members' }}</th>
              <th class="w-10" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in types" :key="t.key" class="border-b border-gray-50 hover:bg-gray-50/60">
              <td class="px-4 sm:px-5 py-2.5">
                <span class="font-medium text-gray-800 inline-flex items-center gap-1.5">{{ t.label }}<i v-if="t.is_access" v-tooltip.top="'Grants access (permissions)'" class="pi pi-shield text-[10px] text-emerald-400" /></span>
              </td>
              <td class="px-3 py-2.5">
                <button class="text-primary hover:underline inline-flex items-center gap-1" @click="openEditor(t.key, 'layout')"><i class="pi pi-window-maximize text-[10px]" />Layout</button>
              </td>
              <td class="px-3 py-2.5">
                <button class="text-primary hover:underline inline-flex items-center gap-1" @click="openEditor(t.key, 'fields')"><i class="pi pi-list text-[10px]" />Fields</button>
              </td>
              <td class="px-3 py-2.5">
                <button class="text-primary hover:underline inline-flex items-center gap-1" @click="openEditor(t.key, 'access')"><i class="pi pi-shield text-[10px]" />{{ kind === 'person' ? 'Permissions' : 'Members' }}</button>
              </td>
              <td class="px-3 py-2.5 text-center">
                <button class="text-gray-300 hover:text-red-500" title="Delete type" @click="removeType(t)"><i class="pi pi-trash text-sm" /></button>
              </td>
            </tr>
            <!-- add-a-type row -->
            <tr class="bg-gray-50/40">
              <td colspan="5" class="px-4 sm:px-5 py-2.5">
                <div class="flex items-center gap-2 max-w-md">
                  <InputText v-model="newLabel" :placeholder="kind === 'person' ? 'Add a person type (e.g. Coach)' : 'Add an entity type (e.g. Team)'" class="flex-1" size="small" @keyup.enter="addType" />
                  <Button icon="pi pi-plus" label="Add" size="small" :disabled="!newLabel.trim()" @click="addType" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- EDITOR for one type -->
      <div v-else-if="selected" class="space-y-3">
        <div class="flex items-center gap-2 flex-wrap">
          <button class="text-sm text-gray-500 hover:text-primary inline-flex items-center gap-1" @click="backToTable"><i class="pi pi-arrow-left text-xs" /> All {{ kind === 'person' ? 'types' : 'entity types' }}</button>
          <span class="text-gray-300">/</span>
          <span class="text-sm font-semibold text-gray-800 inline-flex items-center gap-1.5">{{ selected.label }}<i v-if="selected.is_access" v-tooltip.top="'Grants access'" class="pi pi-shield text-[10px] text-emerald-400" /></span>
        </div>
        <div class="flex gap-1 border-b border-gray-200">
          <button v-for="tb in (['layout','fields','access'] as const)" :key="tb"
            class="px-3 py-2 text-sm font-medium border-b-2 -mb-px capitalize transition-colors"
            :class="tab === tb ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'"
            @click="tab = tb">{{ tb === 'access' ? accessTabLabel : tb }}</button>
        </div>

          <!-- LAYOUT -->
          <div v-show="tab === 'layout'">
            <PersonFormBuilder :key="selected.key" :target="selected.key" :target-label="selected.label" :org-id="orgId!" :entity="kind === 'entity'" />
          </div>

          <!-- FIELDS -->
          <div v-show="tab === 'fields'" class="space-y-3">
            <!-- global core fields block (people only) -->
            <div v-if="kind === 'person'" class="card p-0 overflow-hidden border-dashed">
              <div class="px-4 py-2 bg-gray-50 border-b border-gray-100">
                <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide"><i class="pi pi-lock text-[10px] mr-1" />Global fields</span>
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
              <p class="px-4 py-2 text-[11px] text-gray-400">Personal details &amp; communication are the same for every person type and always show on the profile.</p>
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

          <!-- ACCESS: permissions (people) / members (entities) -->
          <div v-show="tab === 'access'" class="space-y-3">
            <template v-if="kind === 'person'">
              <div class="flex items-center justify-between">
                <p class="text-xs text-gray-500">What a {{ selected.label }} can do across the club. A person's real access is the union of all their people types.</p>
                <label class="flex items-center gap-2 text-xs text-gray-600 shrink-0"><ToggleSwitch v-model="selected.is_access" />Grants access</label>
              </div>
              <PermissionGrid v-model="selected.permissions" />
              <div class="flex justify-end">
                <Button label="Save permissions" size="small" :loading="saving" @click="savePermissions" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
              </div>
            </template>
            <template v-else>
              <p class="text-xs text-gray-500">A {{ selected.label }} is made up of these people — pick the type, how many, and the role each gets.</p>
              <div class="card p-0 overflow-hidden">
                <div class="hidden sm:grid grid-cols-[1fr_90px_90px_1fr_32px] gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                  <span>People type</span><span>Min</span><span>Max</span><span>Default role</span><span></span>
                </div>
                <div v-for="(s, i) in selected.member_slots" :key="i" class="grid grid-cols-2 sm:grid-cols-[1fr_90px_90px_1fr_32px] gap-2 px-4 py-2.5 border-b border-gray-50 items-center">
                  <Select v-model="s.person_type" :options="personTypeOptions" optionLabel="label" optionValue="value" class="w-full" size="small" />
                  <InputNumber v-model="s.min" :min="0" class="w-full" size="small" inputClass="w-full" />
                  <InputNumber v-model="s.max" :min="0" class="w-full" size="small" inputClass="w-full" placeholder="∞" />
                  <InputText v-model="s.role" placeholder="e.g. Player" class="w-full" size="small" />
                  <button class="w-7 h-7 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50" @click="removeSlot(i)"><i class="pi pi-trash text-xs" /></button>
                </div>
                <div v-if="!selected.member_slots.length" class="px-4 py-3 text-sm text-gray-400">No member slots yet.</div>
              </div>
              <div class="flex items-center justify-between">
                <button class="text-sm font-medium text-primary hover:underline" @click="addSlot"><i class="pi pi-plus text-xs mr-1" />Add member slot</button>
                <Button label="Save members" size="small" :loading="saving" @click="saveMembers" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
              </div>
            </template>
          </div>

          <div class="pt-1">
            <button class="text-sm text-red-600 hover:underline" @click="removeType(selected)">Delete this type</button>
          </div>
        </div>
      <Toast />
    </div>
  </div>
</template>
