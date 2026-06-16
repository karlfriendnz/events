<template>
  <!--
    Form-driven contact / question fields. When `formId` is set, loads the
    matching `registration_forms` + `form_fields` rows and renders each
    field according to its type. When `formId` is null, renders a small
    default set (first/last name, email, phone) so flows that don't
    bother configuring a form still work.

    The component owns its answers state and emits/v-models the merged
    object keyed by field id. Parents that need named values use
    `coreValues()` (exposed via defineExpose) to pull out first_name /
    last_name / email / phone in one go.
  -->
  <div class="space-y-4">
    <div v-if="loading" class="text-xs text-gray-400 py-2">Loading form…</div>

    <div v-else class="grid grid-cols-2 gap-4">
      <div v-for="f in visibleFields" :key="f.id"
        class="flex flex-col gap-1.5"
        :class="(f._col_span ?? 2) === 1 ? 'col-span-1' : 'col-span-2'">
        <label class="text-sm font-medium text-gray-700">
          {{ f.label }}
          <span v-if="f.is_required" class="text-red-400">*</span>
        </label>

        <input v-if="['SHORT_TEXT','NUMBER','DATE'].includes(f.field_type)"
          v-model="answers[f.id]"
          :type="f.field_type === 'NUMBER' ? 'number' : f.field_type === 'DATE' ? 'date' : (f._core === 'email' ? 'email' : f._core === 'phone' ? 'tel' : 'text')"
          :placeholder="f.placeholder ?? ''"
          class="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2157]/30 focus:border-[#1E2157]" />

        <textarea v-else-if="f.field_type === 'LONG_TEXT'"
          v-model="answers[f.id]" rows="3" :placeholder="f.placeholder ?? ''"
          class="rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1E2157]/30 focus:border-[#1E2157]" />

        <select v-else-if="f.field_type === 'SINGLE_SELECT'"
          v-model="answers[f.id]"
          class="h-9 rounded-lg border border-gray-300 px-3 text-sm">
          <option value="">—</option>
          <option v-for="opt in f._options" :key="opt" :value="opt">{{ opt }}</option>
        </select>

        <label v-else-if="f.field_type === 'TOGGLE'" class="flex items-center gap-2 text-sm">
          <input type="checkbox" v-model="answers[f.id]" class="rounded border-gray-300" />
          {{ f.placeholder || 'Yes' }}
        </label>

        <input v-else-if="f.field_type === 'FILE'" type="file"
          @change="(e: any) => answers[f.id] = e.target.files?.[0]?.name ?? ''"
          class="text-sm" />

        <p v-if="f.help_text" class="text-xs text-gray-400">{{ f.help_text }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  /** The activity mode's form_id (or null when none configured). */
  formId?: string | null
  /** Pre-fill values keyed by core name (first_name, last_name, email, phone, attendees, notes). */
  prefill?: Partial<Record<string, string | number | null>>
  /** Core names to hide from the rendered form. Use this to suppress
   *  optional fields like `attendees` when the parent's context (mode
   *  capacity, selected add-ons) makes them irrelevant. */
  hideCores?: string[]
  /** When set, prepend the org's inherited + own field_definitions (the field
   *  engine) to the form — so NSO-required fields are collected + enforced. */
  orgFieldsOrgId?: string | null
}>(), {
  formId: null,
  prefill: () => ({}),
  hideCores: () => [],
  orgFieldsOrgId: null,
})
const emit = defineEmits<{
  /** Fires whenever any answer changes — payload is the answers object
   *  keyed by field id, plus a `coreValues` extract. */
  (e: 'change', payload: { answers: Record<string, any>; coreValues: Record<string, any>; isValid: boolean }): void
}>()

const db = useDb()

// Map known labels to a canonical "core" key so parents can pull out
// first_name / email / phone regardless of whether the user's form is
// custom or the default fallback.
const CORE_BY_LABEL: Record<string, string> = {
  'First Name': 'first_name', 'Last Name': 'last_name', 'Email Address': 'email',
  'Phone Number': 'phone', 'People Attending': 'attendees', 'Notes': 'notes',
}

interface RenderField {
  id: string
  label: string
  field_type: string
  is_required?: boolean
  placeholder?: string | null
  help_text?: string | null
  _options: string[]
  _core: string | null
  _col_span: number
  _has_visibility_conditions: boolean
  _visibility_conditions: any[]
}

const loading = ref(false)
const loadedFields = ref<RenderField[]>([])

// Default fallback when no form_id is configured. Ids use a `__core_`
// prefix so they don't collide with real field ids and match the
// wizard's existing fallback shape (downstream code that maps core →
// field id keeps working without per-flow special cases).
const defaultFields = computed<RenderField[]>(() => [
  { id: '__core_first_name', label: 'First Name',    field_type: 'SHORT_TEXT', is_required: true,  placeholder: 'John',           _options: [], _core: 'first_name', _col_span: 1, _has_visibility_conditions: false, _visibility_conditions: [] },
  { id: '__core_last_name',  label: 'Last Name',     field_type: 'SHORT_TEXT', is_required: true,  placeholder: 'Smith',          _options: [], _core: 'last_name',  _col_span: 1, _has_visibility_conditions: false, _visibility_conditions: [] },
  { id: '__core_email',      label: 'Email Address', field_type: 'SHORT_TEXT', is_required: true,  placeholder: 'you@example.com', _options: [], _core: 'email',      _col_span: 2, _has_visibility_conditions: false, _visibility_conditions: [] },
  { id: '__core_phone',      label: 'Phone Number',  field_type: 'SHORT_TEXT', is_required: false, placeholder: '+64…',           _options: [], _core: 'phone',      _col_span: 2, _has_visibility_conditions: false, _visibility_conditions: [] },
  { id: '__core_attendees',  label: 'People Attending', field_type: 'NUMBER',  is_required: false, placeholder: '1',              _options: [], _core: 'attendees',  _col_span: 1, _has_visibility_conditions: false, _visibility_conditions: [] },
  { id: '__core_notes',      label: 'Notes',         field_type: 'LONG_TEXT', is_required: false, placeholder: '',                _options: [], _core: 'notes',      _col_span: 2, _has_visibility_conditions: false, _visibility_conditions: [] },
])

// Field engine — inherited + own org field_definitions, injected at the top.
const { resolveFields } = useOrgFieldPolicy()
const orgFields = ref<RenderField[]>([])
const FT_MAP: Record<string, string> = {
  text: 'SHORT_TEXT', textarea: 'LONG_TEXT', email: 'SHORT_TEXT', phone: 'SHORT_TEXT',
  number: 'NUMBER', date: 'DATE', select: 'SINGLE_SELECT', checkbox: 'TOGGLE',
}
watch(() => props.orgFieldsOrgId, async (oid) => {
  orgFields.value = []
  if (!oid) return
  const defs = await resolveFields(oid)
  orgFields.value = defs.map((d): RenderField => ({
    id: 'orgfield_' + d.id, label: d.label, field_type: FT_MAP[d.field_type] || 'SHORT_TEXT',
    is_required: d.is_required, placeholder: d.help_text, help_text: d.help_text,
    _options: d.options || [], _core: null, _col_span: 2,
    _has_visibility_conditions: false, _visibility_conditions: [],
  }))
  applyPrefill()
}, { immediate: true })

const fields = computed(() => [...orgFields.value, ...(loadedFields.value.length ? loadedFields.value : defaultFields.value)])

// Answers state. Key: field id; Value: typed answer.
const answers = reactive<Record<string, any>>({})

watch(() => props.formId, async (formId) => {
  loadedFields.value = []
  if (!formId) { applyPrefill(); return }
  loading.value = true
  try {
    const [{ data: ff }, { data: rf }] = await Promise.all([
      (db.from as any)('form_fields').select('*').eq('form_id', formId).order('sort_order'),
      (db.from as any)('registration_forms').select('config').eq('id', formId).single(),
    ])
    const cfg = (rf?.config as any) ?? {}
    const fieldMeta = cfg.fieldMeta ?? {}
    loadedFields.value = (ff ?? []).map((f: any): RenderField => {
      let opts: string[] = []
      try { opts = JSON.parse(f.options || '[]') } catch { opts = [] }
      const meta = fieldMeta[f.label] ?? {}
      return {
        id: f.id,
        label: f.label,
        field_type: f.field_type,
        is_required: f.is_required,
        placeholder: f.placeholder,
        help_text: f.help_text,
        _options: opts,
        _core: meta.core ?? CORE_BY_LABEL[f.label] ?? null,
        _col_span: meta.col_span ?? 2,
        _has_visibility_conditions: !!meta.has_visibility_conditions,
        _visibility_conditions: meta.visibility_conditions ?? [],
      }
    })
    applyPrefill()
  } finally {
    loading.value = false
  }
}, { immediate: true })

watch(() => props.prefill, () => applyPrefill(), { deep: true })

function applyPrefill() {
  // Drop existing answers + repopulate so a form-id swap doesn't keep
  // stale ids alive on the answers map.
  for (const k of Object.keys(answers)) delete answers[k]
  for (const f of fields.value) {
    const fromPrefill = f._core ? props.prefill?.[f._core] : null
    answers[f.id] = fromPrefill ?? (f.field_type === 'TOGGLE' ? false : '')
  }
}

// ── Visibility conditions ────────────────────────────────────────────────
function valuesByLabel() {
  const m: Record<string, any> = {}
  for (const f of fields.value) m[f.label] = answers[f.id]
  return m
}
function evalCondition(cond: any, vbl: Record<string, any>): boolean {
  const v = vbl[cond.field]
  const compare = (cond.value ?? '').toString().toLowerCase()
  const cur = (v == null ? '' : String(v)).toLowerCase()
  switch (cond.operator) {
    case 'Equals':       return cur === compare
    case 'Is Not':       return cur !== compare
    case 'Contains':     return cur.includes(compare)
    case 'Is Empty':     return cur === ''
    case 'Is Not Empty': return cur !== ''
    default:             return true
  }
}
function isFieldVisible(f: RenderField): boolean {
  // Parent-driven hide list trumps everything else — used by the wizard
  // to suppress `attendees` when the mode + selected addons don't make
  // headcount relevant.
  if (f._core && props.hideCores?.includes(f._core)) return false
  if (!f._has_visibility_conditions) return true
  const vbl = valuesByLabel()
  return (f._visibility_conditions ?? []).every(c => evalCondition(c, vbl))
}
const visibleFields = computed(() => fields.value.filter(isFieldVisible))

// ── Core extract ─────────────────────────────────────────────────────────
function coreValues(): Record<string, any> {
  const out: Record<string, any> = {}
  for (const f of fields.value) {
    if (f._core) out[f._core] = answers[f.id]
  }
  return out
}

const isValid = computed(() => {
  for (const f of visibleFields.value) {
    if (!f.is_required) continue
    const v = answers[f.id]
    if (v === '' || v == null) return false
  }
  return true
})

// Bubble every change up so parents can sync their booking state.
watch([() => ({ ...answers }), visibleFields], () => {
  emit('change', { answers: { ...answers }, coreValues: coreValues(), isValid: isValid.value })
}, { deep: true })

defineExpose({
  /** Used by the parent at submit time to read the named values. */
  coreValues,
  /** Used by the parent to disable the Confirm button. */
  isValid: () => isValid.value,
  /** Raw answers map keyed by field id — for parents that want to
   *  persist the full custom-form payload alongside the booking. */
  rawAnswers: () => ({ ...answers }),
})
</script>
