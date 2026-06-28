<!--
  PersonFormBuilder — the reusable per-person-type form builder.
  Model: field_definitions is the field LIBRARY (core + inherited(NSO) + own, per
  target); this edits the FORM LAYOUT for one person type, stored on
  profile_forms (org_id, type_key) as { fields: FormField[] } — the same FormField
  shape the events builder uses. You drag core / inherited / org fields into the
  canvas (and sections), reorder, and set per-field visibility conditions (shared
  <FormFieldAdvancedEditor>). Events that include this subject type can seed their
  form from this layout (follow-up). "Add new field" also creates a
  field_definition so the field is in the library + available in events.

  Props: target (person-type key), targetLabel, orgId. Emits: back.
-->
<script setup lang="ts">
const props = defineProps<{ target: string; targetLabel: string; orgId: string; entity?: boolean }>()
const emit = defineEmits<{ (e: 'back'): void }>()

const db = useDb()
const toast = useToast()
const { resolveFields, fieldAppliesTo } = useOrgFieldPolicy()
const { uploadFile } = useUpload()
const uploadingImg = ref(false)
async function onImageUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]; if (!file || !editing.value) return
  uploadingImg.value = true
  try {
    const url = await uploadFile(file)
    if (!Array.isArray(editing.value.block)) editing.value.block = []
    editing.value.block[0] = url
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Upload failed', detail: err?.message, life: 4000 })
  } finally { uploadingImg.value = false }
}

const target = computed(() => (props.target || 'member').toLowerCase())

const FIELD_TYPES = [
  { value: 'text', label: 'Short Text' }, { value: 'textarea', label: 'Long Text' },
  { value: 'email', label: 'Email' }, { value: 'phone', label: 'Phone' },
  { value: 'number', label: 'Number' }, { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' }, { value: 'checkbox', label: 'Checkbox' },
  { value: 'color', label: 'Colour' }, { value: 'file', label: 'File Upload' },
]
const TYPE_LABEL = Object.fromEntries(FIELD_TYPES.map(t => [t.value, t.label]))
const BLOCK_TYPES = [
  { type: 'field', label: 'Field', icon: 'pi-list' },
  { type: 'tabs', label: 'Tabs', icon: 'pi-folder' },
  { type: 'section', label: 'Section', icon: 'pi-th-large' },
  { type: 'image', label: 'Image', icon: 'pi-image' },
  { type: 'text-block', label: 'Text', icon: 'pi-align-left' },
  { type: 'button', label: 'Button', icon: 'pi-external-link' },
]
const BLOCK_SET = new Set(['tabs', 'section', 'image', 'text-block', 'button'])
// Tab icons are picked via <IconPicker> (searchable Font Awesome).
// Standard person columns, always available to place on any person form.
const CORE_FIELDS = [
  { core: 'first_name', label: 'First Name', field_type: 'text', placeholder: 'John' },
  { core: 'last_name', label: 'Last Name', field_type: 'text', placeholder: 'Smith' },
  { core: 'role', label: 'User Role', field_type: 'roles', placeholder: '' },
  { core: 'email', label: 'Email', field_type: 'email', placeholder: 'john@example.com' },
  { core: 'phone', label: 'Phone', field_type: 'phone', placeholder: '' },
  { core: 'phone2', label: 'Secondary Phone', field_type: 'phone', placeholder: '' },
  { core: 'dob', label: 'Date of Birth', field_type: 'date', placeholder: '' },
  { core: 'gender', label: 'Gender', field_type: 'select', options: ['Male', 'Female', 'Non-binary', 'Prefer not to say'] },
]
const SYSTEM_FIELDS = [
  { key: 'account', label: 'Create a login', desc: 'Create a login + permission level for this person', icon: 'pi-user-plus', field_type: 'account' },
  { key: 'comms', label: 'Communication', desc: "Subscribe people to your club's comms topics (email/app)", icon: 'pi-megaphone', field_type: 'comms' },
]
// Mandatory on every person profile, grouped into a locked "Personal details"
// section at the top. Locked cores (first/last/role) are pinned (can't move/remove);
// the rest are required-present but can be dragged out of the section.
const REQUIRED_CORES = ['first_name', 'last_name', 'role', 'email', 'phone', 'phone2', 'dob', 'gender']
const LOCKED_CORES = ['first_name', 'last_name', 'role']
const CORE_SECTION_NAME = '__core_section'
const COMMS_SECTION_NAME = '__comms_section'
function isRequiredField(f: any) {
  return (f?.core && REQUIRED_CORES.includes(f.core)) || f?.field_type === 'comms'
    || f?.system_name === CORE_SECTION_NAME || f?.system_name === COMMS_SECTION_NAME
}
function isLockedField(f: any) { return f?.core && LOCKED_CORES.includes(f.core) }

interface LField {
  _key: string; label: string; field_type: string; is_required: boolean
  options: string[]; placeholder: string; system_name: string; col_span: 1 | 2; block: string[]
  def_id?: string | null; core?: string | null; inherited?: boolean
  has_visibility_conditions?: boolean; visibility_conditions?: any[]
  has_financial_increase?: boolean; financial_rules?: any[]
  tab_id?: string | null; tabs?: { id: string; label: string }[]
}
const activeTabId = ref('')

const loading = ref(true)
const saving = ref(false)
const layout = ref<LField[]>([])
const libDefs = ref<any[]>([]) // field_definitions for this target (own + inherited)
const search = ref('')
const editingKey = ref<string | null>(null)
const editing = computed(() => layout.value.find(f => f._key === editingKey.value) || null)
const advancedOpen = ref(false)

async function load() {
  loading.value = true
  const [{ data: pf }, all] = await Promise.all([
    (db.from as any)('profile_forms').select('config').eq('org_id', props.orgId).eq('type_key', target.value).maybeSingle(),
    resolveFields(props.orgId),
  ])
  libDefs.value = all.filter((f: any) => fieldAppliesTo(f, target.value))
  const cfg = pf?.config?.fields
  layout.value = Array.isArray(cfg) ? cfg.map((f: any) => ({ ...f, _key: f._key || crypto.randomUUID() })) : []
  // Entities (Team / Company / Club / Group …) are not people — no person default layout.
  if (!props.entity) ensureRequired()
  loading.value = false
}

function makeSection(label: string, system_name = '', col_span: 1 | 2 = 2, placeholder = ''): LField {
  return { _key: crypto.randomUUID(), label, field_type: 'section', is_required: false, options: [], placeholder, system_name, col_span, block: [], tab_id: null }
}
// Email / Phone / Secondary Phone span the full row of their section.
const FULL_WIDTH_CORES = ['email', 'phone', 'phone2']
function seedCore(core: string): LField {
  const c = CORE_FIELDS.find(x => x.core === core)!
  const optional = core === 'dob' || core === 'gender' || core === 'phone2'
  return { _key: crypto.randomUUID(), label: c.label, field_type: c.field_type, is_required: !optional, options: (c as any).options ?? [], placeholder: (c as any).placeholder ?? '', system_name: core, col_span: FULL_WIDTH_CORES.includes(core) ? 2 : 1, block: [], core, tab_id: null }
}
function seedComms(): LField {
  return { _key: crypto.randomUUID(), label: 'Communication', field_type: 'comms', is_required: false, options: [], placeholder: '', system_name: 'comms', col_span: 2, block: [], tab_id: null }
}

// Guarantee the mandatory fields, grouped into two locked sections at the top:
//   Personal details — First/Last/User Role (pinned) + DOB + Gender
//   Communication    — Email, Phone, Communication preferences
// Reconstructs the leading mandatory blocks deterministically (reusing existing
// field objects so their keys/customisations persist), leaving the rest after.
const PERSONAL_CORES = ['first_name', 'last_name', 'role', 'dob', 'gender']
const COMMS_CORES = ['email', 'phone', 'phone2']
function ensureRequired() {
  const byCore = new Map(layout.value.filter(f => f.core).map(f => [f.core, f]))
  const commsField = layout.value.find(f => f.field_type === 'comms')
  const coreSec = layout.value.find(f => f.field_type === 'section' && f.system_name === CORE_SECTION_NAME)
  const commsSec = layout.value.find(f => f.field_type === 'section' && f.system_name === COMMS_SECTION_NAME)

  const personal = [
    coreSec ?? makeSection('Personal details', CORE_SECTION_NAME, 1, 'The person’s name, role and basic details.'),
    ...PERSONAL_CORES.map(c => byCore.get(c) ?? seedCore(c)),
  ]
  const communication = [
    commsSec ?? makeSection('Communication', COMMS_SECTION_NAME, 1, 'How we get in touch and what they receive.'),
    ...COMMS_CORES.map(c => byCore.get(c) ?? seedCore(c)),
    commsField ?? seedComms(),
  ]
  const usedKeys = new Set([...personal, ...communication].map(f => f._key))
  const rest = layout.value.filter(f => !usedKeys.has(f._key))
  const boundary = (rest.length && rest[0].field_type !== 'section') ? [makeSection('Additional details')] : []
  const next = [...personal, ...communication, ...boundary, ...rest]

  // Avoid a no-op reassign (and the save it would trigger) when already in shape.
  if (JSON.stringify(next.map(f => f._key)) !== JSON.stringify(layout.value.map(f => f._key))) layout.value = next
}

let saveTimer: any = null
function scheduleSave() {
  saving.value = true
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    await (db.from as any)('profile_forms').upsert(
      { org_id: props.orgId, type_key: target.value, config: { fields: layout.value }, updated_at: new Date().toISOString() },
      { onConflict: 'org_id,type_key' },
    )
    saving.value = false
  }, 500)
}
watch(layout, scheduleSave, { deep: true })

// Library groups (filtered by search), with "added" detection.
const onLayoutDef = computed(() => new Set(layout.value.map(f => f.def_id).filter(Boolean)))
const onLayoutCore = computed(() => new Set(layout.value.map(f => f.core).filter(Boolean)))
const matches = (label: string) => { const q = search.value.trim().toLowerCase(); return !q || label.toLowerCase().includes(q) }
// Already-placed cores aren't shown in the library — they're always on the form
// and (for the required ones) can't be removed, so there's nothing to "add".
const coreLib = computed(() => props.entity ? [] : CORE_FIELDS.filter(c => matches(c.label) && !onLayoutCore.value.has(c.core)))
const inheritedLib = computed(() => libDefs.value.filter((d: any) => d.inherited && matches(d.label)))
const orgLib = computed(() => libDefs.value.filter((d: any) => !d.inherited && matches(d.label)))

const canvasFields = computed(() => layout.value.map(f => ({
  _key: f._key, field_type: f.field_type, label: f.label, is_required: f.is_required,
  placeholder: f.placeholder, has_placeholder: !!f.placeholder, options: f.options, col_span: f.col_span,
  core: f.core, tab_id: f.tab_id, tabs: f.tabs, block: f.block,
})))
const conditionFieldOptions = computed(() => layout.value.filter(f => f._key !== editingKey.value && !BLOCK_SET.has(f.field_type)).map(f => ({ _key: f._key, label: f.label })))

// New items land in the tab you're currently viewing (null = top level).
function addCore(c: typeof CORE_FIELDS[number]) {
  if (onLayoutCore.value.has(c.core)) return
  layout.value.push({ _key: crypto.randomUUID(), label: c.label, field_type: c.field_type, is_required: c.core !== 'dob', options: (c as any).options ?? [], placeholder: (c as any).placeholder ?? '', system_name: c.core, col_span: 1, block: [], core: c.core, tab_id: activeTabId.value || null })
}
function addDef(d: any) {
  if (onLayoutDef.value.has(d.id)) return
  layout.value.push({ _key: crypto.randomUUID(), label: d.label, field_type: d.field_type || 'text', is_required: !!d.is_required, options: Array.isArray(d.options) ? d.options : [], placeholder: d.meta?.placeholder ?? d.help_text ?? '', system_name: d.key ?? '', col_span: d.meta?.col_span ?? 1, block: d.meta?.block ?? [], def_id: d.id, inherited: !!d.inherited, tab_id: activeTabId.value || null })
  editingKey.value = layout.value[layout.value.length - 1]._key
}
function addBlock(type: string) {
  if (type === 'tabs') {
    layout.value.push({ _key: crypto.randomUUID(), label: 'Tabs', field_type: 'tabs', is_required: false, options: [], placeholder: '', system_name: '', col_span: 2, block: [], tabs: [{ id: crypto.randomUUID(), label: 'Tab 1' }, { id: crypto.randomUUID(), label: 'Tab 2' }] })
    editingKey.value = layout.value[layout.value.length - 1]._key
    return
  }
  const block = type === 'button' ? ['Button', '', 'primary'] : type === 'image' ? ['', '', 'center'] : []
  const label = type === 'section' ? 'Section heading' : type === 'image' ? 'Image' : type === 'text-block' ? 'Text block' : 'Button'
  layout.value.push({ _key: crypto.randomUUID(), label, field_type: type, is_required: false, options: [], placeholder: '', system_name: '', col_span: 2, block, tab_id: activeTabId.value || null })
  editingKey.value = layout.value[layout.value.length - 1]._key
}
// "Add new field" also creates a field_definition (library + events), then places it.
async function addNewField() {
  saving.value = true
  const { data, error } = await (db.from as any)('field_definitions').insert({
    org_id: props.orgId, target: target.value, targets: [target.value], label: 'New field', field_type: 'text',
    is_required: false, options: [], meta: { col_span: 1 }, rules: [], sort_order: libDefs.value.length,
  }).select('*').single()
  saving.value = false
  if (error) { toast.add({ severity: 'error', summary: 'Failed', detail: error.message, life: 4000 }); return }
  await load(); addDef({ ...data, inherited: false })
}
function addTab() {
  const e = editing.value as any; if (!e) return
  if (!Array.isArray(e.tabs)) e.tabs = []
  e.tabs.push({ id: crypto.randomUUID(), label: 'Tab ' + (e.tabs.length + 1) })
}
function removeTab(id: string) {
  const e = editing.value as any; if (!e || !Array.isArray(e.tabs) || e.tabs.length <= 1) return
  e.tabs = e.tabs.filter((t: any) => t.id !== id)
  const firstId = e.tabs[0].id
  for (const f of layout.value as any[]) if (f.tab_id === id) f.tab_id = firstId // re-home orphans
}
async function addSystemField(sf: typeof SYSTEM_FIELDS[number]) {
  if (layout.value.some(f => f.field_type === sf.field_type)) return
  layout.value.push({ _key: crypto.randomUUID(), label: sf.label, field_type: sf.field_type, is_required: false, options: [], placeholder: '', system_name: sf.key, col_span: 2, block: [], tab_id: activeTabId.value || null })
}
function systemAdded(sf: typeof SYSTEM_FIELDS[number]) { return layout.value.some(f => f.field_type === sf.field_type) }

function onDropToken(token: string) {
  if (!token) return
  if (token.startsWith('def:')) { const d = libDefs.value.find((x: any) => x.id === token.slice(4)); if (d) addDef(d); return }
  if (token.startsWith('core:')) { const c = CORE_FIELDS.find(x => x.core === token.slice(5)); if (c) addCore(c); return }
  if (token === 'field') return addNewField()
  // Only genuine palette blocks — ignore stray payloads (e.g. a SortableJS reorder
  // that bubbled a native drop), which previously fell through to a "Button".
  if (['tabs', 'section', 'image', 'text-block', 'button'].includes(token)) addBlock(token)
}
function removeField() {
  const e = editing.value; if (!e) return
  if (isRequiredField(e)) return  // mandatory fields can't be removed
  layout.value = layout.value.filter(f => f._key !== e._key); editingKey.value = null
}
function reorder(next: any[]) {
  const byKey = Object.fromEntries(layout.value.map(f => [f._key, f]))
  layout.value = next.map((c: any) => byKey[c._key]).filter(Boolean)
}
function onOptionsInput(e: LField, text: string) { e.options = text.split('\n').map(s => s.trim()).filter(Boolean) }

// Keep editor's advanced object arrays present for <FormFieldAdvancedEditor>.
watch(editing, (e) => {
  advancedOpen.value = false
  if (e) { if (!Array.isArray(e.visibility_conditions)) e.visibility_conditions = []; if (!Array.isArray(e.financial_rules)) e.financial_rules = [] }
})

watch([() => props.target, () => props.orgId], () => { editingKey.value = null; load() }, { immediate: true })
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between gap-3 mb-4">
      <div class="flex items-center gap-3 min-w-0">
        <button class="text-gray-400 hover:text-gray-700" @click="emit('back')"><i class="pi pi-chevron-left" /></button>
        <div class="min-w-0">
          <h2 class="text-base font-semibold text-gray-900 truncate">{{ targetLabel }}'s form</h2>
          <p class="text-xs text-gray-500 truncate">What you collect about each {{ targetLabel.toLowerCase() }}</p>
        </div>
      </div>
      <span class="text-xs text-gray-400"><i v-if="saving" class="pi pi-spin pi-spinner mr-1" />Saves automatically</span>
    </div>

    <div class="grid grid-cols-[1fr_330px] gap-5 items-start">
      <!-- Canvas: the form layout -->
      <div class="card p-5 min-h-[340px]">
        <div v-if="loading" class="text-sm text-gray-400">Loading…</div>
        <FormFieldCanvas v-else sectioned :model-value="canvasFields" :editing-key="editingKey"
          :pinned-roles="LOCKED_CORES"
          v-model:active-tab="activeTabId"
          empty-text="Drag fields from the panel on the right →"
          @select="k => editingKey = k" @update:model-value="reorder" @drop="onDropToken" />
      </div>

      <!-- Sidebar: library (add) or editor -->
      <div class="card p-4 space-y-4">
        <!-- FIELD / BLOCK EDITOR -->
        <template v-if="editing">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-gray-700">Edit {{ BLOCK_SET.has(editing.field_type) ? 'block' : 'field' }}</h3>
            <button class="text-xs text-gray-400 hover:text-gray-600" @click="editingKey = null"><i class="pi pi-times" /></button>
          </div>
          <p v-if="editing.inherited" class="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5"><i class="pi pi-lock text-xs mr-1" />Inherited field — label/type set by the governing body; you control its placement &amp; visibility here.</p>
          <p v-else-if="editing.core" class="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5">Core person field.</p>

          <div class="flex flex-col gap-1.5"><label class="text-xs font-medium text-gray-600">Label</label><InputText v-model="editing.label" :disabled="editing.inherited" /></div>

          <template v-if="!BLOCK_SET.has(editing.field_type)">
            <div v-if="!editing.core && !editing.inherited" class="flex flex-col gap-1.5"><label class="text-xs font-medium text-gray-600">Name <span class="text-gray-400 font-normal">(reports/export)</span></label><InputText v-model="editing.system_name" placeholder="e.g. national_id" /></div>
            <div class="flex flex-col gap-1.5"><label class="text-xs font-medium text-gray-600">Input type</label>
              <Select v-model="editing.field_type" :options="FIELD_TYPES" option-label="label" option-value="value" class="w-full" :disabled="editing.inherited || !!editing.core" />
            </div>
            <div v-if="editing.field_type === 'select'" class="flex flex-col gap-1.5">
              <label class="text-xs font-medium text-gray-600">Dropdown options (one per line)</label>
              <textarea :value="editing.options.join('\n')" rows="3" class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-primary" @input="e => onOptionsInput(editing!, (e.target as HTMLTextAreaElement).value)" />
            </div>
            <div class="flex flex-col gap-1.5"><label class="text-xs font-medium text-gray-600">Placeholder</label><InputText v-model="editing.placeholder" /></div>
            <div class="flex items-center justify-between">
              <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" v-model="editing.is_required" class="w-4 h-4 accent-primary" /><span class="text-sm">Required</span></label>
              <div class="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                <button type="button" class="px-2 py-1" :class="editing.col_span === 1 ? 'bg-primary text-white' : 'text-gray-500'" @click="editing.col_span = 1">Half</button>
                <button type="button" class="px-2 py-1" :class="editing.col_span === 2 ? 'bg-primary text-white' : 'text-gray-500'" @click="editing.col_span = 2">Full</button>
              </div>
            </div>
          </template>
          <template v-else>
            <div v-if="editing.field_type === 'tabs'" class="flex flex-col gap-2">
              <label class="text-xs font-medium text-gray-600">Tabs <span class="text-gray-400 font-normal">(pick a tab in the canvas, then add fields to it)</span></label>
              <div v-for="(t, i) in (editing.tabs || [])" :key="t.id" class="flex items-center gap-2">
                <div class="w-16 shrink-0"><IconPicker v-model="t.icon" /></div>
                <InputText v-model="t.label" class="flex-1 min-w-0" :placeholder="`Tab ${i + 1}`" />
                <button type="button" class="shrink-0 text-gray-300 hover:text-red-500 disabled:opacity-30 disabled:hover:text-gray-300"
                  :disabled="(editing.tabs || []).length <= 1" @click="removeTab(t.id)"><i class="pi pi-times text-xs" /></button>
              </div>
              <button type="button" class="text-xs text-primary hover:underline self-start inline-flex items-center gap-1" @click="addTab"><i class="pi pi-plus text-xs" />Add tab</button>
            </div>
            <template v-else-if="editing.field_type === 'section'">
              <div class="flex flex-col gap-1.5"><label class="text-xs font-medium text-gray-600">Description</label><Textarea v-model="editing.placeholder" rows="2" autoResize class="w-full" /></div>
              <div class="flex items-center justify-between">
                <label class="text-xs font-medium text-gray-600">Width</label>
                <div class="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                  <button type="button" class="px-2 py-1" :class="editing.col_span === 1 ? 'bg-primary text-white' : 'text-gray-500'" @click="editing.col_span = 1">Half</button>
                  <button type="button" class="px-2 py-1" :class="editing.col_span === 2 ? 'bg-primary text-white' : 'text-gray-500'" @click="editing.col_span = 2">Full</button>
                </div>
              </div>
              <div class="flex flex-col gap-2 border-t border-gray-100 pt-3">
                <label class="text-xs font-medium text-gray-600">Header image <span class="text-gray-400 font-normal">(right side — e.g. an NZC logo)</span></label>
                <div v-if="editing.block && editing.block[0]" class="relative w-fit">
                  <img :src="editing.block[0]" class="h-12 object-contain rounded border border-gray-200" />
                  <button type="button" class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-400 hover:text-red-500" @click="editing.block[0] = ''"><i class="pi pi-times text-xs" /></button>
                </div>
                <label class="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-300 text-xs text-gray-600 hover:border-primary hover:text-primary cursor-pointer transition-colors">
                  <i :class="['pi', uploadingImg ? 'pi-spin pi-spinner' : 'pi-upload', 'text-xs']" />{{ (editing.block && editing.block[0]) ? 'Replace image' : 'Upload image' }}
                  <input type="file" accept="image/*" class="hidden" @change="onImageUpload" />
                </label>
              </div>
            </template>
            <div v-else-if="editing.field_type === 'image'" class="flex flex-col gap-2">
              <label class="text-xs font-medium text-gray-600">Image</label>
              <div v-if="editing.block[0]" class="relative">
                <img :src="editing.block[0]" class="w-full max-h-40 object-contain rounded-lg border border-gray-200" />
                <button type="button" class="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 border border-gray-200 shadow-sm flex items-center justify-center text-gray-400 hover:text-red-500" @click="editing.block[0] = ''"><i class="pi pi-times text-xs" /></button>
              </div>
              <label class="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-300 text-xs text-gray-600 hover:border-primary hover:text-primary cursor-pointer transition-colors">
                <i :class="['pi', uploadingImg ? 'pi-spin pi-spinner' : 'pi-upload', 'text-xs']" />{{ editing.block[0] ? 'Replace image' : 'Upload image' }}
                <input type="file" accept="image/*" class="hidden" @change="onImageUpload" />
              </label>
              <InputText v-model="editing.block[0]" placeholder="…or paste an image URL" class="text-xs" />
            </div>
            <div v-else-if="editing.field_type === 'button'" class="flex flex-col gap-1.5"><label class="text-xs font-medium text-gray-600">Link URL</label><InputText v-model="editing.block[1]" placeholder="https://…" /></div>
          </template>

          <!-- Visibility conditions (+ financial rules) — shared editor -->
          <div v-if="!BLOCK_SET.has(editing.field_type)" class="border-t border-gray-100 pt-2">
            <button type="button" class="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-800" @click="advancedOpen = !advancedOpen">
              <i class="pi pi-sliders-h text-xs" />Visibility &amp; rules
              <i class="pi text-xs" :class="advancedOpen ? 'pi-chevron-down' : 'pi-chevron-right'" />
            </button>
            <div v-show="advancedOpen" class="mt-2">
              <FormFieldAdvancedEditor :field="editing" :condition-field-options="conditionFieldOptions" hide-financial />
            </div>
          </div>

          <div class="flex items-center justify-between border-t border-gray-100 pt-3">
            <span v-if="isRequiredField(editing)" class="text-xs text-gray-400 flex items-center gap-1.5"><i class="pi pi-lock text-xs" />Required on every profile{{ isLockedField(editing) ? ' · fixed position' : '' }}</span>
            <button v-else class="text-sm text-red-600 hover:underline" @click="removeField">Remove from form</button>
            <button class="text-sm text-gray-500 hover:underline" @click="editingKey = null">Done</button>
          </div>
        </template>

        <!-- LIBRARY (add) -->
        <template v-else>
          <div>
            <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Add new</p>
            <div class="grid grid-cols-3 gap-1.5">
              <button v-for="bt in BLOCK_TYPES" :key="bt.type" type="button"
                draggable="true" @dragstart="(e:any) => e.dataTransfer.setData('text/plain', bt.type)"
                class="flex flex-col items-center gap-1 py-2.5 rounded-lg border border-gray-150 hover:border-primary hover:bg-primary/5 text-xs text-gray-600 transition-colors"
                @click="bt.type === 'field' ? addNewField() : addBlock(bt.type)">
                <i :class="['pi', bt.icon, 'text-sm text-gray-400']" />{{ bt.label }}
              </button>
            </div>
          </div>


          <IconField>
            <InputIcon class="pi pi-search" />
            <InputText v-model="search" placeholder="Search fields…" class="w-full" />
          </IconField>

          <!-- Core fields -->
          <div v-if="coreLib.length">
            <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Core fields</p>
            <div class="space-y-1">
              <button v-for="c in coreLib" :key="c.core" type="button" :disabled="onLayoutCore.has(c.core)"
                draggable="true" @dragstart="(e:any) => e.dataTransfer.setData('text/plain', 'core:' + c.core)"
                class="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm text-left transition-colors"
                :class="onLayoutCore.has(c.core) ? 'border-gray-100 bg-gray-50 opacity-60' : 'border-gray-150 hover:border-primary hover:bg-primary/5'"
                @click="addCore(c)">
                <span class="truncate text-gray-800">{{ c.label }}</span>
                <span class="text-xs text-gray-400">{{ TYPE_LABEL[c.field_type] }}</span>
                <span class="flex-1" /><span v-if="onLayoutCore.has(c.core)" class="text-xs text-emerald-500">Added</span><i v-else class="pi pi-plus text-gray-300 text-xs" />
              </button>
            </div>
          </div>

          <!-- Inherited (NSO) fields -->
          <div v-if="inheritedLib.length">
            <p class="text-xs font-bold text-blue-500 uppercase tracking-wide mb-2">Inherited (NSO) fields</p>
            <div class="space-y-1">
              <button v-for="d in inheritedLib" :key="d.id" type="button" :disabled="onLayoutDef.has(d.id)"
                draggable="true" @dragstart="(e:any) => e.dataTransfer.setData('text/plain', 'def:' + d.id)"
                class="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm text-left transition-colors"
                :class="onLayoutDef.has(d.id) ? 'border-blue-100 bg-blue-50/40 opacity-70' : 'border-blue-100 bg-blue-50/40 hover:border-blue-300'">
                <i class="pi pi-lock text-xs text-blue-300" />
                <span class="truncate text-gray-700">{{ d.label }}</span>
                <span v-if="d.is_required" class="text-xs font-bold bg-red-50 text-red-400 rounded px-1 py-0.5">REQ</span>
                <span class="flex-1" /><span v-if="onLayoutDef.has(d.id)" class="text-xs text-emerald-500">Added</span><i v-else class="pi pi-plus text-blue-300 text-xs" @click="addDef(d)" />
              </button>
            </div>
          </div>

          <!-- Organisation fields -->
          <div v-if="orgLib.length">
            <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Organisation fields</p>
            <div class="space-y-1">
              <button v-for="d in orgLib" :key="d.id" type="button" :disabled="onLayoutDef.has(d.id)"
                draggable="true" @dragstart="(e:any) => e.dataTransfer.setData('text/plain', 'def:' + d.id)"
                class="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm text-left transition-colors"
                :class="onLayoutDef.has(d.id) ? 'border-gray-100 bg-gray-50 opacity-60' : 'border-gray-150 hover:border-primary hover:bg-primary/5'"
                @click="addDef(d)">
                <span class="truncate text-gray-800">{{ d.label }}</span>
                <span class="text-xs text-gray-400">{{ TYPE_LABEL[d.field_type] || d.field_type }}</span>
                <span class="flex-1" /><span v-if="onLayoutDef.has(d.id)" class="text-xs text-emerald-500">Added</span><i v-else class="pi pi-plus text-gray-300 text-xs" />
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
