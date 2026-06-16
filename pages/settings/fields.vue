<!--
  Field library + rules engine. Fields are first-class (created separately), and
  each field can carry RULES that make it required only in some cases (e.g.
  required when discipline = Premier, or when the registrant is under 16). A
  field can therefore be required in some contexts and optional in others.
-->
<script setup lang="ts">
const db = useDb()
const { orgId } = useOrg()
const { resolveFields } = useOrgFieldPolicy()
const { ancestors } = useOrgHierarchy()
const toast = useToast()

const TYPE_LABEL: Record<string, string> = {
  text: 'Short Text', textarea: 'Long Text', email: 'Email', phone: 'Phone',
  number: 'Number', date: 'Date', select: 'Dropdown', checkbox: 'Checkbox',
}
const fieldTypes = Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))
const SUBJECTS = [
  { label: 'Discipline', value: 'discipline' },
  { label: 'Registrant age', value: 'age' },
  { label: 'Gender', value: 'gender' },
]
const OPS: Record<string, { label: string; value: string }[]> = {
  discipline: [{ label: 'is', value: 'is' }, { label: 'is not', value: 'is_not' }],
  age: [{ label: 'is under', value: 'lt' }, { label: 'is at most', value: 'lte' }, { label: 'is over', value: 'gt' }, { label: 'is at least', value: 'gte' }],
  gender: [{ label: 'is', value: 'is' }, { label: 'is not', value: 'is_not' }],
}
const GENDERS = ['MALE', 'FEMALE', 'NON_BINARY']

const tab = ref<'existing' | 'new'>('existing')
const own = ref<any[]>([])
const inherited = ref<any[]>([])
const disciplines = ref<{ id: string; label: string }[]>([])
const loading = ref(true)
const editing = ref<any | null>(null)

async function load() {
  loading.value = true
  const all = await resolveFields(orgId.value as string)
  own.value = all.filter(f => !f.inherited)
  inherited.value = all.filter(f => f.inherited)
  const anc = await ancestors(orgId.value as string)
  const ids = [orgId.value, ...anc.map(a => a.id)]
  const { data: discs } = await (db.from as any)('disciplines').select('id, name, sport').in('org_id', ids).order('name')
  disciplines.value = (discs ?? []).map((x: any) => ({ id: x.id, label: x.sport ? `${x.name} (${x.sport})` : x.name }))
  loading.value = false
}

async function addField(p: { label: string; type: string; placeholder: string; required: boolean; options: string[] }) {
  const { error } = await (db.from as any)('field_definitions').insert({
    org_id: orgId.value, label: p.label, field_type: p.type, is_required: p.required,
    options: p.options, help_text: p.placeholder || null, rules: [], sort_order: own.value.length,
  })
  if (error) { toast.add({ severity: 'error', summary: 'Failed', detail: error.message, life: 4000 }); return }
  toast.add({ severity: 'success', summary: `Field "${p.label}" created`, life: 2000 })
  tab.value = 'existing'; await load()
}

function startEdit(f: any) {
  editing.value = {
    id: f.id, label: f.label, field_type: f.field_type, is_required: f.is_required,
    optionsText: (f.options || []).join('\n'),
    rules: JSON.parse(JSON.stringify(f.rules || [])),
  }
}
function addRule() { editing.value.rules.push({ subject: 'discipline', op: 'is', value: null }) }
function onSubject(r: any) { r.op = OPS[r.subject][0].value; r.value = r.subject === 'age' ? 16 : null }

async function saveEdit() {
  const e = editing.value
  if (!e.label.trim()) return
  await (db.from as any)('field_definitions').update({
    label: e.label.trim(), field_type: e.field_type, is_required: e.is_required,
    options: e.field_type === 'select' ? e.optionsText.split('\n').map((s: string) => s.trim()).filter(Boolean) : [],
    rules: e.rules.filter((r: any) => r.value !== null && r.value !== ''),
  }).eq('id', e.id)
  toast.add({ severity: 'success', summary: 'Field saved', life: 2000 })
  editing.value = null; await load()
}
async function removeField(id: string) {
  await (db.from as any)('field_definitions').delete().eq('id', id)
  editing.value = null; await load()
}

watch(orgId, () => { if (orgId.value) load() }, { immediate: true })
</script>

<template>
  <div class="p-6 max-w-3xl mx-auto">
    <div class="mb-4">
      <h1 class="text-xl font-semibold text-gray-900">Fields</h1>
      <p class="text-sm text-gray-500">Reusable fields with a rules engine — a field can be required in some cases and optional in others.</p>
    </div>

    <!-- EDIT a field -->
    <div v-if="editing" class="card p-5 space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-semibold text-gray-700">Edit field</h2>
        <button class="text-xs text-gray-400 hover:text-gray-600" @click="editing = null"><i class="pi pi-times" /></button>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div class="flex flex-col gap-1.5"><label class="text-xs font-medium text-gray-600">Label</label><InputText v-model="editing.label" /></div>
        <div class="flex items-end"><label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" v-model="editing.is_required" class="w-4 h-4 accent-[#1E2157]" /><span class="text-sm">Always required</span></label></div>
      </div>
      <div>
        <label class="text-xs font-medium text-gray-600">Type</label>
        <div class="grid grid-cols-4 gap-1.5 mt-1">
          <button v-for="ft in fieldTypes" :key="ft.value" type="button"
            class="px-2 py-1.5 rounded-lg border text-xs font-semibold"
            :class="editing.field_type === ft.value ? 'bg-[#1E2157] border-[#1E2157] text-white' : 'border-gray-200 text-gray-700 hover:bg-gray-50'"
            @click="editing.field_type = ft.value">{{ ft.label }}</button>
        </div>
      </div>
      <div v-if="editing.field_type === 'select'" class="flex flex-col gap-1.5">
        <label class="text-xs font-medium text-gray-600">Dropdown options (one per line)</label>
        <textarea v-model="editing.optionsText" rows="3" class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#1E2157]" />
      </div>

      <!-- RULES -->
      <div class="border-t border-gray-100 pt-3">
        <p class="text-xs font-semibold text-gray-600 mb-1">Also required when <span class="text-gray-400 font-normal">(any of these match)</span></p>
        <div v-for="(r, i) in editing.rules" :key="i" class="flex items-center gap-2 mb-2">
          <Select v-model="r.subject" :options="SUBJECTS" option-label="label" option-value="value" class="w-40" @update:modelValue="onSubject(r)" />
          <Select v-model="r.op" :options="OPS[r.subject]" option-label="label" option-value="value" class="w-32" />
          <Select v-if="r.subject === 'discipline'" v-model="r.value" :options="disciplines" option-label="label" option-value="id" filter placeholder="discipline" class="flex-1" />
          <Select v-else-if="r.subject === 'gender'" v-model="r.value" :options="GENDERS" placeholder="gender" class="flex-1" />
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
      <div class="grid grid-cols-2 border-b border-gray-100">
        <button type="button" class="py-3 text-sm font-semibold" :class="tab === 'existing' ? 'text-[#1E2157] border-b-2 border-[#1E2157]' : 'text-gray-400 hover:text-gray-600'" @click="tab = 'existing'">Existing Fields</button>
        <button type="button" class="py-3 text-sm font-semibold" :class="tab === 'new' ? 'text-[#1E2157] border-b-2 border-[#1E2157]' : 'text-gray-400 hover:text-gray-600'" @click="tab = 'new'">Create New</button>
      </div>

      <div v-if="tab === 'existing'" class="p-4 space-y-4">
        <div v-if="inherited.length">
          <p class="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-2"><i class="pi pi-lock mr-1" />Inherited from governing bodies</p>
          <div class="space-y-1.5">
            <div v-for="f in inherited" :key="f.id" class="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50/60 border border-blue-100 text-sm">
              <span class="font-medium text-gray-800">{{ f.label }}</span>
              <span v-if="f.is_required" class="text-red-500">*</span>
              <span v-if="(f.rules||[]).length" class="text-[10px] text-amber-600">{{ f.rules.length }} rule(s)</span>
              <span class="text-[10px] text-gray-400">{{ TYPE_LABEL[f.field_type] || f.field_type }}</span>
              <span class="flex-1" /><span class="text-[10px] text-blue-500">{{ f.ownerName }}</span>
            </div>
          </div>
        </div>
        <div>
          <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">This organisation's fields</p>
          <div v-if="loading" class="text-sm text-gray-400">Loading…</div>
          <div v-else-if="!own.length" class="text-sm text-gray-400 italic py-2">No fields yet — create one.</div>
          <div v-else class="space-y-1.5">
            <button v-for="f in own" :key="f.id" type="button"
              class="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-150 hover:bg-gray-50 hover:border-gray-300 text-sm text-left"
              @click="startEdit(f)">
              <span class="font-medium text-gray-800">{{ f.label }}</span>
              <span v-if="f.is_required" class="text-red-500">*</span>
              <span v-if="(f.rules||[]).length" class="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">{{ f.rules.length }} rule(s)</span>
              <span class="text-[10px] text-gray-400">{{ TYPE_LABEL[f.field_type] || f.field_type }}</span>
              <span class="flex-1" /><i class="pi pi-pencil text-xs text-gray-300" />
            </button>
          </div>
        </div>
      </div>

      <FieldCreator v-else @add="addField" />
    </div>
  </div>
</template>
