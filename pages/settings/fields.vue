<!--
  Field library + rules + person types. Fields are first-class, assigned to a
  "person type" (who they capture data about — Member / Parent / Coach / …), and
  carry conditional rules. Person types are configurable with min/max counts and
  inherit down the org hierarchy. So a child sub-form can ask for an address
  while the parent's doesn't.
-->
<script setup lang="ts">
const db = useDb()
const { orgId } = useOrg()
const toast = useToast()
const { resolveFields, resolvePersonTypes } = useOrgFieldPolicy()
const { ancestors } = useOrgHierarchy()

const TYPE_LABEL: Record<string, string> = {
  text: 'Short Text', textarea: 'Long Text', email: 'Email', phone: 'Phone',
  number: 'Number', date: 'Date', select: 'Dropdown', checkbox: 'Checkbox',
}
const fieldTypes = Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))
const SUBJECTS = [
  { label: 'Discipline', value: 'discipline' }, { label: 'Registrant age', value: 'age' },
  { label: 'Gender', value: 'gender' }, { label: 'Another field', value: 'field' },
]
const OPS: Record<string, { label: string; value: string }[]> = {
  discipline: [{ label: 'is', value: 'is' }, { label: 'is not', value: 'is_not' }],
  age: [{ label: 'is under', value: 'lt' }, { label: 'is at most', value: 'lte' }, { label: 'is over', value: 'gt' }, { label: 'is at least', value: 'gte' }],
  gender: [{ label: 'is', value: 'is' }, { label: 'is not', value: 'is_not' }],
  field: [{ label: 'is filled in', value: 'is_set' }, { label: 'is', value: 'is' }, { label: 'is not', value: 'is_not' }],
}
const GENDERS = ['MALE', 'FEMALE', 'NON_BINARY']

const tab = ref<'existing' | 'new' | 'types'>('existing')
const own = ref<any[]>([])
const inherited = ref<any[]>([])
const disciplines = ref<{ id: string; label: string }[]>([])
const personTypes = ref<any[]>([])
const loading = ref(true)
const editing = ref<any | null>(null)

const ownTypes = computed(() => personTypes.value.filter(t => !t.inherited))
const inheritedTypes = computed(() => personTypes.value.filter(t => t.inherited))
const typeByKey = computed(() => Object.fromEntries(personTypes.value.map(t => [t.key, t])))
const targetOptions = computed(() => personTypes.value.map(t => ({ key: t.key, label: t.label })))
// own fields grouped by person type (for the "different fields per person" view)
const ownByType = computed(() => personTypes.value.map(t => ({ type: t, fields: own.value.filter(f => (f.target || 'member') === t.key) }))
  .concat(own.value.some(f => !typeByKey.value[f.target || 'member']) ? [{ type: { key: '_', label: 'Unassigned', min_count: 0, max_count: null }, fields: own.value.filter(f => !typeByKey.value[f.target || 'member']) }] : []))

async function load() {
  loading.value = true
  const [all, pts] = await Promise.all([resolveFields(orgId.value as string), resolvePersonTypes(orgId.value as string)])
  const norm = (f: any) => ({ ...f, target: (f.target || 'member').toLowerCase() })
  own.value = all.filter((f: any) => !f.inherited).map(norm)
  inherited.value = all.filter((f: any) => f.inherited).map(norm)
  personTypes.value = pts
  const anc = await ancestors(orgId.value as string)
  const ids = [orgId.value, ...anc.map(a => a.id)]
  const { data: discs } = await (db.from as any)('disciplines').select('id, name, sport').in('org_id', ids).order('name')
  disciplines.value = (discs ?? []).map((x: any) => ({ id: x.id, label: x.sport ? `${x.name} (${x.sport})` : x.name }))
  loading.value = false
}

async function addField(p: any) {
  const { error } = await (db.from as any)('field_definitions').insert({
    org_id: orgId.value, label: p.label, field_type: p.type, is_required: p.required,
    options: p.options, help_text: p.placeholder || null, target: p.target || 'member', rules: [], sort_order: own.value.length,
  })
  if (error) { toast.add({ severity: 'error', summary: 'Failed', detail: error.message, life: 4000 }); return }
  toast.add({ severity: 'success', summary: `Field "${p.label}" created`, life: 2000 })
  tab.value = 'existing'; await load()
}

function startEdit(f: any) {
  editing.value = { id: f.id, label: f.label, field_type: f.field_type, is_required: f.is_required, target: f.target || 'member', optionsText: (f.options || []).join('\n'), rules: JSON.parse(JSON.stringify(f.rules || [])) }
}
function addRule() { editing.value.rules.push({ subject: 'discipline', op: 'is', value: null, value2: '' }) }
function onSubject(r: any) { r.op = OPS[r.subject][0].value; r.value = r.subject === 'age' ? 16 : null; r.value2 = '' }
const fieldOptions = computed(() => [...own.value, ...inherited.value].filter(f => !editing.value || f.id !== editing.value.id).map(f => ({ id: f.id, label: f.label })))

async function saveEdit() {
  const e = editing.value
  if (!e.label.trim()) return
  const { error } = await (db.from as any)('field_definitions').update({
    label: e.label.trim(), field_type: e.field_type, is_required: e.is_required, target: e.target,
    options: e.field_type === 'select' ? e.optionsText.split('\n').map((s: string) => s.trim()).filter(Boolean) : [],
    rules: e.rules.filter((r: any) => r.value !== null && r.value !== '' && r.value !== undefined),
  }).eq('id', e.id)
  if (error) { toast.add({ severity: 'error', summary: 'Save failed', detail: error.message, life: 6000 }); return }
  toast.add({ severity: 'success', summary: 'Field saved', life: 2000 })
  editing.value = null; await load()
}
async function removeField(id: string) { await (db.from as any)('field_definitions').delete().eq('id', id); editing.value = null; await load() }

// ── Person types ──
function slugify(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') }
const newType = reactive({ label: '', min_count: 0, max_count: null as number | null })
async function addPersonType() {
  if (!newType.label.trim()) return
  const { error } = await (db.from as any)('person_target_types').insert({
    org_id: orgId.value, key: slugify(newType.label) || 'type_' + Date.now(), label: newType.label.trim(),
    min_count: newType.min_count ?? 0, max_count: newType.max_count, sort_order: ownTypes.value.length,
  })
  if (error) { toast.add({ severity: 'error', summary: 'Failed', detail: error.message, life: 4000 }); return }
  newType.label = ''; newType.min_count = 0; newType.max_count = null
  await load()
}
async function savePersonType(t: any) {
  await (db.from as any)('person_target_types').update({ label: t.label, min_count: t.min_count ?? 0, max_count: t.max_count }).eq('id', t.id)
  toast.add({ severity: 'success', summary: 'Saved', life: 1500 })
}
async function removePersonType(id: string) { await (db.from as any)('person_target_types').delete().eq('id', id); await load() }

watch(orgId, () => { if (orgId.value) load() }, { immediate: true })
</script>

<template>
  <div class="p-6 max-w-3xl mx-auto">
    <div class="mb-4">
      <h1 class="text-xl font-semibold text-gray-900">Fields</h1>
      <p class="text-sm text-gray-500">Fields are captured per person type (member, parent, coach…), each with its own required-when rules. A field can apply to the child but not the parent.</p>
    </div>

    <!-- EDIT a field -->
    <div v-if="editing" class="card p-5 space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-semibold text-gray-700">Edit field</h2>
        <button class="text-xs text-gray-400 hover:text-gray-600" @click="editing = null"><i class="pi pi-times" /></button>
      </div>
      <div class="grid grid-cols-3 gap-3">
        <div class="flex flex-col gap-1.5"><label class="text-xs font-medium text-gray-600">Label</label><InputText v-model="editing.label" /></div>
        <div class="flex flex-col gap-1.5"><label class="text-xs font-medium text-gray-600">Capturing about</label><Select v-model="editing.target" :options="targetOptions" option-label="label" option-value="key" class="w-full" /></div>
        <div class="flex items-end"><label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" v-model="editing.is_required" class="w-4 h-4 accent-[#1E2157]" /><span class="text-sm">Always required</span></label></div>
      </div>
      <div>
        <label class="text-xs font-medium text-gray-600">Type</label>
        <div class="grid grid-cols-4 gap-1.5 mt-1">
          <button v-for="ft in fieldTypes" :key="ft.value" type="button" class="px-2 py-1.5 rounded-lg border text-xs font-semibold"
            :class="editing.field_type === ft.value ? 'bg-[#1E2157] border-[#1E2157] text-white' : 'border-gray-200 text-gray-700 hover:bg-gray-50'"
            @click="editing.field_type = ft.value">{{ ft.label }}</button>
        </div>
      </div>
      <div v-if="editing.field_type === 'select'" class="flex flex-col gap-1.5">
        <label class="text-xs font-medium text-gray-600">Dropdown options (one per line)</label>
        <textarea v-model="editing.optionsText" rows="3" class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#1E2157]" />
      </div>
      <div class="border-t border-gray-100 pt-3">
        <p class="text-xs font-semibold text-gray-600 mb-1">Also required when <span class="text-gray-400 font-normal">(any of these match)</span></p>
        <div v-for="(r, i) in editing.rules" :key="i" class="flex items-center gap-2 mb-2">
          <Select v-model="r.subject" :options="SUBJECTS" option-label="label" option-value="value" class="w-40" @update:modelValue="onSubject(r)" />
          <Select v-model="r.op" :options="OPS[r.subject]" option-label="label" option-value="value" class="w-32" />
          <Select v-if="r.subject === 'discipline'" v-model="r.value" :options="disciplines" option-label="label" option-value="id" filter placeholder="discipline" class="flex-1" />
          <Select v-else-if="r.subject === 'gender'" v-model="r.value" :options="GENDERS" placeholder="gender" class="flex-1" />
          <template v-else-if="r.subject === 'field'">
            <Select v-model="r.value" :options="fieldOptions" option-label="label" option-value="id" filter placeholder="field" class="flex-1" />
            <InputText v-if="r.op === 'is' || r.op === 'is_not'" v-model="r.value2" placeholder="value" class="w-28" />
          </template>
          <InputNumber v-else v-model="r.value" :min="0" :max="120" class="w-24" />
          <button class="text-gray-300 hover:text-red-500" @click="editing.rules.splice(i, 1)"><i class="pi pi-trash text-xs" /></button>
        </div>
        <button class="text-xs text-[#1E2157] hover:underline" @click="addRule"><i class="pi pi-plus text-[10px] mr-1" />Add rule</button>
      </div>
      <div class="flex items-center justify-between border-t border-gray-100 pt-3">
        <button class="text-sm text-red-600 hover:underline" @click="removeField(editing.id)">Delete field</button>
        <Button label="Save" style="background:#1E2157;border-color:#1E2157" @click="saveEdit" />
      </div>
    </div>

    <!-- LIST -->
    <div v-else class="card p-0 overflow-hidden">
      <div class="grid grid-cols-3 border-b border-gray-100">
        <button type="button" class="py-3 text-sm font-semibold" :class="tab === 'existing' ? 'text-[#1E2157] border-b-2 border-[#1E2157]' : 'text-gray-400 hover:text-gray-600'" @click="tab = 'existing'">Existing Fields</button>
        <button type="button" class="py-3 text-sm font-semibold" :class="tab === 'new' ? 'text-[#1E2157] border-b-2 border-[#1E2157]' : 'text-gray-400 hover:text-gray-600'" @click="tab = 'new'">Create New</button>
        <button type="button" class="py-3 text-sm font-semibold" :class="tab === 'types' ? 'text-[#1E2157] border-b-2 border-[#1E2157]' : 'text-gray-400 hover:text-gray-600'" @click="tab = 'types'">Person Types</button>
      </div>

      <!-- Existing: grouped by person type -->
      <div v-if="tab === 'existing'" class="p-4 space-y-4">
        <div v-if="inherited.length">
          <p class="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-2"><i class="pi pi-lock mr-1" />Inherited from governing bodies</p>
          <div class="space-y-1.5">
            <div v-for="f in inherited" :key="f.id" class="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50/60 border border-blue-100 text-sm">
              <span class="font-medium text-gray-800">{{ f.label }}</span>
              <span v-if="f.is_required" class="text-red-500">*</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-white text-gray-500">{{ typeByKey[f.target]?.label || f.target }}</span>
              <span class="flex-1" /><span class="text-[10px] text-blue-500">{{ f.ownerName }}</span>
            </div>
          </div>
        </div>
        <div v-if="loading" class="text-sm text-gray-400">Loading…</div>
        <div v-else v-for="grp in ownByType" :key="grp.type.key">
          <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
            {{ grp.type.label }}
            <span class="text-gray-300 normal-case font-normal">min {{ grp.type.min_count }} · max {{ grp.type.max_count ?? '∞' }}</span>
          </p>
          <div v-if="!grp.fields.length" class="text-xs text-gray-300 italic mb-2 pl-1">No fields.</div>
          <div v-else class="space-y-1.5 mb-3">
            <button v-for="f in grp.fields" :key="f.id" type="button" class="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-150 hover:bg-gray-50 hover:border-gray-300 text-sm text-left" @click="startEdit(f)">
              <span class="font-medium text-gray-800">{{ f.label }}</span>
              <span v-if="f.is_required" class="text-red-500">*</span>
              <span v-if="(f.rules || []).length" class="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">{{ f.rules.length }} rule(s)</span>
              <span class="text-[10px] text-gray-400">{{ TYPE_LABEL[f.field_type] || f.field_type }}</span>
              <span class="flex-1" /><i class="pi pi-pencil text-xs text-gray-300" />
            </button>
          </div>
        </div>
      </div>

      <!-- Create -->
      <FieldCreator v-else-if="tab === 'new'" :person-types="targetOptions" @add="addField" />

      <!-- Person types -->
      <div v-else class="p-4 space-y-3">
        <p class="text-xs text-gray-500">Who a registration captures, and how many of each. Inherited types come from your governing bodies.</p>
        <div v-if="inheritedTypes.length" class="space-y-1.5">
          <div v-for="t in inheritedTypes" :key="t.id" class="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50/60 border border-blue-100 text-sm">
            <span class="font-medium text-gray-800">{{ t.label }}</span>
            <span class="text-[10px] text-gray-500">min {{ t.min_count }} · max {{ t.max_count ?? '∞' }}</span>
            <span class="flex-1" /><span class="text-[10px] text-blue-500">{{ t.ownerName }} (inherited)</span>
          </div>
        </div>
        <div v-for="t in ownTypes" :key="t.id" class="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-150 text-sm">
          <InputText v-model="t.label" class="flex-1" @blur="savePersonType(t)" />
          <span class="text-xs text-gray-400">min</span><InputNumber v-model="t.min_count" :min="0" class="w-16" @update:modelValue="savePersonType(t)" />
          <span class="text-xs text-gray-400">max</span><InputNumber v-model="t.max_count" :min="0" placeholder="∞" class="w-16" @update:modelValue="savePersonType(t)" />
          <button class="text-gray-300 hover:text-red-500" @click="removePersonType(t.id)"><i class="pi pi-trash text-xs" /></button>
        </div>
        <div class="flex items-center gap-2 border-t border-gray-100 pt-3">
          <InputText v-model="newType.label" placeholder="New person type e.g. Coach" class="flex-1" />
          <span class="text-xs text-gray-400">min</span><InputNumber v-model="newType.min_count" :min="0" class="w-16" />
          <span class="text-xs text-gray-400">max</span><InputNumber v-model="newType.max_count" :min="0" placeholder="∞" class="w-16" />
          <Button label="Add" style="background:#1E2157;border-color:#1E2157" @click="addPersonType" />
        </div>
      </div>
    </div>
  </div>
</template>
