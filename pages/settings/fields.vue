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
const { resolveFields, resolvePersonTypes, fieldAppliesTo } = useOrgFieldPolicy()
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

const view = ref<'types' | 'matrix'>('types')
const creating = ref(false)
const own = ref<any[]>([])
const inherited = ref<any[]>([])
const disciplines = ref<{ id: string; label: string }[]>([])
const personTypes = ref<any[]>([])
const loading = ref(true)
const editing = ref<any | null>(null)
// When set, the full per-person-type form builder takes over the page.
const builderTarget = ref<{ key: string; label: string; kind?: string } | null>(null)
function openBuilder(t: any) { builderTarget.value = { key: t.key, label: t.label, kind: t.kind } }
function closeBuilder() { builderTarget.value = null; load() }

const ownTypes = computed(() => personTypes.value.filter(t => !t.inherited))
const inheritedTypes = computed(() => personTypes.value.filter(t => t.inherited))
const typeByKey = computed(() => Object.fromEntries(personTypes.value.map(t => [t.key, t])))
const targetOptions = computed(() => personTypes.value.map(t => ({ key: t.key, label: t.label })))
// Fields grouped by person type — inherited AND own fields together, so an
// inherited field lands in the same section as its person type (e.g. an inherited
// "National Cricket ID" sits under Member, not in a separate top-of-page block).
const fieldsByType = computed(() => {
  const groups = personTypes.value.map(t => ({
    type: t,
    // A shared field appears under EVERY type it targets.
    inherited: inherited.value.filter(f => fieldAppliesTo(f, t.key)),
    own: own.value.filter(f => fieldAppliesTo(f, t.key)),
  }))
  // Catch-all for fields that apply to no known person type.
  const matchesAny = (f: any) => personTypes.value.some(t => fieldAppliesTo(f, t.key))
  const orphInh = inherited.value.filter(f => !matchesAny(f))
  const orphOwn = own.value.filter(f => !matchesAny(f))
  if (orphInh.length || orphOwn.length) groups.push({ type: { key: '_', label: 'Unassigned', min_count: 0, max_count: null }, inherited: orphInh, own: orphOwn })
  return groups
})

// Accordion open/closed state per person-type section (default: open).
const openTypes = ref<Record<string, boolean>>({})
function typeOpen(key: string) { return key in openTypes.value ? openTypes.value[key] : true }
function toggleType(key: string) { openTypes.value = { ...openTypes.value, [key]: !typeOpen(key) } }

async function load() {
  loading.value = true
  const [all, pts] = await Promise.all([resolveFields(orgId.value as string), resolvePersonTypes(orgId.value as string)])
  // Effective targets — always ≥1 (falls back to the legacy single `target`), so
  // the matrix checkboxes are authoritative.
  const norm = (f: any) => ({ ...f, target: (f.target || 'member').toLowerCase(), targets: (Array.isArray(f.targets) && f.targets.length ? f.targets : [f.target || 'member']).map((t: string) => (t || '').toLowerCase()) })
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
    options: p.options, help_text: p.placeholder || null,
    targets: (p.targets?.length ? p.targets : [p.target || 'member']),
    target: (p.targets?.length ? p.targets[0] : (p.target || 'member')),
    rules: [], sort_order: own.value.length,
  })
  if (error) { toast.add({ severity: 'error', summary: 'Failed', detail: error.message, life: 4000 }); return }
  toast.add({ severity: 'success', summary: `Field "${p.label}" created`, life: 2000 })
  creating.value = false; await load()
}

// Matrix: all fields (own + inherited) as rows; all person types as columns.
const allFields = computed(() => [...own.value, ...inherited.value])
function hasType(f: any, key: string) { return (f.targets || []).includes(key) }
async function toggleFieldType(f: any, key: string, on: boolean) {
  if (f.inherited) return  // governing-body fields are locked
  const set = new Set<string>(f.targets || [])
  on ? set.add(key) : set.delete(key)
  const targets = [...set]
  f.targets = targets
  await (db.from as any)('field_definitions').update({ targets, target: targets[0] ?? null }).eq('id', f.id)
}

function startEdit(f: any) {
  editing.value = { id: f.id, label: f.label, field_type: f.field_type, is_required: f.is_required, targets: (f.targets?.length ? [...f.targets] : [f.target || 'member']), optionsText: (f.options || []).join('\n'), rules: JSON.parse(JSON.stringify(f.rules || [])) }
}
function addRule() { editing.value.rules.push({ subject: 'discipline', op: 'is', value: null, value2: '' }) }
function onSubject(r: any) { r.op = OPS[r.subject][0].value; r.value = r.subject === 'age' ? 16 : null; r.value2 = '' }
const fieldOptions = computed(() => [...own.value, ...inherited.value].filter(f => !editing.value || f.id !== editing.value.id).map(f => ({ id: f.id, label: f.label })))

async function saveEdit() {
  const e = editing.value
  if (!e.label.trim()) return
  const { error } = await (db.from as any)('field_definitions').update({
    label: e.label.trim(), field_type: e.field_type, is_required: e.is_required,
    targets: (e.targets?.length ? e.targets : ['member']),
    target: (e.targets?.length ? e.targets[0] : 'member'),
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
const newType = reactive({ label: '', kind: 'person' as 'person' | 'entity', min_count: 0, max_count: null as number | null })
const KIND_OPTIONS = [{ label: 'Person', value: 'person' }, { label: 'Entity (team, club…)', value: 'entity' }]
async function addPersonType() {
  if (!newType.label.trim()) return
  const { error } = await (db.from as any)('person_target_types').insert({
    org_id: orgId.value, key: slugify(newType.label) || 'type_' + Date.now(), label: newType.label.trim(),
    kind: newType.kind, min_count: newType.min_count ?? 0, max_count: newType.max_count, sort_order: ownTypes.value.length,
  })
  if (error) { toast.add({ severity: 'error', summary: 'Failed', detail: error.message, life: 4000 }); return }
  newType.label = ''; newType.kind = 'person'; newType.min_count = 0; newType.max_count = null
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
  <div class="p-3 sm:p-6 min-h-full flex flex-col">
    <div class="flex flex-col md:flex-row gap-4 md:gap-6 flex-1 min-h-0">
      <!-- Hide the settings menu while the form designer is open, for full width -->
      <SettingsNav v-if="!builderTarget" />
      <div class="flex-1 min-w-0 settings-fill">
        <PersonFormBuilder v-if="builderTarget" :target="builderTarget.key" :target-label="builderTarget.label" :entity="builderTarget.kind === 'entity'" :org-id="(orgId as string)" @back="closeBuilder" />
        <div v-else class="space-y-4">
    <!-- Header -->
    <div class="flex items-start justify-between gap-3 flex-wrap">
      <div>
        <h1 class="text-xl font-semibold text-gray-900">Person types &amp; fields</h1>
        <p class="text-sm text-gray-500">The kinds of people and entities you register. Configure each one’s form, or view all fields across types.</p>
      </div>
      <Button :label="view === 'matrix' ? 'Person types' : 'All fields'" :icon="view === 'matrix' ? 'pi pi-users' : 'pi pi-table'" severity="secondary" outlined size="small" @click="view = view === 'matrix' ? 'types' : 'matrix'" />
    </div>

    <!-- EDIT a field -->
    <div v-if="editing" class="card p-5 space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-semibold text-gray-700">Edit field</h2>
        <button class="text-xs text-gray-400 hover:text-gray-600" @click="editing = null"><i class="pi pi-times" /></button>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div class="flex flex-col gap-1.5"><label class="text-xs font-medium text-gray-600">Label</label><InputText v-model="editing.label" /></div>
        <div class="flex flex-col gap-1.5"><label class="text-xs font-medium text-gray-600">Capturing about</label><MultiSelect v-model="editing.targets" :options="targetOptions" option-label="label" option-value="key" display="chip" placeholder="Pick one or more types" class="w-full" /></div>
        <div class="flex items-end"><label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" v-model="editing.is_required" class="w-4 h-4 accent-primary" /><span class="text-sm">Always required</span></label></div>
      </div>
      <div>
        <label class="text-xs font-medium text-gray-600">Type</label>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-1">
          <button v-for="ft in fieldTypes" :key="ft.value" type="button" class="px-2 py-1.5 rounded-lg border text-xs font-semibold"
            :class="editing.field_type === ft.value ? 'bg-primary border-primary text-white' : 'border-gray-200 text-gray-700 hover:bg-gray-50'"
            @click="editing.field_type = ft.value">{{ ft.label }}</button>
        </div>
      </div>
      <div v-if="editing.field_type === 'select'" class="flex flex-col gap-1.5">
        <label class="text-xs font-medium text-gray-600">Dropdown options (one per line)</label>
        <textarea v-model="editing.optionsText" rows="3" class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-primary" />
      </div>
      <div class="border-t border-gray-100 pt-3">
        <p class="text-xs font-semibold text-gray-600 mb-1">Also required when <span class="text-gray-400 font-normal">(any of these match)</span></p>
        <div v-for="(r, i) in editing.rules" :key="i" class="flex flex-wrap items-center gap-2 mb-2">
          <Select v-model="r.subject" :options="SUBJECTS" option-label="label" option-value="value" class="w-full sm:w-40" @update:modelValue="onSubject(r)" />
          <Select v-model="r.op" :options="OPS[r.subject]" option-label="label" option-value="value" class="w-full sm:w-32" />
          <Select v-if="r.subject === 'discipline'" v-model="r.value" :options="disciplines" option-label="label" option-value="id" filter placeholder="discipline" class="flex-1" />
          <Select v-else-if="r.subject === 'gender'" v-model="r.value" :options="GENDERS" placeholder="gender" class="flex-1" />
          <template v-else-if="r.subject === 'field'">
            <Select v-model="r.value" :options="fieldOptions" option-label="label" option-value="id" filter placeholder="field" class="flex-1" />
            <InputText v-if="r.op === 'is' || r.op === 'is_not'" v-model="r.value2" placeholder="value" class="w-full sm:w-28" />
          </template>
          <InputNumber v-else v-model="r.value" :min="0" :max="120" class="w-full sm:w-24" />
          <button class="text-gray-300 hover:text-red-500" @click="editing.rules.splice(i, 1)"><i class="pi pi-trash text-xs" /></button>
        </div>
        <button class="text-xs text-primary hover:underline" @click="addRule"><i class="pi pi-plus text-[10px] mr-1" />Add rule</button>
      </div>
      <div class="flex items-center justify-between border-t border-gray-100 pt-3">
        <button class="text-sm text-red-600 hover:underline" @click="removeField(editing.id)">Delete field</button>
        <Button label="Save" style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="saveEdit" />
      </div>
    </div>

    <!-- PERSON TYPES (default view) — cards -->
    <div v-else-if="view === 'types'" class="space-y-3">
      <p class="text-xs text-gray-500">Who/what a registration captures. Inherited types come from your governing bodies. <span class="text-gray-400">How many of each is set per-form in the form builder.</span></p>
      <div v-if="loading" class="text-sm text-gray-400">Loading…</div>
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <!-- Inherited (locked) -->
        <div v-for="t in inheritedTypes" :key="t.id" class="card p-4 bg-blue-50/40 border-blue-100 flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <i class="pi pi-lock text-blue-400 shrink-0" />
            <span class="font-semibold text-gray-800 truncate">{{ t.label }}</span>
            <span class="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 capitalize shrink-0">{{ t.kind || 'person' }}</span>
          </div>
          <p class="text-xs text-blue-500">{{ t.ownerName }} · inherited</p>
          <button class="mt-auto text-xs font-medium text-primary hover:underline text-left" @click="openBuilder(t)">Configure form →</button>
        </div>
        <!-- Own (editable) -->
        <div v-for="t in ownTypes" :key="t.id" class="card p-4 flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <i class="pi text-gray-400 shrink-0" :class="t.kind === 'entity' ? 'pi-building' : 'pi-user'" />
            <InputText v-model="t.label" class="flex-1 !text-sm !font-semibold" @blur="savePersonType(t)" />
            <button class="text-gray-300 hover:text-red-500 shrink-0" title="Delete type" @click="removePersonType(t.id)"><i class="pi pi-trash text-xs" /></button>
          </div>
          <span class="text-[10px] text-gray-400 capitalize">{{ t.kind || 'person' }}</span>
          <button class="mt-auto text-xs font-medium text-primary hover:underline text-left" @click="openBuilder(t)">Configure form →</button>
        </div>
        <!-- Add a new type (dashed card) -->
        <div class="rounded-xl border-2 border-dashed border-gray-200 p-4 flex flex-col gap-2">
          <p class="text-xs font-semibold text-gray-500 flex items-center gap-1.5"><i class="pi pi-plus text-[10px]" />New type</p>
          <InputText v-model="newType.label" placeholder="e.g. Coach, Team" class="w-full" @keyup.enter="addPersonType" />
          <Select v-model="newType.kind" :options="KIND_OPTIONS" option-label="label" option-value="value" class="w-full" />
          <Button label="Add type" icon="pi pi-plus" size="small" class="mt-auto w-full justify-center" style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="addPersonType" />
        </div>
      </div>
    </div>

    <!-- ALL FIELDS — matrix of fields (rows) × person types (columns) -->
    <div v-else class="card p-0 overflow-hidden">
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span class="text-sm font-semibold text-gray-700">Tick which fields apply to each type</span>
        <Button :label="creating ? 'Close' : 'New field'" :icon="creating ? 'pi pi-times' : 'pi pi-plus'" severity="secondary" outlined size="small" @click="creating = !creating" />
      </div>
      <FieldCreator v-if="creating" :person-types="targetOptions" @add="addField" />
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="border-b border-gray-100">
              <th class="sticky left-0 bg-white z-10 text-left font-semibold text-gray-500 text-xs uppercase tracking-wide px-4 py-2.5 min-w-[13rem]">Field</th>
              <th v-for="t in personTypes" :key="t.key" class="px-2 py-2.5 text-center">
                <span class="text-xs font-semibold text-gray-600 whitespace-nowrap">{{ t.label }}</span>
                <span v-if="t.inherited" class="block text-[10px] text-blue-400 font-normal">inherited</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="f in allFields" :key="f.id" class="border-b border-gray-50">
              <td class="sticky left-0 bg-white z-10 px-4 py-2">
                <button type="button" class="flex items-center gap-1.5 text-left" :disabled="f.inherited" @click="!f.inherited && startEdit(f)">
                  <i v-if="f.inherited" class="pi pi-lock text-[10px] text-blue-400 shrink-0" />
                  <span class="font-medium text-gray-800">{{ f.label }}</span>
                  <span class="text-[10px] text-gray-400">{{ TYPE_LABEL[f.field_type] || f.field_type }}</span>
                  <i v-if="!f.inherited" class="pi pi-pencil text-[10px] text-gray-300" />
                </button>
              </td>
              <td v-for="t in personTypes" :key="t.key" class="px-2 py-2 text-center">
                <Checkbox :modelValue="hasType(f, t.key)" :binary="true" :disabled="f.inherited" @update:modelValue="v => toggleFieldType(f, t.key, v)" />
              </td>
            </tr>
            <tr v-if="!loading && !allFields.length"><td :colspan="personTypes.length + 1" class="px-4 py-6 text-center text-sm text-gray-400">No fields yet — add one with “New field”.</td></tr>
          </tbody>
        </table>
      </div>
    </div>
        </div>
      </div>
    </div>
  </div>
</template>
