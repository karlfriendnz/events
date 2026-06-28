<!--
  PROTOTYPE · Settings-style setup for ENTITY types (teams, businesses, schools…).
  Same shell as People types — Fields · Layout · Reports are the SHARED engine —
  but the fourth tab is MEMBERS: which people types attach, how many, in what role.
-->
<script setup lang="ts">
const db = useDb()
const { orgId } = useOrg()
const toast = useToast()
const { loadOrgTypes, resolveFields, fieldAppliesTo } = useOrgFieldPolicy()

const types = ref<any[]>([])
const personTypes = ref<any[]>([])
const fields = ref<any[]>([])
const selectedKey = ref<string | null>(null)
const selected = computed(() => types.value.find(t => t.key === selectedKey.value) || null)
const tab = ref<'layout' | 'fields' | 'members' | 'reports'>('layout')
const editingField = ref<any>(null)

async function onFieldChanged() {
  fields.value = await resolveFields(orgId.value!)
  editingField.value = null
}
watch(selectedKey, () => { editingField.value = null })
const loading = ref(true)
const saving = ref(false)
const adding = ref(false)
const newLabel = ref('')

const applicableFields = computed(() =>
  selected.value ? fields.value.filter(f => fieldAppliesTo(f, selected.value.key)) : [])
const fieldTargetOptions = computed(() =>
  selected.value ? [{ key: selected.value.key, label: selected.value.label }] : [])
const personTypeOptions = computed(() => personTypes.value.map(t => ({ label: t.label, value: t.key })))

function slugify(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') }

async function load() {
  loading.value = true
  const id = orgId.value
  if (!id) { loading.value = false; return }
  const [all, flds, ownRows] = await Promise.all([
    loadOrgTypes(id),
    resolveFields(id),
    (db.from as any)('person_target_types').select('id, member_slots').eq('org_id', id),
  ])
  const extra: Record<string, any> = {}
  for (const r of (ownRows.data ?? [])) extra[r.id] = r
  personTypes.value = all.filter((t: any) => (t.kind ?? 'person') === 'person')
  types.value = all.filter((t: any) => t.kind === 'entity')
    .map((t: any) => ({ ...t, member_slots: extra[t.id]?.member_slots ?? [] }))
  fields.value = flds
  if (!selected.value && types.value.length) selectedKey.value = types.value[0].key
  loading.value = false
}

async function addType() {
  const label = newLabel.value.trim()
  if (!label || !orgId.value) return
  const { error } = await (db.from as any)('person_target_types').insert({
    org_id: orgId.value, key: slugify(label) || 'entity_' + Date.now(), label,
    kind: 'entity', min_count: 0, max_count: null, sort_order: types.value.length,
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

function addSlot() {
  selected.value.member_slots.push({ person_type: personTypes.value[0]?.key ?? 'member', label: '', min: 1, max: null, role: '' })
}
function removeSlot(i: number) { selected.value.member_slots.splice(i, 1) }
async function saveMembers() {
  const t = selected.value
  if (!t || t.inherited) return
  saving.value = true
  await (db.from as any)('person_target_types').update({ member_slots: t.member_slots }).eq('id', t.id)
  saving.value = false
  toast.add({ severity: 'success', summary: 'Members saved', life: 2000 })
}

async function addField(p: any) {
  const { error } = await (db.from as any)('field_definitions').insert({
    org_id: orgId.value, label: p.label, field_type: p.type, is_required: p.required,
    options: p.options, help_text: p.placeholder || null,
    targets: [selected.value?.key], target: selected.value?.key, rules: [], sort_order: fields.value.length,
  })
  if (error) { toast.add({ severity: 'error', summary: 'Failed', detail: error.message, life: 4000 }); return }
  toast.add({ severity: 'success', summary: `Field "${p.label}" added`, life: 2000 })
  fields.value = await resolveFields(orgId.value!)
}

watch(orgId, load, { immediate: true })
</script>

<template>
  <div class="p-3 sm:p-6 min-h-full flex flex-col">
    <div class="flex flex-col md:flex-row gap-4 md:gap-6 flex-1 min-h-0">
      <ProtoNav />
      <div class="flex-1 min-w-0">
        <div class="mb-4">
          <h1 class="text-xl font-semibold text-gray-900">Teams &amp; organisations</h1>
          <p class="text-sm text-gray-500">Entities that group people — teams, businesses, schools, families. Same fields/layout tools, plus who's in them.</p>
        </div>

        <div v-if="loading" class="text-sm text-gray-400">Loading…</div>

        <div v-else class="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-5">
          <!-- type list -->
          <div class="card p-0 overflow-hidden h-fit">
            <div class="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
              <span class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Entity types</span>
              <button class="text-xs text-primary hover:underline" @click="adding = !adding">+ New</button>
            </div>
            <div v-if="adding" class="p-3 border-b border-gray-100 flex gap-2">
              <InputText v-model="newLabel" placeholder="e.g. Team" class="flex-1" size="small" @keyup.enter="addType" />
              <Button label="Add" size="small" @click="addType" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
            </div>
            <div v-if="!types.length && !adding" class="px-4 py-3 text-xs text-gray-400">No entity types yet — add one (Team, Business…).</div>
            <button v-for="t in types" :key="t.key" type="button"
              class="w-full text-left px-4 py-2.5 text-sm border-b border-gray-50 hover:bg-gray-50 transition-colors flex items-center justify-between gap-2"
              :class="t.key === selectedKey ? 'bg-gray-50 font-medium text-primary' : 'text-gray-700'"
              @click="selectedKey = t.key">
              <span class="truncate">{{ t.label }}</span>
              <span v-if="t.inherited" class="text-[9px] uppercase tracking-wide shrink-0 text-blue-400" v-tooltip.left="'Inherited from ' + t.ownerName">NSO</span>
            </button>
          </div>

          <!-- editor -->
          <div v-if="selected" class="space-y-3">
            <div v-if="selected.inherited" class="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2 text-xs text-blue-800">
              <i class="pi pi-lock mr-1" />Inherited from {{ selected.ownerName }} (read-only).
            </div>

            <div class="flex gap-1 border-b border-gray-200">
              <button v-for="tb in (['layout','fields','members','reports'] as const)" :key="tb"
                class="px-3 py-2 text-sm font-medium border-b-2 -mb-px capitalize transition-colors"
                :class="tab === tb ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'"
                @click="tab = tb">{{ tb }}</button>
            </div>

            <!-- FIELDS -->
            <div v-show="tab === 'fields'" class="space-y-3">
              <div class="card p-0 overflow-hidden">
                <div class="px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fields on a {{ selected.label }}</div>
                <div v-if="!applicableFields.length" class="px-4 py-3 text-sm text-gray-400">No fields yet.</div>
                <button v-for="f in applicableFields" :key="f.id" type="button"
                  class="w-full text-left px-4 py-2 border-b border-gray-50 flex items-center justify-between text-sm hover:bg-gray-50 transition-colors"
                  :class="editingField?.id === f.id ? 'bg-gray-50' : ''" @click="editingField = f">
                  <span class="flex items-center gap-1.5 text-gray-800">
                    <i v-if="f.inherited" class="pi pi-lock text-[10px] text-blue-400" />{{ f.label }}
                  </span>
                  <span class="flex items-center gap-2">
                    <span class="text-[11px] text-gray-400">{{ f.field_type }}</span>
                    <span v-if="f.inherited" class="text-[9px] uppercase tracking-wide text-blue-400">NSO</span>
                    <i v-else class="pi pi-pencil text-[10px] text-gray-300" />
                  </span>
                </button>
              </div>
              <ProtoFieldEditor v-if="editingField" :key="editingField.id" :field="editingField"
                @saved="onFieldChanged" @deleted="onFieldChanged" @close="editingField = null" />
              <FieldCreator v-else :person-types="fieldTargetOptions" @add="addField" />
            </div>

            <!-- LAYOUT -->
            <div v-show="tab === 'layout'">
              <PersonFormBuilder :key="selected.key" :target="selected.key" :target-label="selected.label" :org-id="orgId!" entity />
            </div>

            <!-- MEMBERS -->
            <div v-show="tab === 'members'" class="space-y-3">
              <p class="text-xs text-gray-500">A {{ selected.label }} is made up of these people — pick the type, how many, and the role each gets.</p>
              <div class="card p-0 overflow-hidden">
                <div class="hidden sm:grid grid-cols-[1fr_90px_90px_1fr_32px] gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                  <span>People type</span><span>Min</span><span>Max</span><span>Default role</span><span></span>
                </div>
                <div v-for="(s, i) in selected.member_slots" :key="i" class="grid grid-cols-2 sm:grid-cols-[1fr_90px_90px_1fr_32px] gap-2 px-4 py-2.5 border-b border-gray-50 items-center">
                  <Select v-model="s.person_type" :options="personTypeOptions" optionLabel="label" optionValue="value" class="w-full" size="small" :disabled="selected.inherited" />
                  <InputNumber v-model="s.min" :min="0" class="w-full" size="small" :disabled="selected.inherited" inputClass="w-full" />
                  <InputNumber v-model="s.max" :min="0" class="w-full" size="small" :disabled="selected.inherited" inputClass="w-full" placeholder="∞" />
                  <InputText v-model="s.role" placeholder="e.g. Player" class="w-full" size="small" :disabled="selected.inherited" />
                  <button v-if="!selected.inherited" class="w-7 h-7 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50" @click="removeSlot(i)"><i class="pi pi-trash text-xs" /></button>
                </div>
                <div v-if="!selected.member_slots.length" class="px-4 py-3 text-sm text-gray-400">No member slots yet.</div>
              </div>
              <div v-if="!selected.inherited" class="flex items-center justify-between">
                <button class="text-sm font-medium text-primary hover:underline" @click="addSlot"><i class="pi pi-plus text-xs mr-1" />Add member slot</button>
                <Button label="Save members" size="small" :loading="saving" @click="saveMembers" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
              </div>
            </div>

            <!-- REPORTS (stub) -->
            <div v-show="tab === 'reports'" class="card p-6 text-center text-sm text-gray-400">
              Reports for {{ selected.label }} records. <span class="block text-xs mt-1">(Prototype placeholder.)</span>
            </div>

            <div v-if="!selected.inherited" class="pt-1">
              <button class="text-sm text-red-600 hover:underline" @click="removeType(selected)">Delete this type</button>
            </div>
          </div>
          <div v-else class="card p-8 text-center text-gray-400 text-sm">Select an entity type, or add one.</div>
        </div>
        <Toast />
      </div>
    </div>
  </div>
</template>
