<!--
  Disciplines manager — defined and managed by the governing body (NSO) itself.
  Scoped to the current org. Disciplines form a hierarchy (e.g. Seniors >
  Premiers > B Grade). Clubs map their groups/events to these (<DisciplineLinker>).
-->
<script setup lang="ts">
const db = useDb()
const { orgId } = useOrg()
const toast = useToast()

// NB `disciplines.sport` still exists in the DB but is no longer captured here:
// a discipline's sport is implied by the governing body that owns it.
interface Disc {
  id: string; org_id: string; name: string; code: string | null; parent_id: string | null
  sort_order?: number; applies_to?: string[] | null; depth?: number
}

const dr = useDisciplineRequirements()
const { loadFieldCatalogue } = usePersonFields()

// Every requirement across this org's disciplines — the chain walk needs ancestors.
const allReqs = ref<DisciplineRequirement[]>([])
const catalogue = ref<PersonFieldDef[]>([])
const fieldLabel = (key: string) => catalogue.value.find(f => f.key === key)?.label ?? key
const fieldOf = (key: string) => catalogue.value.find(f => f.key === key)
// Split for the picker's two optgroups.
const coreFields = computed(() => catalogue.value.filter(f => f.source === 'core'))
const customFields = computed(() => catalogue.value.filter(f => f.source === 'custom'))

// Gender is stored uppercase (the persons CHECK), so the value picker must offer
// the STORED values — free text here is how someone types "female" and silently
// never matches.
const GENDER_VALUES = ['MALE', 'FEMALE', 'NON_BINARY', 'UNSPECIFIED']
function valueOptionsFor(key: string): string[] | null {
  if (key === 'gender') return GENDER_VALUES
  const f = fieldOf(key)
  return f?.options?.length ? f.options : null
}

// A requirement row being edited (own rows only — inherited ones are read-only).
interface DraftReq { key: string; field_key: string; operator: ReqOperator; value: any; exempt: boolean; message: string }
const newDraft = (field_key = ''): DraftReq =>
  ({ key: Math.random().toString(36).slice(2), field_key, operator: 'Is Not Empty', value: null, exempt: false, message: '' })
const draftToReq = (d: DraftReq) => ({
  field_key: d.field_key,
  field_source: (fieldOf(d.field_key)?.source ?? 'core') as 'core' | 'custom',
  operator: d.operator, value: d.value ?? null, exempt: d.exempt,
  message: d.message.trim() || null, applies_to: [] as string[],
})

// Numeric operators only make sense on a number — offering "Is At Most" on School
// is how someone writes a rule that can never fire.
const isNumericField = (key: string) => key === 'age' || fieldOf(key)?.field_type === 'number'
const optionsFor = (r: DraftReq) => REQUIREMENT_OPTIONS.filter(o =>
  !o.operator || !NUMERIC_OPERATORS.includes(o.operator) || isNumericField(r.field_key))

// The editor's single dropdown: "Not required" is a LABEL for exempt, never a
// stored operator (that would diverge from the shared visibility_conditions five).
function setOperator(r: DraftReq, label: string) {
  const opt = REQUIREMENT_OPTIONS.find(o => o.label === label)!
  r.exempt = opt.exempt
  if (opt.operator) r.operator = opt.operator
  r.value = opt.exempt || VALUELESS_OPERATORS.includes(r.operator) ? null
    : RANGE_OPERATORS.includes(r.operator) ? [null, null] : null
}
// Switching to a non-numeric field must drop a numeric operator, or the row keeps
// a rule the picker no longer offers.
function onFieldChange(r: DraftReq) {
  if (NUMERIC_OPERATORS.includes(r.operator) && !isNumericField(r.field_key)) setOperator(r, 'Is Not Empty')
}
const operatorLabel = (r: DraftReq) => (r.exempt ? 'Not required' : r.operator)
const showsValue = (r: DraftReq) => !r.exempt && !VALUELESS_OPERATORS.includes(r.operator)
const showsRange = (r: DraftReq) => !r.exempt && RANGE_OPERATORS.includes(r.operator)
function setRange(r: DraftReq, i: 0 | 1, v: any) {
  const pair = Array.isArray(r.value) ? [...r.value] : [null, null]
  pair[i] = v === '' || v == null ? null : Number(v)
  r.value = pair
}

// The parts of the system a discipline can be tied to. Empty = applies everywhere.
const DISCIPLINE_PARTS = [
  { label: 'Events', value: 'event' },
  { label: 'Groups', value: 'group' },
  { label: 'Competitions', value: 'competition' },
]
const partLabel = (v: string) => DISCIPLINE_PARTS.find(p => p.value === v)?.label ?? v

const org = ref<{ name: string; org_level: string } | null>(null)
const isGoverning = computed(() => !!org.value && isGoverningBody(org.value.org_level))
const disciplines = ref<Disc[]>([])
const loading = ref(true)

const form = reactive<{
  name: string; code: string; parent_id: string | null; applies_to: string[]; reqs: DraftReq[]
}>({ name: '', code: '', parent_id: null, applies_to: [], reqs: [] })
const editingId = ref<string | null>(null)

// What this discipline INHERITS — i.e. what its parent chain resolves to. Computed
// from form.parent_id, so re-parenting in the drawer updates it live.
const inheritedEntries = computed<ReqEntry[]>(() => {
  if (!form.parent_id) return []
  const nodes = disciplines.value.map(d => ({ id: d.id, name: d.name, parent_id: d.parent_id, sort_order: d.sort_order }))
  // Exclude this discipline's own saved rows — form.reqs is the live truth for them.
  const reqs = allReqs.value.filter(r => r.discipline_id !== editingId.value)
  return resolveFor(form.parent_id, nodes, reqs)
})

// Closest-wins is INVISIBLE by nature: adding a rule here silently cancels the
// ancestor's rule for that field. So every inherited entry is shown, and one this
// discipline overrides is rendered struck-through beneath the row replacing it.
const overriddenKeys = computed(() => new Set(form.reqs.map(r => r.field_key).filter(Boolean)))
const shadowedFor = (field_key: string) => inheritedEntries.value.find(e => e.field_key === field_key) ?? null
const untouchedInherited = computed(() => inheritedEntries.value.filter(e => !overriddenKeys.value.has(e.field_key)))
const describeRow = describeRequirement

function addReq(field_key = '') { form.reqs.push(newDraft(field_key)) }
/** "Override" = add a requirement with this field pre-selected. One code path. */
function overrideInherited(e: ReqEntry) { addReq(e.field_key) }
function revertInherited(field_key: string) { form.reqs = form.reqs.filter(r => r.field_key !== field_key) }

// Effective parent key (treats orphaned parent_id as top-level).
const parentKey = (d: Disc) => (d.parent_id && disciplines.value.some(x => x.id === d.parent_id)) ? d.parent_id : null
// Siblings of a discipline, in display order (sort_order, then name as a tiebreak).
const sortSibs = (a: Disc, b: Disc) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)

// Depth-ordered tree (roots first, children indented), siblings by sort_order.
const ordered = computed<Disc[]>(() => {
  const byParent = new Map<string | null, Disc[]>()
  for (const d of disciplines.value) {
    const k = parentKey(d)
    ;(byParent.get(k) ?? byParent.set(k, []).get(k)!).push(d)
  }
  const out: Disc[] = []
  const walk = (p: string | null, depth: number) => {
    for (const d of (byParent.get(p) ?? []).slice().sort(sortSibs)) {
      out.push({ ...d, depth }); walk(d.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
})

// Drag-to-reorder AND drag-to-nest via native DnD. Dropping near a row's top/bottom
// edge reorders it as a sibling before/after the target; dropping on the middle
// nests it as a child of the target.
const byId = (id: string | null | undefined) => disciplines.value.find(d => d.id === id) || null
const childrenOf = (pid: string | null) => disciplines.value.filter(d => parentKey(d) === pid).sort(sortSibs)
// Is `nodeId` inside `ancestorId`'s subtree? (blocks dropping a row into its own descendants)
function isDescendant(nodeId: string, ancestorId: string) {
  let cur = byId(nodeId); const seen = new Set<string>()
  while (cur && cur.parent_id && !seen.has(cur.id)) {
    seen.add(cur.id)
    if (cur.parent_id === ancestorId) return true
    cur = byId(cur.parent_id)
  }
  return false
}

const draggingId = ref<string | null>(null)
const dropTarget = ref<{ id: string; mode: 'before' | 'after' | 'inside' } | null>(null)
const dropClass = (d: Disc) => {
  if (dropTarget.value?.id !== d.id) return ''
  return dropTarget.value.mode === 'inside' ? 'ring-2 ring-inset ring-primary/40 bg-primary/5'
    : dropTarget.value.mode === 'before' ? 'shadow-[inset_0_2px_0_0_var(--brand-primary)]'
    : 'shadow-[inset_0_-2px_0_0_var(--brand-primary)]'
}

function onDragStart(d: Disc, e: DragEvent) {
  draggingId.value = d.id
  if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', d.id) }
}
function onDragOver(d: Disc, e: DragEvent) {
  const dragId = draggingId.value
  if (!dragId || dragId === d.id || isDescendant(d.id, dragId)) { dropTarget.value = null; return }
  e.preventDefault()
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const y = e.clientY - r.top
  const mode = y < r.height * 0.28 ? 'before' : y > r.height * 0.72 ? 'after' : 'inside'
  dropTarget.value = { id: d.id, mode }
}
function onDragEnd() { draggingId.value = null; dropTarget.value = null }

async function onDrop(d: Disc) {
  const dragged = byId(draggingId.value)
  const target = byId(d.id)
  const mode = dropTarget.value?.mode
  onDragEnd()
  if (!dragged || !target || dragged.id === target.id || !mode) return
  if (isDescendant(target.id, dragged.id)) return

  const groupKey = mode === 'inside' ? target.id : parentKey(target)
  dragged.parent_id = groupKey
  const sibs = disciplines.value.filter(x => parentKey(x) === groupKey && x.id !== dragged.id).sort(sortSibs)
  let at = sibs.length
  if (mode !== 'inside') { const ti = sibs.findIndex(x => x.id === target.id); at = mode === 'before' ? ti : ti + 1 }
  sibs.splice(at, 0, dragged)
  sibs.forEach((x, i) => { x.sort_order = i })

  await Promise.all([
    (db.from as any)('disciplines').update({ parent_id: dragged.parent_id }).eq('id', dragged.id),
    ...sibs.map(x => (db.from as any)('disciplines').update({ sort_order: x.sort_order }).eq('id', x.id)),
  ])
}
// Parent options exclude self + descendants when editing (cycle-safe).
const parentOptions = computed(() => {
  const banned = new Set<string>()
  if (editingId.value) {
    banned.add(editingId.value)
    let added = true
    while (added) { added = false; for (const d of disciplines.value) if (d.parent_id && banned.has(d.parent_id) && !banned.has(d.id)) { banned.add(d.id); added = true } }
  }
  return disciplines.value.filter(d => !banned.has(d.id))
})

async function load() {
  loading.value = true
  const [{ data: o }, { data: discs }, cat] = await Promise.all([
    (db.from as any)('organisations').select('name, org_level').eq('id', orgId.value).single(),
    (db.from as any)('disciplines').select('id, org_id, name, code, parent_id, sort_order, applies_to').eq('org_id', orgId.value).order('sort_order').order('name'),
    // null = every field this body has. A requirement carries its own person-type
    // scope, so the PICKER must not be filtered by one — GNZ's fields target
    // 'gymnast', not 'member', and would otherwise never appear.
    // includeAge: "Age" is the virtual field that makes "a junior is anyone under
    // 16" an ordinary requirement rather than a special case.
    loadFieldCatalogue(orgId.value!, null, { includeAge: true }),
  ])
  org.value = o ?? null
  disciplines.value = discs ?? []
  catalogue.value = cat ?? []
  // Requirements for every discipline in the org — the parent chain needs them.
  allReqs.value = await dr.loadRequirements(disciplines.value.map(d => d.id))
  loading.value = false
}
// Own requirement rows, in sort order.
const reqsOf = (id: string) => allReqs.value.filter(r => r.discipline_id === id).sort((a, b) => a.sort_order - b.sort_order)
const reqCount = (id: string) => reqsOf(id).length
/** The at-a-glance answer to "what does this discipline demand?" — names the first
 *  couple of fields rather than just counting them. */
const reqSummary = (id: string) => {
  const rows = reqsOf(id)
  const names = rows.slice(0, 2).map(r => fieldLabel(r.field_key))
  return rows.length > 2 ? `${names.join(' · ')} +${rows.length - 2} more` : names.join(' · ')
}

const editorOpen = ref(false)
function openNew(parentId: string | null = null) { resetForm(); form.parent_id = parentId; editorOpen.value = true }
function startEdit(d: Disc) {
  editingId.value = d.id
  form.name = d.name; form.code = d.code ?? ''; form.parent_id = d.parent_id
  form.applies_to = [...(d.applies_to ?? [])]
  form.reqs = reqsOf(d.id).map(r => ({ key: r.id, field_key: r.field_key, operator: r.operator, value: r.value, exempt: r.exempt, message: r.message ?? '' }))
  editorOpen.value = true
}
function resetForm() {
  editingId.value = null
  form.name = ''; form.code = ''; form.parent_id = null; form.applies_to = []; form.reqs = []
}

async function save() {
  if (!form.name.trim()) { toast.add({ severity: 'warn', summary: 'Name is required', life: 2500 }); return }
  const badRange = form.reqs.find(r => RANGE_OPERATORS.includes(r.operator) && !r.exempt
    && Array.isArray(r.value) && r.value[0] != null && r.value[1] != null && Number(r.value[0]) > Number(r.value[1]))
  if (badRange) { toast.add({ severity: 'warn', summary: `${fieldLabel(badRange.field_key)}: the "from" must not be greater than the "to"`, life: 3500 }); return }
  const payload: any = {
    org_id: orgId.value, name: form.name.trim(), code: form.code.trim() || null, parent_id: form.parent_id,
    applies_to: form.applies_to.length ? form.applies_to : null,
  }
  let id = editingId.value
  if (id) await (db.from as any)('disciplines').update(payload).eq('id', id)
  else {
    // New rows go to the end of their sibling group.
    const sibCount = disciplines.value.filter(x => parentKey(x) === (form.parent_id && disciplines.value.some(y => y.id === form.parent_id) ? form.parent_id : null)).length
    const { data } = await (db.from as any)('disciplines').insert({ ...payload, sort_order: sibCount }).select('id').maybeSingle()
    id = data?.id ?? null
  }
  // Requirements: delete-then-insert scoped to the discipline (the DisciplineLinker
  // idiom). Rows with no field chosen yet are inert, so drop them.
  if (id) await dr.saveRequirements(id, form.reqs.filter(r => r.field_key).map(draftToReq))
  resetForm(); editorOpen.value = false; await load()
  toast.add({ severity: 'success', summary: 'Discipline saved', life: 2000 })
}
async function remove(d: Disc) { await (db.from as any)('disciplines').delete().eq('id', d.id); if (editingId.value === d.id) resetForm(); await load() }

watch(orgId, () => { if (orgId.value) load() }, { immediate: true })
</script>

<template>
  <div class="p-3 sm:p-6 min-h-full flex flex-col">
    <div class="flex flex-col md:flex-row gap-4 md:gap-6 flex-1 min-h-0">
      <SettingsNav />
      <div class="flex-1 min-w-0 space-y-5">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h1 class="text-lg sm:text-2xl font-semibold text-gray-900">Disciplines</h1>
        <p class="text-sm text-gray-500">Canonical categories your member clubs map their groups & events to. Build a hierarchy (e.g. Seniors › Premiers › B Grade).</p>
      </div>
      <Button v-if="isGoverning" label="New discipline" icon="pi pi-plus" class="shrink-0"
        style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="openNew()" />
    </div>

    <div v-if="!loading && !isGoverning" class="card p-6 text-sm text-gray-500">
      Disciplines are defined by governing bodies (associations / national bodies). This organisation is a club —
      map your groups & events to your governing bodies' disciplines from the group/event pages instead.
    </div>

    <template v-else>
      <!-- Add / edit — right-hand slide-out -->
      <Drawer v-model:visible="editorOpen" position="right" :header="editingId ? 'Edit discipline' : 'New discipline'"
        :style="{ width: '95vw', maxWidth: '440px' }">
        <div class="space-y-4">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-gray-600">Name</label>
            <InputText v-model="form.name" placeholder="e.g. Premiers" class="w-full" @keyup.enter="save" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-gray-600">Code <span class="text-gray-400 font-normal">— optional</span></label>
            <InputText v-model="form.code" placeholder="opt." class="w-full" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-gray-600">Parent discipline</label>
            <Select v-model="form.parent_id" :options="parentOptions" option-label="name" option-value="id"
              placeholder="None (top level)" show-clear filter class="w-full" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-gray-600">Applies to</label>
            <p class="text-xs text-gray-400 -mt-1">Which parts of the system this discipline can be linked to. Leave empty to apply everywhere.</p>
            <ChipMultiSelect v-model="form.applies_to" :options="DISCIPLINE_PARTS" option-label="label" option-value="value"
              placeholder="Everywhere (all parts)" show-toggle-all class="w-full" />
          </div>

          <!-- Requirements. One entry per field, closest-wins resolved — so this list
               IS what the discipline demands, not just what was typed here. Age is an
               ordinary row here ("Age · Is At Most · 15"), not a special case. -->
          <div class="flex flex-col gap-2 pt-2 border-t border-gray-100">
            <label class="text-xs font-medium text-gray-600">Requirements</label>
            <p class="text-xs text-gray-400 -mt-1">
              What a person in this discipline must have. Unmet requirements are flagged to the club —
              they never block a registration. Age counts from their date of birth, so
              “a junior is anyone under 16” is <span class="font-medium text-gray-600">Age · Is At Most · 15</span>.
            </p>

            <!-- Inherited, untouched: locked, naming the discipline that set it. -->
            <div v-for="e in untouchedInherited" :key="'inh-' + e.field_key"
              class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="flex items-center gap-1.5 text-xs text-gray-700">
                  <i class="pi pi-lock text-xs text-blue-400" />
                  <span class="font-medium truncate">{{ fieldLabel(e.field_key) }}</span>
                  <span class="text-gray-400">·</span>
                  <span class="text-gray-500 truncate">{{ e.rows.map(describeRow).join(' · ') }}</span>
                </div>
                <div class="text-xs text-gray-400 mt-0.5">Set on {{ e.source.disciplineName }}</div>
              </div>
              <button class="text-xs text-primary hover:underline shrink-0" @click="overrideInherited(e)">Override</button>
            </div>

            <!-- This discipline's own rows. -->
            <div v-for="(r, i) in form.reqs" :key="r.key" class="rounded-lg border border-gray-200 p-3 space-y-2">
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-medium text-gray-500">{{ i === 0 ? 'Must have' : 'and must have' }}</span>
                <button class="text-gray-300 hover:text-red-500" @click="form.reqs.splice(i, 1)"><i class="pi pi-times text-xs" /></button>
              </div>
              <select v-model="r.field_key" class="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
                style="-webkit-appearance:auto;appearance:auto;background:white;" @change="onFieldChange(r)">
                <option value="">Choose a field…</option>
                <optgroup label="Profile fields">
                  <option v-for="f in coreFields" :key="f.key" :value="f.key">{{ f.label }}</option>
                </optgroup>
                <optgroup :label="(org?.name || 'Organisation') + ' fields'">
                  <option v-for="f in customFields" :key="f.key" :value="f.key">{{ f.label }}</option>
                </optgroup>
              </select>
              <div class="flex gap-2">
                <select :value="operatorLabel(r)" class="text-sm border border-gray-300 rounded px-2 py-1.5"
                  :class="showsValue(r) ? 'w-1/2' : 'w-full'"
                  style="-webkit-appearance:auto;appearance:auto;background:white;"
                  @change="setOperator(r, ($event.target as HTMLSelectElement).value)">
                  <option v-for="o in optionsFor(r)" :key="o.label" :value="o.label">{{ o.label }}</option>
                </select>
                <!-- Is Between takes a pair. -->
                <div v-if="showsRange(r)" class="w-1/2 flex items-center gap-1">
                  <input type="number" :value="Array.isArray(r.value) ? r.value[0] : null" placeholder="from"
                    class="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
                    @input="setRange(r, 0, ($event.target as HTMLInputElement).value)" />
                  <span class="text-xs text-gray-400">–</span>
                  <input type="number" :value="Array.isArray(r.value) ? r.value[1] : null" placeholder="to"
                    class="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
                    @input="setRange(r, 1, ($event.target as HTMLInputElement).value)" />
                </div>
                <template v-else-if="showsValue(r)">
                  <select v-if="valueOptionsFor(r.field_key)" v-model="r.value" class="w-1/2 text-sm border border-gray-300 rounded px-2 py-1.5"
                    style="-webkit-appearance:auto;appearance:auto;background:white;">
                    <option v-for="v in valueOptionsFor(r.field_key)" :key="v" :value="v">{{ v }}</option>
                  </select>
                  <input v-else-if="isNumericField(r.field_key)" type="number" v-model="r.value" placeholder="Value"
                    class="w-1/2 text-sm border border-gray-300 rounded px-2 py-1.5" />
                  <InputText v-else v-model="r.value" placeholder="Value" class="w-1/2" />
                </template>
              </div>
              <InputText v-model="r.message" placeholder="Message shown on the flag (optional)" class="w-full" />

              <!-- Closest-wins deletes an ancestor's rule silently. Show what it replaced. -->
              <div v-if="shadowedFor(r.field_key)" class="text-xs text-gray-400 border-t border-gray-100 pt-2 flex items-start justify-between gap-2">
                <span class="min-w-0">
                  replaces
                  <span class="line-through">{{ fieldLabel(r.field_key) }} · {{ shadowedFor(r.field_key)!.rows.map(describeRow).join(' · ') }}</span>
                  from {{ shadowedFor(r.field_key)!.source.disciplineName }}
                </span>
                <button class="text-primary hover:underline shrink-0" @click="revertInherited(r.field_key)">Revert</button>
              </div>
            </div>

            <button class="text-xs text-primary hover:underline self-start" @click="addReq()">+ Add requirement</button>
            <p v-if="!form.reqs.length && !untouchedInherited.length" class="text-xs text-gray-400">
              Nothing required yet.
            </p>
          </div>
        </div>
        <template #footer>
          <div class="flex items-center justify-end gap-2">
            <Button label="Cancel" severity="secondary" text @click="editorOpen = false" />
            <Button :label="editingId ? 'Save changes' : 'Add discipline'" :disabled="!form.name.trim()"
              style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="save" />
          </div>
        </template>
      </Drawer>

      <!-- Hierarchy -->
      <div class="card p-0 overflow-hidden">
        <div class="px-5 py-2.5 border-b border-gray-100 text-sm font-semibold text-gray-700">Discipline hierarchy</div>
        <div v-if="loading" class="p-5 text-sm text-gray-400">Loading…</div>
        <div v-else-if="!disciplines.length" class="p-5 text-sm text-gray-400">No disciplines yet — click <span class="font-medium text-gray-600">New discipline</span> to add one.</div>
        <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <tbody>
            <tr v-for="d in ordered" :key="d.id" :data-id="d.id" draggable="true"
              class="border-b border-gray-50 hover:bg-gray-50/60 transition-shadow"
              :class="[dropClass(d), draggingId === d.id ? 'opacity-40' : '']"
              @dragstart="onDragStart(d, $event)" @dragover="onDragOver(d, $event)" @drop="onDrop(d)" @dragend="onDragEnd">
              <td class="w-8 pl-4">
                <i class="pi pi-bars text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing" v-tooltip.top="'Drag to reorder or nest'" />
              </td>
              <td class="px-3 py-2.5">
                <span :style="{ paddingLeft: (d.depth || 0) * 20 + 'px' }" class="inline-flex items-center gap-2">
                  <i v-if="d.depth" class="pi pi-angle-right text-gray-300 text-xs" />
                  <span class="font-medium text-gray-800">{{ d.name }}</span>
                </span>
                <!-- What this discipline demands, at a glance. -->
                <div v-if="reqCount(d.id)" class="text-xs text-gray-400 mt-0.5"
                  :style="{ paddingLeft: ((d.depth || 0) * 20 + (d.depth ? 18 : 0)) + 'px' }">
                  {{ reqSummary(d.id) }}
                </div>
              </td>
              <td class="px-3 py-2.5 text-gray-400 text-xs">{{ d.code || '' }}</td>
              <td class="px-3 py-2.5">
                <div v-if="d.applies_to && d.applies_to.length" class="flex flex-wrap gap-1">
                  <span v-for="p in d.applies_to" :key="p" class="text-xs font-medium text-gray-600 bg-gray-100 rounded px-1.5 py-0.5">{{ partLabel(p) }}</span>
                </div>
                <span v-else class="text-xs text-gray-400">Everywhere</span>
              </td>
              <td class="px-5 py-2.5 text-right whitespace-nowrap">
                <button class="text-xs text-gray-500 hover:text-gray-800 hover:underline mr-3" @click="openNew(d.id)">Add child</button>
                <button class="text-xs text-primary hover:underline mr-3" @click="startEdit(d)">Edit</button>
                <button class="text-xs text-red-600 hover:underline" @click="remove(d)">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>
    </template>
      </div>
    </div>
  </div>
</template>
