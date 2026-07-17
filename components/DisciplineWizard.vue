<!--
  Discipline editor — how a governing body creates or edits a discipline.

  ONE PAGE. This was a 4-step wizard (The discipline / What it requires / Where it
  applies / Review) and Karl's verdict was "it's a bit all over the place, it should
  be simple to follow ... maybe one page?". He's right, and the history is worth
  knowing: it was a single page ORIGINALLY, which became mush and got broken into
  steps. But the thing that made it mush was the REQUIREMENTS — "Gender = Male" and
  "School Is Not Empty" in one undifferentiated pile, so you couldn't tell what a
  discipline meant by reading it.
  
  The cast (mig 276) is what fixed that, and it's why one page works now: the rules
  are grouped under who they're for ("Players must have…", "Coaches must have…"), so
  the pile is gone. The section a rule sits in IS its scope, which also killed the
  per-rule "who" picker. And once the page reads top-to-bottom — what it is, who's in
  it, what they need — the Review step has nothing left to review: the page IS the
  review.

  A rule's `purpose` (268) stays DERIVED from its phrasing rather than asked for: a
  presence test means chase them, a value test means they don't belong. Asking would
  be a third framing of the same rule. (Two rule steps was also tried, and read as
  duplication — same picker, same operators, differing by a word.)
-->
<script setup lang="ts">
import type { PersonFieldDef } from '~/composables/usePersonFields'
import type { DisciplineRequirement, ReqEntry, ReqOperator } from '~/composables/useDisciplineRequirements'

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

const saving = ref(false)

// ── Form ────────────────────────────────────────────────────────────────────
// applies_to = OUR person-type keys ([] = everyone in the discipline). Juniors'
// players and juniors' coaches are not asked for the same things, and until this
// was authorable every rule silently meant "everyone on the roster".
interface DraftReq { key: string; field_key: string; operator: ReqOperator; value: any; exempt: boolean; message: string; applies_to: string[] }
const form = reactive<{ name: string; code: string; parent_id: string | null; applies_to: string[]; person_type_keys: string[]; reqs: DraftReq[] }>({
  name: '', code: '', parent_id: null, applies_to: [], person_type_keys: [], reqs: [],
})
// The CAST (mig 276) — who takes part. Declared, not derived from the rules:
// you cannot say "juniors have coaches" by first inventing a requirement about
// coaches, and a referee the body requires nothing of is still in the discipline.
function toggleCast(key: string) {
  const has = form.person_type_keys.includes(key)
  form.person_type_keys = has ? form.person_type_keys.filter(k => k !== key) : [...form.person_type_keys, key]
  // A rule can only be "for" someone in the cast — drop a scope we just removed,
  // or the rule keeps a target nobody can see or change.
  if (has) for (const r of form.reqs) r.applies_to = r.applies_to.filter(k => k !== key)
}
/** Inherited from the parent when this discipline names nobody — same closest-wins
 *  as requirements, so a child doesn't have to restate its parent's cast. */
const inheritedCast = computed<string[]>(() => {
  if (form.person_type_keys.length || !form.parent_id) return []
  return castFor(form.parent_id, props.disciplines as any)
})
const effectiveCast = computed<string[]>(() =>
  form.person_type_keys.length ? form.person_type_keys : inheritedCast.value)
/**
 * The rule sections — one per cast member, plus "Everyone".
 *
 * The cast IS the structure: the section a rule sits in is its scope, so a row is
 * just field + phrasing and no rule carries a "who" picker. This is also what makes
 * ONE PAGE readable — a single page was tried first and became mush precisely
 * because the rules were one undifferentiated pile.
 */
// "Every Coach" — not "Coachs". Pluralising a label by bolting an s on it breaks
// the moment it ends in a sibilant, and "Every X" says the same thing without ever
// needing to know how to pluralise anything.
const reqSections = computed(() => [
  ...effectiveCast.value.map(k => {
    const label = props.personTypes.find(t => t.key === k)?.label ?? k
    return { key: k as string | null, heading: `Every ${label}` }
  }),
  { key: null as string | null, heading: effectiveCast.value.length ? 'Everyone else' : 'Everyone in it' },
])
/** A rule belongs to exactly ONE section — its first scope, or Everyone. */
const sectionKeyOf = (r: DraftReq) => r.applies_to?.[0] ?? null
const reqsIn = (key: string | null) => form.reqs.filter(r => sectionKeyOf(r) === key)
/** Adding under a heading IS the scoping — no separate picker to forget. */
function addReqIn(key: string | null) {
  const r = newDraft()
  r.applies_to = key ? [key] : []
  form.reqs.push(r)
}

const newDraft = (field_key = ''): DraftReq => ({
  key: Math.random().toString(36).slice(2), field_key,
  operator: 'Is Not Empty', value: null, exempt: false, message: '', applies_to: [],
})
onMounted(() => {
  if (props.editing) {
    const d = props.editing
    form.name = d.name; form.code = d.code ?? ''; form.parent_id = d.parent_id
    form.applies_to = [...(d.applies_to ?? [])]
    form.person_type_keys = [...((d as any).person_type_keys ?? [])]
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

// ── Navigation + save ───────────────────────────────────────────────────────
const rowReady = (r: DraftReq) => !!r.field_key && (r.exempt || VALUELESS_OPERATORS.includes(r.operator)
  || (RANGE_OPERATORS.includes(r.operator) ? Array.isArray(r.value) && (r.value[0] != null || r.value[1] != null) : r.value != null && r.value !== ''))
const badRange = computed(() => form.reqs.find(r => RANGE_OPERATORS.includes(r.operator) && !r.exempt
  && Array.isArray(r.value) && r.value[0] != null && r.value[1] != null && Number(r.value[0]) > Number(r.value[1])))

async function finish() {
  saving.value = true
  const payload: any = {
    org_id: orgId.value, name: form.name.trim(), code: form.code.trim() || null,
    parent_id: form.parent_id, applies_to: form.applies_to.length ? form.applies_to : null,
    // null (not []) = says nothing → inherit the parent's cast. [] would read as
    // "nobody takes part", which is not a thing anyone means.
    person_type_keys: form.person_type_keys.length ? form.person_type_keys : null,
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
  <Dialog :visible="true" modal :header="editing ? `Edit ${editing.name}` : 'New discipline'"
    :style="{ width: '95vw', maxWidth: '820px' }" :closable="!saving"
    @update:visible="v => { if (!v) emit('close') }">

    <div class="space-y-5">
      <!-- What this screen IS. A body admin opening it cold has no idea what a
           discipline is or what they're about to make, and every other hint here
           answers "what goes in this box" rather than "why am I doing this". -->
      <p v-if="!editing" class="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
        A discipline is a category your clubs connect their classes and events to —
        <span class="text-gray-700">Juniors</span>, <span class="text-gray-700">Premiers</span>,
        <span class="text-gray-700">Women's</span>. Say who takes part and what you need recorded about them,
        and every affiliated club is asked for it automatically.
        <span class="text-gray-400">Nobody is ever blocked — people who don't meet a rule are flagged to their club.</span>
      </p>

      <!-- WHAT IT IS -->
      <div class="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-3">
        <div class="flex flex-col gap-1.5">
          <label class="field-label">Name</label>
          <InputText v-model="form.name" placeholder="e.g. Juniors, Premiers, 10-14's" class="w-full" autofocus />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="field-label">Short code <span class="text-gray-400 font-normal">— optional</span></label>
          <InputText v-model="form.code" placeholder="e.g. U14M" class="w-full" />
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div class="flex flex-col gap-1.5">
          <label class="field-label">Sits under <span class="text-gray-400 font-normal">— optional</span></label>
          <Select v-model="form.parent_id" :options="parentOptions" option-label="name" option-value="id"
            placeholder="Nothing — it's top level" show-clear filter class="w-full" />
          <span class="field-help">Picks up everything its parents require, and can override any of it.</span>
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="field-label">Clubs can use it for</label>
          <ChipMultiSelect v-model="form.applies_to" :options="parts" option-label="label" option-value="value"
            placeholder="Everywhere" show-toggle-all class="w-full" />
          <span class="field-help">Empty = everywhere.</span>
        </div>
      </div>

      <div class="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
        <div class="text-xs text-gray-400 mb-0.5">It'll sit here</div>
        <div class="text-sm text-gray-700 font-medium">{{ path.join('  ›  ') }}</div>
      </div>

      <!-- WHO'S IN IT — declared before the rules, because that's the order you
           think in, and because it gives the rules below their shape. -->
      <div v-if="personTypes.length" class="border-t border-gray-100 pt-4 space-y-2">
        <div>
          <label class="field-label">Who takes part?</label>
          <p class="field-help">
            The kinds of people involved. Clubs connect their own people to these and can call them
            anything — your <em>{{ personTypes[0]?.label ?? 'Player' }}</em> might be their “Member”.
            It's also how a club knows who to add to a class it connects here.
          </p>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <button v-for="t in personTypes" :key="t.key" type="button"
            class="text-xs px-2.5 py-1 rounded-full border transition-colors"
            :class="form.person_type_keys.includes(t.key)
              ? 'bg-primary text-white border-primary'
              : 'bg-white text-gray-500 border-gray-200 hover:border-primary/40'"
            @click="toggleCast(t.key)">{{ t.label }}</button>
        </div>
        <p v-if="!form.person_type_keys.length && inheritedCast.length" class="field-help">
          <i class="pi pi-lock text-[10px] mr-1" />Inheriting
          <span class="font-medium text-gray-500">{{ inheritedCast.map(k => personTypes.find(t => t.key === k)?.label ?? k).join(', ') }}</span>
          from {{ byId(form.parent_id)?.name }} — pick some to override.
        </p>
      </div>

      <!-- WHAT THEY NEED — the cast IS the structure. The section a rule sits in is
           its scope, so a row is just field + phrasing, and the page reads as the
           sentence you'd say: "junior players need this, junior coaches need that".
           (A single page failed before because the rules were ONE undifferentiated
           pile; sections are what make it readable, so the wizard isn't needed.) -->
      <div class="border-t border-gray-100 pt-4 space-y-4">
        <div>
          <label class="field-label">What does {{ form.name.trim() || 'it' }} require?</label>
          <p class="field-help">
            What each of those people must have on record. Say it as you'd say it out loud —
            “<em>School must be recorded</em>”, “<em>Gender must be Female</em>”. Leave a group empty
            if you need nothing from them.
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

        <div v-for="s in reqSections" :key="s.key ?? '__all'" class="space-y-2">
          <div class="flex items-baseline gap-2">
            <h4 class="text-xs font-semibold text-gray-700">{{ s.heading }}</h4>
            <span v-if="!reqsIn(s.key).length" class="text-xs text-gray-300">nothing</span>
          </div>

          <DisciplineReqRow v-for="r in reqsIn(s.key)" :key="r.key" :row="r"
            :core-fields="coreFields" :custom-fields="customFields" :org-name="orgName"
            :options="optionsFor(r)" :operator-label="operatorLabel(r)" :shows-value="showsValue(r)" :shows-range="showsRange(r)"
            :value-options="valueOptionsFor(r.field_key)" :numeric="isNumericField(r.field_key)" :shadowed="shadowedFor(r.field_key)"
            :field-label="fieldLabel"
            @field-change="onFieldChange(r)" @operator="setOperator(r, $event)" @range="setRange(r, $event.i, $event.v)"
            @remove="removeReq(r)" @revert="revertInherited(r.field_key)" @create-field="openCreateField(r)" />

          <button class="text-xs text-primary hover:underline" @click="addReqIn(s.key)">+ Add</button>
        </div>

        <button class="text-xs text-gray-500 hover:text-gray-800 hover:underline" @click="createFieldFrom()">
          + Create a new field
        </button>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-between w-full gap-3">
        <!-- Editing: the intro at the top only shows when creating, so the
             reassurance still needs saying somewhere. -->
        <span class="field-help">{{ editing ? 'Changes reach every affiliated club straight away.' : '' }}</span>
        <div class="flex items-center gap-2 shrink-0">
          <Button label="Cancel" text :disabled="saving" @click="emit('close')" />
          <Button :label="saving ? 'Saving…' : (editing ? 'Save changes' : 'Create discipline')"
            :disabled="!form.name.trim() || saving"
            style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="finish" />
        </div>
      </div>
    </template>

    <!-- Create a field without leaving — a body writing its first rule has none. -->
    <Dialog v-model:visible="creatingField" modal header="New field" :style="{ width: '95vw', maxWidth: '420px' }" @hide="onCreatorHide">
      <FieldCreator hide-required :person-types="personTypes" @add="onFieldCreated" />
    </Dialog>
  </Dialog>
</template>
