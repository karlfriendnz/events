<!--
  Discipline wizard — how a governing body creates or edits a discipline.

  Replaces a single slide-out that crammed name / code / parent / applies-to /
  requirements into one scroll. The requirements list was the problem: "Gender =
  Male" and "School Is Not Empty" sat in one undifferentiated pile despite saying
  completely different things, so nobody could tell what a discipline meant by
  reading it.

  Steps:
    1 The discipline    — what it's called, where it sits (shows the resulting path)
    2 What it requires  — ONE rule list
    3 Where it applies  — Events / Groups / Competitions
    4 Review            — everything, including what it inherits and what it shadows

  This was briefly two rule steps ("Who it's for" / "What to record"), which read as
  duplication — same picker, same operators, same row, differing only by a word. The
  distinction is real (the club's flag says "she shouldn't be in Male" vs "chase her
  for her school") but the OPERATOR already carries it: a presence test means chase
  them, a value test means they don't belong. So `purpose` (268) is DERIVED from how
  the rule is phrased and stored, rather than asked for on a screen of its own.

  Uses the shared <WizardShell> — the standing rule is that any stepped modal uses
  that chrome rather than a hand-rolled one.
-->
<script setup lang="ts">
import type { PersonFieldDef } from '~/composables/usePersonFields'
import type { DisciplineRequirement, ReqEntry, ReqOperator, ReqPurpose } from '~/composables/useDisciplineRequirements'

interface Disc {
  id: string; org_id: string; name: string; code: string | null; parent_id: string | null
  sort_order?: number; applies_to?: string[] | null; depth?: number
}

const props = defineProps<{
  /** Null = creating. */
  editing: Disc | null
  /** Preselected parent when adding a child. */
  parentId?: string | null
  disciplines: Disc[]
  allReqs: DisciplineRequirement[]
  catalogue: PersonFieldDef[]
  orgName: string
  parts: { label: string; value: string }[]
  /** THIS body's own person types, for per-rule scoping ("juniors' players need
   *  an ID, juniors' coaches need a certificate"). A club's type LINKS to ours
   *  (mig 272), so naming our own keys here resolves across the club's label. */
  personTypes: { key: string; label: string }[]
}>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved'): void
  /** A field invented mid-wizard — the page owns the catalogue, so it adds it. */
  (e: 'field-created', f: PersonFieldDef): void
}>()

const db = useDb()
const { orgId } = useOrg()
const toast = useToast()
const dr = useDisciplineRequirements()

const STEPS = [
  { key: 'about', label: 'The discipline' },
  { key: 'rules', label: 'What it requires' },
  { key: 'where', label: 'Where it applies' },
  { key: 'review', label: 'Review' },
]
const step = ref(0)
const saving = ref(false)

// ── Form ────────────────────────────────────────────────────────────────────
// applies_to = OUR person-type keys ([] = everyone in the discipline). Juniors'
// players and juniors' coaches are not asked for the same things, and until this
// was authorable every rule silently meant "everyone on the roster".
interface DraftReq { key: string; field_key: string; operator: ReqOperator; value: any; exempt: boolean; message: string; applies_to: string[] }
const form = reactive<{ name: string; code: string; parent_id: string | null; applies_to: string[]; reqs: DraftReq[] }>({
  name: '', code: '', parent_id: null, applies_to: [], reqs: [],
})

const newDraft = (field_key = ''): DraftReq => ({
  key: Math.random().toString(36).slice(2), field_key,
  operator: 'Is Not Empty', value: null, exempt: false, message: '', applies_to: [],
})
function toggleReqType(r: DraftReq, key: string) {
  const has = r.applies_to.includes(key)
  r.applies_to = has ? r.applies_to.filter(k => k !== key) : [...r.applies_to, key]
}

onMounted(() => {
  if (props.editing) {
    const d = props.editing
    form.name = d.name; form.code = d.code ?? ''; form.parent_id = d.parent_id
    form.applies_to = [...(d.applies_to ?? [])]
    // applies_to MUST round-trip: dropping it here and writing [] back on finish
    // silently un-scoped every rule the moment anyone edited the discipline.
    form.reqs = props.allReqs.filter(r => r.discipline_id === d.id).sort((a, b) => a.sort_order - b.sort_order)
      .map(r => ({ key: r.id, field_key: r.field_key, operator: r.operator, value: r.value, exempt: r.exempt, message: r.message ?? '', applies_to: [...(r.applies_to ?? [])] }))
  } else {
    form.parent_id = props.parentId ?? null
  }
})

// ── Fields ──────────────────────────────────────────────────────────────────
const fieldOf = (key: string) => props.catalogue.find(f => f.key === key)
const fieldLabel = (key: string) => fieldOf(key)?.label ?? key
const coreFields = computed(() => props.catalogue.filter(f => f.source === 'core'))
const customFields = computed(() => props.catalogue.filter(f => f.source === 'custom'))

// Gender is stored uppercase (the persons CHECK), so the picker must offer the
// STORED values — free text here is how someone types "female" and never matches.
const GENDER_VALUES = ['MALE', 'FEMALE', 'NON_BINARY', 'UNSPECIFIED']
const valueOptionsFor = (key: string) => key === 'gender' ? GENDER_VALUES : (fieldOf(key)?.options?.length ? fieldOf(key)!.options! : null)
const isNumericField = (key: string) => key === 'age' || fieldOf(key)?.field_type === 'number'

// Numeric phrasings only where they can fire — "School must be at most 15" is a
// rule that never does anything.
const optionsFor = (r: DraftReq) => REQUIREMENT_OPTIONS.filter(o => !o.numeric || isNumericField(r.field_key))
function setOperator(r: DraftReq, label: string) {
  const opt = REQUIREMENT_OPTIONS.find(o => o.label === label)!
  r.exempt = opt.exempt
  if (opt.operator) r.operator = opt.operator
  r.value = opt.exempt || VALUELESS_OPERATORS.includes(r.operator) ? null
    : RANGE_OPERATORS.includes(r.operator) ? [null, null] : null
}
function onFieldChange(r: DraftReq) {
  // Switching to a non-numeric field must drop a numeric phrasing the picker no
  // longer offers, or the row keeps a rule you can't see or change.
  if (NUMERIC_OPERATORS.includes(r.operator) && !isNumericField(r.field_key)) setOperator(r, 'must be recorded')
}
const operatorLabel = (r: DraftReq) => optionFor(r).label
const showsValue = (r: DraftReq) => !r.exempt && !VALUELESS_OPERATORS.includes(r.operator)
const showsRange = (r: DraftReq) => !r.exempt && RANGE_OPERATORS.includes(r.operator)
function setRange(r: DraftReq, i: 0 | 1, v: any) {
  const pair = Array.isArray(r.value) ? [...r.value] : [null, null]
  pair[i] = v === '' || v == null ? null : Number(v)
  r.value = pair
}
function addReq(field_key = '') { form.reqs.push(newDraft(field_key)) }
const removeReq = (r: DraftReq) => { form.reqs = form.reqs.filter(x => x.key !== r.key) }

// ── Create a field without leaving ──────────────────────────────────────────
// "School" won't exist the first time someone writes a rule about it, and being
// told to go to Settings, make it, come back and start the wizard again is how a
// good idea gets abandoned. <FieldCreator> already emits a field rather than
// saving one, so the wizard just decides where it lands.
const creatingFor = ref<DraftReq | null>(null)
const creatingField = ref(false)
function openCreateField(r: DraftReq) { creatingFor.value = r; creatingField.value = true }
/** Create a field from the step itself — no row needed first. A governing body
 *  writing its first data rule has no fields yet, so "make one" has to be visible
 *  on the step, not buried at the bottom of a dropdown you only reach by adding a
 *  row you can't yet fill. */
function createFieldFrom() {
  const r = newDraft()
  form.reqs.push(r)
  openCreateField(r)
}
/** Drop the half-made row if the creator is dismissed without adding anything. */
function onCreatorHide() {
  const r = creatingFor.value
  if (r && !r.field_key) form.reqs = form.reqs.filter(x => x.key !== r.key)
  creatingFor.value = null
}

async function onFieldCreated(p: { label: string; type: string; placeholder: string; required: boolean; options: string[]; targets: string[] }) {
  const { data, error } = await (db.from as any)('field_definitions').insert({
    org_id: orgId.value, label: p.label, field_type: p.type,
    // is_required stays FALSE from here: the DISCIPLINE decides who needs this, and
    // true would quietly make it mandatory on every form for the type.
    is_required: false,
    options: p.options, help_text: p.placeholder || null,
    targets: p.targets, target: p.targets[0], rules: [],
    sort_order: props.catalogue.filter(f => f.source === 'custom').length,
  }).select('id, label, field_type, options').maybeSingle()
  if (error || !data) { toast.add({ severity: 'error', summary: 'Could not create the field', detail: error?.message, life: 4000 }); return }

  // Hand it to the page so the catalogue prop updates, then select it into the row
  // that asked — otherwise you'd create "School" and still have to go find it.
  emit('field-created', { key: data.id, label: data.label, source: 'custom', field_type: data.field_type, options: Array.isArray(data.options) ? data.options : [] })
  await nextTick()
  if (creatingFor.value) { creatingFor.value.field_key = data.id; onFieldChange(creatingFor.value) }
  creatingField.value = false
  toast.add({ severity: 'success', summary: `"${data.label}" added`, life: 2000 })
}

// ── Inheritance ─────────────────────────────────────────────────────────────
const byId = (id: string | null) => props.disciplines.find(d => d.id === id) ?? null
/** "Football › Male › Juniors" — the path this discipline will sit at. */
const path = computed(() => {
  const names: string[] = []
  let cur = byId(form.parent_id)
  const seen = new Set<string>()
  while (cur && !seen.has(cur.id)) { seen.add(cur.id); names.unshift(cur.name); cur = byId(cur.parent_id) }
  return [...names, form.name.trim() || (props.editing ? props.editing.name : 'New discipline')]
})

const inheritedEntries = computed<ReqEntry[]>(() => {
  if (!form.parent_id) return []
  const nodes = props.disciplines.map(d => ({ id: d.id, name: d.name, parent_id: d.parent_id, sort_order: d.sort_order }))
  const reqs = props.allReqs.filter(r => r.discipline_id !== props.editing?.id)
  return resolveFor(form.parent_id, nodes, reqs)
})
const ownKeys = computed(() => new Set(form.reqs.map(r => r.field_key).filter(Boolean)))
const untouchedInherited = computed(() => inheritedEntries.value.filter(e => !ownKeys.value.has(e.field_key)))
const shadowedFor = (field_key: string) => inheritedEntries.value.find(e => e.field_key === field_key) ?? null
function overrideInherited(e: ReqEntry) { addReq(e.field_key) }
const revertInherited = (field_key: string) => { form.reqs = form.reqs.filter(r => r.field_key !== field_key) }

// Cycle-safe parent options (can't nest a discipline inside its own subtree).
const parentOptions = computed(() => {
  if (!props.editing) return props.disciplines
  const banned = new Set<string>([props.editing.id])
  let added = true
  while (added) {
    added = false
    for (const d of props.disciplines) if (d.parent_id && banned.has(d.parent_id) && !banned.has(d.id)) { banned.add(d.id); added = true }
  }
  return props.disciplines.filter(d => !banned.has(d.id))
})

// ── Review ──────────────────────────────────────────────────────────────────
/** Own rows + everything inherited that isn't overridden — i.e. what this
 *  discipline actually demands, which is the only thing worth reviewing. */
function reviewLines(purpose: ReqPurpose) {
  const own = form.reqs.filter(r => r.field_key && !r.exempt && derivePurpose(r) === purpose)
    .map(r => ({ text: `${fieldLabel(r.field_key)} ${describeRequirement(r)}`, from: '' }))
  const inh = untouchedInherited.value.flatMap(e => e.rows.filter(r => !r.exempt && derivePurpose(r) === purpose)
    .map(r => ({ text: `${fieldLabel(e.field_key)} ${describeRequirement(r)}`, from: e.source.disciplineName })))
  return [...own, ...inh]
}
const reviewIdentity = computed(() => reviewLines('identity'))
const reviewData = computed(() => reviewLines('data'))

// ── Navigation + save ───────────────────────────────────────────────────────
const rowReady = (r: DraftReq) => !!r.field_key && (r.exempt || VALUELESS_OPERATORS.includes(r.operator)
  || (RANGE_OPERATORS.includes(r.operator) ? Array.isArray(r.value) && (r.value[0] != null || r.value[1] != null) : r.value != null && r.value !== ''))
const badRange = computed(() => form.reqs.find(r => RANGE_OPERATORS.includes(r.operator) && !r.exempt
  && Array.isArray(r.value) && r.value[0] != null && r.value[1] != null && Number(r.value[0]) > Number(r.value[1])))
const canNext = computed(() => {
  if (step.value === 0) return !!form.name.trim()
  // Half-finished rows are the thing that makes a rule silently never fire, so
  // don't let someone walk past one.
  if (step.value === 1) return form.reqs.every(rowReady) && !badRange.value
  return true
})

async function finish() {
  saving.value = true
  const payload: any = {
    org_id: orgId.value, name: form.name.trim(), code: form.code.trim() || null,
    parent_id: form.parent_id, applies_to: form.applies_to.length ? form.applies_to : null,
  }
  let id = props.editing?.id ?? null
  if (id) await (db.from as any)('disciplines').update(payload).eq('id', id)
  else {
    const sibs = props.disciplines.filter(d => (d.parent_id ?? null) === (form.parent_id ?? null)).length
    const { data } = await (db.from as any)('disciplines').insert({ ...payload, sort_order: sibs }).select('id').maybeSingle()
    id = data?.id ?? null
  }
  if (id) {
    await dr.saveRequirements(id, form.reqs.filter(r => r.field_key).map(r => ({
      field_key: r.field_key,
      field_source: (fieldOf(r.field_key)?.source ?? 'core') as 'core' | 'custom',
      purpose: derivePurpose(r), operator: r.operator, value: r.value ?? null, exempt: r.exempt,
      message: r.message.trim() || null, applies_to: r.applies_to ?? [],
    })))
  }
  saving.value = false
  toast.add({ severity: 'success', summary: `${form.name.trim()} saved`, life: 2000 })
  emit('saved')
}
</script>

<template>
  <WizardShell v-model="step" :steps="STEPS" :title="editing ? `Edit ${editing.name}` : 'New discipline'"
    :can-next="canNext" :saving="saving" :finish-label="editing ? 'Save changes' : 'Create discipline'"
    @finish="finish" @close="emit('close')">

    <!-- 1 · The discipline -->
    <div v-show="step === 0" class="space-y-5 max-w-xl">
      <div>
        <h3 class="text-sm font-semibold text-gray-800">What is this discipline?</h3>
        <p class="text-xs text-gray-500 mt-0.5">Clubs beneath you connect their classes and events to it.</p>
      </div>
      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-medium text-gray-600">Name</label>
        <InputText v-model="form.name" placeholder="e.g. Juniors, Premiers, 10-14's" class="w-full" autofocus />
      </div>
      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-medium text-gray-600">Sits under <span class="text-gray-400 font-normal">— optional</span></label>
        <Select v-model="form.parent_id" :options="parentOptions" option-label="name" option-value="id"
          placeholder="Nothing — it's top level" show-clear filter class="w-full" />
        <p class="text-xs text-gray-400">
          It picks up everything its parents require, and can override any of it.
        </p>
      </div>
      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-medium text-gray-600">Short code <span class="text-gray-400 font-normal">— optional</span></label>
        <InputText v-model="form.code" placeholder="e.g. U14M" class="w-full" />
      </div>
      <div class="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
        <div class="text-xs text-gray-400 mb-0.5">It'll sit here</div>
        <div class="text-sm text-gray-700 font-medium">{{ path.join('  ›  ') }}</div>
      </div>
    </div>

    <!-- 2 · What it requires — ONE list. The operator phrasing carries what each
         rule MEANS, so purpose is derived rather than asked for on its own screen. -->
    <div v-show="step === 1" class="space-y-4 max-w-2xl">
      <div>
        <h3 class="text-sm font-semibold text-gray-800">What does {{ form.name.trim() || 'this discipline' }} require?</h3>
        <p class="text-xs text-gray-500 mt-0.5">
          Say it as you'd say it out loud — “Gender must be Female”, “School must be recorded”.
          Anyone who doesn't meet a rule is flagged to their club; nothing ever blocks a registration.
        </p>
      </div>

      <!-- Inherited from above: locked, naming where it came from. -->
      <div v-for="e in untouchedInherited" :key="'i-' + e.field_key"
        class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 flex items-start justify-between gap-2">
        <div class="min-w-0">
          <div class="flex items-center gap-1.5 text-xs text-gray-700">
            <i class="pi pi-lock text-xs text-blue-400" />
            <span class="font-medium truncate">{{ fieldLabel(e.field_key) }}</span>
            <span class="text-gray-500 truncate">{{ e.rows.map(describeRequirement).join(' · ') }}</span>
          </div>
          <div class="text-xs text-gray-400 mt-0.5">From {{ e.source.disciplineName }}</div>
        </div>
        <button class="text-xs text-primary hover:underline shrink-0" @click="overrideInherited(e)">Override</button>
      </div>

      <DisciplineReqRow v-for="(r, i) in form.reqs" :key="r.key" :row="r" :index="i"
        :core-fields="coreFields" :custom-fields="customFields" :org-name="orgName"
        :options="optionsFor(r)" :operator-label="operatorLabel(r)" :shows-value="showsValue(r)" :shows-range="showsRange(r)"
        :value-options="valueOptionsFor(r.field_key)" :numeric="isNumericField(r.field_key)" :shadowed="shadowedFor(r.field_key)"
        :field-label="fieldLabel" lead="Requires" lead-more="and requires" :person-types="personTypes"
        @field-change="onFieldChange(r)" @operator="setOperator(r, $event)" @range="setRange(r, $event.i, $event.v)"
        @remove="removeReq(r)" @revert="revertInherited(r.field_key)" @create-field="openCreateField(r)"
        @toggle-type="toggleReqType(r, $event)" />

      <div class="flex items-center gap-4">
        <button class="text-xs text-primary hover:underline" @click="addReq()">+ Add a requirement</button>
        <button class="text-xs text-gray-500 hover:text-gray-800 hover:underline" @click="createFieldFrom()">
          + Create a new field
        </button>
      </div>

      <div v-if="!form.reqs.length && !untouchedInherited.length"
        class="rounded-lg border border-dashed border-gray-200 px-4 py-5 text-center">
        <p class="text-xs text-gray-500">Nothing yet — anyone can be in this discipline and clubs won't be asked for anything.</p>
        <p class="text-xs text-gray-400 mt-1">
          That's right for a grouping like “Football”; a “Juniors” would want an age.
          <template v-if="!customFields.length">
            {{ orgName }} has no fields of its own yet —
            <button class="text-primary hover:underline" @click="createFieldFrom()">create the first one</button>
            (e.g. School).
          </template>
        </p>
      </div>
    </div>

    <!-- 3 · Where it applies -->
    <div v-show="step === 2" class="space-y-4 max-w-xl">
      <div>
        <h3 class="text-sm font-semibold text-gray-800">Where can clubs use it?</h3>
        <p class="text-xs text-gray-500 mt-0.5">
          Leave it empty and it shows up everywhere. Narrow it and it only appears where it makes sense.
        </p>
      </div>
      <ChipMultiSelect v-model="form.applies_to" :options="parts" option-label="label" option-value="value"
        placeholder="Everywhere" show-toggle-all class="w-full" />
    </div>

    <!-- 4 · Review -->
    <div v-show="step === 3" class="space-y-4 max-w-2xl">
      <div>
        <h3 class="text-sm font-semibold text-gray-800">Here's what you're creating</h3>
        <p class="text-xs text-gray-500 mt-0.5">Everything this discipline demands, including what it picks up from above.</p>
      </div>
      <div class="card p-4 space-y-3">
        <div>
          <div class="text-xs text-gray-400">Discipline</div>
          <div class="text-sm font-medium text-gray-800">{{ path.join('  ›  ') }}</div>
        </div>
        <div class="border-t border-gray-100 pt-3">
          <div class="text-xs text-gray-400 mb-1">Who it's for</div>
          <ul v-if="reviewIdentity.length" class="space-y-1">
            <li v-for="l in reviewIdentity" :key="l.text" class="text-sm text-gray-700 flex items-center gap-1.5">
              <i class="pi pi-user text-xs text-gray-300" />{{ l.text }}
              <span v-if="l.from" class="text-xs text-gray-400">· from {{ l.from }}</span>
            </li>
          </ul>
          <p v-else class="text-sm text-gray-400">Anyone</p>
        </div>
        <div class="border-t border-gray-100 pt-3">
          <div class="text-xs text-gray-400 mb-1">What clubs must record</div>
          <ul v-if="reviewData.length" class="space-y-1">
            <li v-for="l in reviewData" :key="l.text" class="text-sm text-gray-700 flex items-center gap-1.5">
              <i class="pi pi-check-circle text-xs text-gray-300" />{{ l.text }}
              <span v-if="l.from" class="text-xs text-gray-400">· from {{ l.from }}</span>
            </li>
          </ul>
          <p v-else class="text-sm text-gray-400">Nothing extra</p>
        </div>
        <div class="border-t border-gray-100 pt-3">
          <div class="text-xs text-gray-400 mb-1">Clubs can use it on</div>
          <p class="text-sm text-gray-700">{{ form.applies_to.length ? form.applies_to.map(v => parts.find(p => p.value === v)?.label).join(' · ') : 'Everything' }}</p>
        </div>
      </div>
      <p class="text-xs text-gray-400">
        None of this stops anyone registering — clubs see a flag when someone doesn't match.
      </p>
    </div>

    <!-- Invent a field without leaving the wizard. -->
    <Dialog v-model:visible="creatingField" modal header="New field" :style="{ width: '95vw', maxWidth: '420px' }" @hide="onCreatorHide">
      <p class="text-xs text-gray-500 px-4 pt-3 -mb-1">
        It joins {{ orgName }}'s fields, so every discipline can ask for it — and clubs beneath you inherit it.
      </p>
      <FieldCreator hide-required @add="onFieldCreated" />
    </Dialog>
  </WizardShell>
</template>
