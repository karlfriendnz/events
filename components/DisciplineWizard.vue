<!--
  Discipline wizard — how a governing body creates or edits a discipline.

  Replaces a single slide-out that crammed name / code / parent / applies-to /
  requirements into one scroll. The requirements list was the problem: "Gender =
  Male" and "School Is Not Empty" sat in one undifferentiated pile despite saying
  completely different things, so nobody could tell what a discipline meant by
  reading it.

  So the steps ARE the distinction:
    1 The discipline    — what it's called, where it sits (shows the resulting path)
    2 Who it's for      — identity rules: who BELONGS here (Gender = Male, Age 10–14)
    3 What to record    — data rules: what the club must HAVE about them (School)
    4 Where it applies  — Events / Groups / Competitions
    5 Review            — everything, including what it inherits and what it shadows

  Steps 2 and 3 write the same table; `purpose` records which one meant what (268),
  because the club-side flag differs: "she shouldn't be in Male" vs "chase her for
  her school".

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
}>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'saved'): void }>()

const db = useDb()
const { orgId } = useOrg()
const toast = useToast()
const dr = useDisciplineRequirements()

const STEPS = [
  { key: 'about', label: 'The discipline' },
  { key: 'who', label: "Who it's for" },
  { key: 'record', label: 'What to record' },
  { key: 'where', label: 'Where it applies' },
  { key: 'review', label: 'Review' },
]
const step = ref(0)
const saving = ref(false)

// ── Form ────────────────────────────────────────────────────────────────────
interface DraftReq { key: string; field_key: string; purpose: ReqPurpose; operator: ReqOperator; value: any; exempt: boolean; message: string }
const form = reactive<{ name: string; code: string; parent_id: string | null; applies_to: string[]; reqs: DraftReq[] }>({
  name: '', code: '', parent_id: null, applies_to: [], reqs: [],
})

const newDraft = (purpose: ReqPurpose, field_key = ''): DraftReq => ({
  key: Math.random().toString(36).slice(2), field_key, purpose,
  operator: purpose === 'identity' ? 'Equals' : 'Is Not Empty', value: null, exempt: false, message: '',
})
const identityReqs = computed(() => form.reqs.filter(r => r.purpose === 'identity'))
const dataReqs = computed(() => form.reqs.filter(r => r.purpose === 'data'))

onMounted(() => {
  if (props.editing) {
    const d = props.editing
    form.name = d.name; form.code = d.code ?? ''; form.parent_id = d.parent_id
    form.applies_to = [...(d.applies_to ?? [])]
    form.reqs = props.allReqs.filter(r => r.discipline_id === d.id).sort((a, b) => a.sort_order - b.sort_order)
      .map(r => ({ key: r.id, field_key: r.field_key, purpose: r.purpose, operator: r.operator, value: r.value, exempt: r.exempt, message: r.message ?? '' }))
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

const optionsFor = (r: DraftReq) => REQUIREMENT_OPTIONS.filter(o =>
  !o.operator || !NUMERIC_OPERATORS.includes(o.operator) || isNumericField(r.field_key))
function setOperator(r: DraftReq, label: string) {
  const opt = REQUIREMENT_OPTIONS.find(o => o.label === label)!
  r.exempt = opt.exempt
  if (opt.operator) r.operator = opt.operator
  r.value = opt.exempt || VALUELESS_OPERATORS.includes(r.operator) ? null
    : RANGE_OPERATORS.includes(r.operator) ? [null, null] : null
}
function onFieldChange(r: DraftReq) {
  if (NUMERIC_OPERATORS.includes(r.operator) && !isNumericField(r.field_key)) setOperator(r, 'Is Not Empty')
  else if (r.field_key === 'age' && r.operator === 'Equals') setOperator(r, 'Is Between')
}
const operatorLabel = (r: DraftReq) => (r.exempt ? 'Not required' : r.operator)
const showsValue = (r: DraftReq) => !r.exempt && !VALUELESS_OPERATORS.includes(r.operator)
const showsRange = (r: DraftReq) => !r.exempt && RANGE_OPERATORS.includes(r.operator)
function setRange(r: DraftReq, i: 0 | 1, v: any) {
  const pair = Array.isArray(r.value) ? [...r.value] : [null, null]
  pair[i] = v === '' || v == null ? null : Number(v)
  r.value = pair
}
function addReq(purpose: ReqPurpose, field_key = '') { form.reqs.push(newDraft(purpose, field_key)) }
const removeReq = (r: DraftReq) => { form.reqs = form.reqs.filter(x => x.key !== r.key) }

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
const inheritedFor = (purpose: ReqPurpose) => inheritedEntries.value.filter(e => e.rows[0]?.purpose === purpose)
const untouchedInherited = (purpose: ReqPurpose) => inheritedFor(purpose).filter(e => !ownKeys.value.has(e.field_key))
const shadowedFor = (field_key: string) => inheritedEntries.value.find(e => e.field_key === field_key) ?? null
function overrideInherited(e: ReqEntry) { addReq(e.rows[0]?.purpose ?? 'data', e.field_key) }
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
  const own = form.reqs.filter(r => r.purpose === purpose && r.field_key && !r.exempt)
    .map(r => ({ text: `${fieldLabel(r.field_key)} ${describeRequirement(r).toLowerCase()}`, from: '' }))
  const inh = untouchedInherited(purpose).flatMap(e => e.rows.filter(r => !r.exempt)
    .map(r => ({ text: `${fieldLabel(e.field_key)} ${describeRequirement(r).toLowerCase()}`, from: e.source.disciplineName })))
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
  if (step.value === 1) return identityReqs.value.every(rowReady) && !badRange.value
  if (step.value === 2) return dataReqs.value.every(rowReady)
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
      purpose: r.purpose, operator: r.operator, value: r.value ?? null, exempt: r.exempt,
      message: r.message.trim() || null, applies_to: [] as string[],
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

    <!-- 2 · Who it's for (identity) -->
    <div v-show="step === 1" class="space-y-4 max-w-2xl">
      <div>
        <h3 class="text-sm font-semibold text-gray-800">Who is in {{ form.name.trim() || 'this discipline' }}?</h3>
        <p class="text-xs text-gray-500 mt-0.5">
          What makes someone belong here. Someone who doesn't match is flagged to the club as being in
          the wrong place — it never blocks their registration.
        </p>
      </div>

      <div v-for="e in untouchedInherited('identity')" :key="'i-' + e.field_key"
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

      <DisciplineReqRow v-for="r in identityReqs" :key="r.key" :row="r" :index="identityReqs.indexOf(r)"
        :core-fields="coreFields" :custom-fields="customFields" :org-name="orgName"
        :options="optionsFor(r)" :operator-label="operatorLabel(r)" :shows-value="showsValue(r)" :shows-range="showsRange(r)"
        :value-options="valueOptionsFor(r.field_key)" :numeric="isNumericField(r.field_key)" :shadowed="shadowedFor(r.field_key)"
        :field-label="fieldLabel" lead="Is" lead-more="and is"
        @field-change="onFieldChange(r)" @operator="setOperator(r, $event)" @range="setRange(r, $event.i, $event.v)"
        @remove="removeReq(r)" @revert="revertInherited(r.field_key)" />

      <button class="text-xs text-primary hover:underline" @click="addReq('identity')">+ Add something that identifies them</button>
      <p v-if="!identityReqs.length && !untouchedInherited('identity').length" class="text-xs text-gray-400">
        Nothing yet — anyone can be in this discipline. That's fine for a grouping like “Football”.
      </p>
    </div>

    <!-- 3 · What to record (data) -->
    <div v-show="step === 2" class="space-y-4 max-w-2xl">
      <div>
        <h3 class="text-sm font-semibold text-gray-800">What must clubs have on record?</h3>
        <p class="text-xs text-gray-500 mt-0.5">
          Information every person in this discipline needs. Anyone missing it is flagged to their club
          so they can chase it — it never blocks their registration.
        </p>
      </div>

      <div v-for="e in untouchedInherited('data')" :key="'d-' + e.field_key"
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

      <DisciplineReqRow v-for="r in dataReqs" :key="r.key" :row="r" :index="dataReqs.indexOf(r)"
        :core-fields="coreFields" :custom-fields="customFields" :org-name="orgName"
        :options="optionsFor(r)" :operator-label="operatorLabel(r)" :shows-value="showsValue(r)" :shows-range="showsRange(r)"
        :value-options="valueOptionsFor(r.field_key)" :numeric="isNumericField(r.field_key)" :shadowed="shadowedFor(r.field_key)"
        :field-label="fieldLabel" lead="Must have" lead-more="and must have"
        @field-change="onFieldChange(r)" @operator="setOperator(r, $event)" @range="setRange(r, $event.i, $event.v)"
        @remove="removeReq(r)" @revert="revertInherited(r.field_key)" />

      <button class="text-xs text-primary hover:underline" @click="addReq('data')">+ Add something they must have</button>
      <p v-if="!dataReqs.length && !untouchedInherited('data').length" class="text-xs text-gray-400">
        Nothing yet — clubs won't be asked for anything extra.
      </p>
    </div>

    <!-- 4 · Where it applies -->
    <div v-show="step === 3" class="space-y-4 max-w-xl">
      <div>
        <h3 class="text-sm font-semibold text-gray-800">Where can clubs use it?</h3>
        <p class="text-xs text-gray-500 mt-0.5">
          Leave it empty and it shows up everywhere. Narrow it and it only appears where it makes sense.
        </p>
      </div>
      <ChipMultiSelect v-model="form.applies_to" :options="parts" option-label="label" option-value="value"
        placeholder="Everywhere" show-toggle-all class="w-full" />
    </div>

    <!-- 5 · Review -->
    <div v-show="step === 4" class="space-y-4 max-w-2xl">
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
  </WizardShell>
</template>
