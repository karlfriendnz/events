<!--
  Disciplines manager — defined and managed by the governing body (NSO) itself.
  Scoped to the current org. Disciplines form a hierarchy (e.g. Seniors >
  Premiers > B Grade). Clubs map their groups/events to these (<DisciplineLinker>).
-->
<script setup lang="ts">
const db = useDb()
const { orgId } = useOrg()

// NB `disciplines.sport` still exists in the DB but is no longer captured here:
// a discipline's sport is implied by the governing body that owns it.
interface Disc {
  id: string; org_id: string; name: string; code: string | null; parent_id: string | null
  sort_order?: number; applies_to?: string[] | null; depth?: number
  /** The cast (mig 276) — the body's own type keys who take part. null = inherit. */
  person_type_keys?: string[] | null
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

const dr = useDisciplineRequirements()
const { loadFieldCatalogue } = usePersonFields()
const { loadOrgTypes } = useOrgFieldPolicy()

// Every requirement across this org's disciplines — the chain walk needs ancestors.
const allReqs = ref<DisciplineRequirement[]>([])
const catalogue = ref<PersonFieldDef[]>([])
const personTypes = ref<{ key: string; label: string }[]>([])
const fieldLabel = (key: string) => catalogue.value.find(f => f.key === key)?.label ?? key
const fieldOf = (key: string) => catalogue.value.find(f => f.key === key)
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
// (The cycle-safe parent picker lives in <DisciplineWizard> now, alongside the
// rest of the editor.)

async function load() {
  loading.value = true
  const [{ data: o }, { data: discs }, cat] = await Promise.all([
    (db.from as any)('organisations').select('name, org_level').eq('id', orgId.value).single(),
    // person_type_keys = the cast (276). MUST be selected: the wizard hydrates from
    // this row and writes back what it read, so an unselected column round-trips to
    // null and silently wipes the cast on the next save.
    (db.from as any)('disciplines').select('id, org_id, name, code, parent_id, sort_order, applies_to, person_type_keys').eq('org_id', orgId.value).order('sort_order').order('name'),
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
  // OUR OWN person types, for per-rule scoping — juniors' players and juniors'
  // coaches are not asked for the same things. Own-only (loadOrgTypes, not
  // resolvePersonTypes): a rule scoped to a type we don't define is unauthorable,
  // and a club's type links back to OURS rather than the other way round.
  personTypes.value = ((await loadOrgTypes(orgId.value!)) ?? [])
    .filter((t: any) => (t.kind ?? 'person') === 'person')
    .map((t: any) => ({ key: t.key, label: t.label }))
  // Requirements for every discipline in the org — the parent chain needs them.
  allReqs.value = await dr.loadRequirements(disciplines.value.map(d => d.id))
  loading.value = false
}
// Own requirement rows, in sort order.
const reqsOf = (id: string) => allReqs.value.filter(r => r.discipline_id === id).sort((a, b) => a.sort_order - b.sort_order)
const reqCount = (id: string) => reqsOf(id).length
/** The at-a-glance answer to "what does this discipline demand?" — the RULE, not
 *  just the field name: "Gender = Male" tells you what this row means; "Gender"
 *  only tells you where to click to find out. */
const shortRule = (r: DisciplineRequirement) => {
  const label = fieldLabel(r.field_key)
  if (r.exempt) return `${label} not required`
  switch (r.operator) {
    case 'Is Not Empty': return label                                  // "School" = must have a school
    case 'Is Empty': return `${label} must be blank`
    case 'Equals': return `${label} = ${r.value}`
    case 'Is Not': return `${label} ≠ ${r.value}`
    case 'Contains': return `${label} contains ${r.value}`
    case 'Is At Least': return `${label} ${r.value}+`
    case 'Is At Most': return `${label} up to ${r.value}`
    case 'Is Between': { const [lo, hi] = Array.isArray(r.value) ? r.value : [null, null]; return `${label} ${lo ?? ''}–${hi ?? ''}` }
    default: return label
  }
}
const reqSummary = (id: string) => {
  const rows = reqsOf(id)
  const parts = rows.slice(0, 2).map(shortRule)
  return rows.length > 2 ? `${parts.join(' · ')} +${rows.length - 2} more` : parts.join(' · ')
}

// The editor is <DisciplineWizard> — a stepped modal, because one flat form mixing
// "who is in this discipline" with "what must be recorded about them" read as mush.
const wizardOpen = ref(false)
const wizardEditing = ref<Disc | null>(null)
const wizardParent = ref<string | null>(null)
function openNew(parentId: string | null = null) { wizardEditing.value = null; wizardParent.value = parentId; wizardOpen.value = true }
function startEdit(d: Disc) { wizardEditing.value = d; wizardParent.value = null; wizardOpen.value = true }
async function onWizardSaved() { wizardOpen.value = false; await load() }
/** A field invented inside the wizard — the page owns the catalogue, so append it
 *  here rather than reloading (a reload mid-wizard would blow away the draft). */
function onFieldCreated(f: PersonFieldDef) { catalogue.value = [...catalogue.value, f] }

async function remove(d: Disc) { await (db.from as any)('disciplines').delete().eq('id', d.id); await load() }

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
      <!-- Create / edit runs through the stepped wizard. -->
      <DisciplineWizard v-if="wizardOpen" :editing="wizardEditing" :parent-id="wizardParent"
        :disciplines="disciplines" :all-reqs="allReqs" :catalogue="catalogue"
        :org-name="org?.name || 'Organisation'" :parts="DISCIPLINE_PARTS" :person-types="personTypes"
        @close="wizardOpen = false" @saved="onWizardSaved" @field-created="onFieldCreated" />

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
