<!--
  Settings · Types & fields. The live "two screens, one engine" editor (promoted
  from the /proto prototype). ONE source of truth = the club's OWN person/entity
  types (no NSO type-inheritance confusion; field-level NSO inheritance still
  applies via resolveFields). A top toggle switches People ↔ Entities.

  Each type: Layout · Fields · (Permissions for people / Members for entities) ·
  Reports — the shared engine. Permissions are a facet of a PERSON type
  (person_target_types.permissions + is_access); member slots define an ENTITY's
  roster (person_target_types.member_slots).
-->
<script setup lang="ts">
const db = useDb()
const { orgId } = useOrg()
const toast = useToast()
const { loadOrgTypes, resolveFields, fieldAppliesTo } = useOrgFieldPolicy()
const { CORE_SECTIONS, coreStatus, loadConfig } = useCoreFields()

const STANDARD = [
  { key: 'member', label: 'Member', is_access: false },
  { key: 'parent', label: 'Parent', is_access: false },
  { key: 'emergency_contact', label: 'Emergency contact', is_access: false },
  { key: 'committee', label: 'Committee', is_access: true },
  { key: 'manager', label: 'Manager', is_access: true },
  { key: 'admin', label: 'Admin', is_access: true },
]

const kind = ref<'person' | 'entity'>('person')
const allTypes = ref<any[]>([])
const fields = ref<any[]>([])
const coreConfig = ref<any>({ required: {}, enabled: {} })
const coreSections = computed(() => CORE_SECTIONS.map(s => ({
  ...s, fields: s.fields.map(f => ({ ...f, status: coreStatus(coreConfig.value, f) })).filter(f => f.status !== 'off'),
})))

const personTypes = computed(() => allTypes.value.filter(t => (t.kind ?? 'person') === 'person'))
const entityTypes = computed(() => allTypes.value.filter(t => t.kind === 'entity'))
const types = computed(() => kind.value === 'person' ? personTypes.value : entityTypes.value)

// editingKey null = the TYPES TABLE; set = the editor for that type.
const editingKey = ref<string | null>(null)
const selected = computed(() => types.value.find(t => t.key === editingKey.value) || null)
const tab = ref<'layout' | 'fields' | 'access' | 'dashboard' | 'profile' | 'menu'>('layout')
function openEditor(key: string, t: 'layout' | 'fields' | 'access' | 'dashboard' | 'profile' | 'menu') {
  const found = allTypes.value.find(x => x.key === key)
  if (found) kind.value = (found.kind ?? 'person') as any
  editingKey.value = key; tab.value = t
}
function backToTable() { editingKey.value = null }
const accessTabLabel = computed(() => kind.value === 'person' ? 'permissions' : 'members')
const editingField = ref<any>(null)
const loading = ref(true)
// Both kinds shown stacked (People, then Entities) — no toggle.
const sections = computed(() => [
  { id: 'people', kind: 'person' as const, access: false, label: 'People', hint: 'Members who manage themselves', list: personTypes.value.filter(t => !t.is_access) },
  { id: 'admins', kind: 'person' as const, access: true, label: 'Admins', hint: 'Manage other people (grant access)', list: personTypes.value.filter(t => t.is_access) },
  { id: 'entities', kind: 'entity' as const, access: false, label: 'Entities', hint: '', list: entityTypes.value },
])
// per-section add-a-type input models
const newLabels = reactive<Record<string, string>>({ people: '', admins: '', entities: '' })
const saving = ref(false)
const adding = ref(false)
const newLabel = ref('')

const applicableFields = computed(() =>
  selected.value ? fields.value.filter(f => fieldAppliesTo(f, selected.value!.key)) : [])
const fieldTargetOptions = computed(() =>
  selected.value ? [{ key: selected.value.key, label: selected.value.label }] : [])
const personTypeOptions = computed(() => personTypes.value.map(t => ({ label: t.label, value: t.key })))

function slugify(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') }

// ── Drag ordering (STANDING RULE: ordering is drag). Reorder person/entity
// types; persists person_target_types.sort_order for the current kind. ──
const dragType = ref<any>(null)
const dropMark = ref<{ key: string; pos: 'before' | 'after' } | null>(null)
function onTypeDragStart(t: any, e: DragEvent) {
  dragType.value = t
  if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', t.key) }
}
function onTypeDragOver(e: DragEvent, t: any) {
  if (!dragType.value || dragType.value.key === t.key) return
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  dropMark.value = { key: t.key, pos: (e.clientY - r.top) < r.height / 2 ? 'before' : 'after' }
}
function resetTypeDrag() { dragType.value = null; dropMark.value = null }
async function onTypeDrop(target: any) {
  const g = dragType.value
  const pos = dropMark.value?.key === target.key ? dropMark.value.pos : 'after'
  resetTypeDrag()
  if (!g || g.key === target.key) return
  const gKind = (g.kind ?? 'person')
  if ((target.kind ?? 'person') !== gKind || !!g.is_access !== !!target.is_access) return // don't reorder across sections
  const siblings = allTypes.value.filter(x => (x.kind ?? 'person') === gKind && !!x.is_access === !!g.is_access)
  const list = siblings.filter(x => x.key !== g.key)
  const at = list.indexOf(target) + (pos === 'after' ? 1 : 0)
  list.splice(at, 0, g)
  await Promise.all(list.map((row, idx) =>
    row.sort_order === idx ? null : (db.from as any)('person_target_types').update({ sort_order: idx }).eq('id', row.id).then(() => { row.sort_order = idx })
  ))
  const others = allTypes.value.filter(x => !((x.kind ?? 'person') === gKind && !!x.is_access === !!g.is_access))
  allTypes.value = [...others, ...list].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
}

// ── Dashboard tab (mig 245): what this person type SEES ──
const LANDING_OPTIONS = [
  { label: 'Dashboard', value: null as string | null },
  { label: 'Classes', value: '/groups' },
  { label: 'Events', value: '/events' },
  { label: 'People', value: '/people' },
  { label: 'Memberships', value: '/memberships' },
  { label: 'Bookings', value: '/bookables?tab=bookings' },
  { label: 'Attendance', value: '/attendance' },
  { label: 'My profile & contacts', value: '/account/profiles' },
]
async function saveLanding(path: string | null) {
  if (!selected.value) return
  selected.value.landing_path = path
  await (db.from as any)('person_target_types').update({ landing_path: path }).eq('id', selected.value.id)
}

// ── Menu Items: which left-menu items THIS type sees (mig 254) ────────────────
// person_target_types.menu_items = string[] of CLUB_MENU hrefs. null = not
// customised → the nav falls back to the permission-driven default.
const { CLUB_MENU } = useClubMenu()
const menuCustomised = computed(() => Array.isArray(selected.value?.menu_items))
async function persistMenuItems(v: string[] | null) {
  if (!selected.value) return
  selected.value.menu_items = v
  await (db.from as any)('person_target_types').update({ menu_items: v }).eq('id', selected.value.id)
}
function menuItemOn(href: string): boolean {
  const mi = selected.value?.menu_items
  return Array.isArray(mi) ? mi.includes(href) : false
}
function toggleMenuItem(href: string, on: boolean) {
  const base = Array.isArray(selected.value?.menu_items) ? [...selected.value!.menu_items] : []
  const next = on ? [...new Set([...base, href])] : base.filter((h: string) => h !== href)
  persistMenuItems(next)
}
// Turn customisation on (seed with everything, untick from there) or off (→ null).
function setMenuCustomised(on: boolean) { persistMenuItems(on ? CLUB_MENU.map(i => i.href) : null) }
// Club-dashboard template per type (dashboard_templates.user_type = the type key)
const typeDashTemplate = ref<boolean | null>(null) // null = loading
watch([selected, tab], async () => {
  if (!selected.value || tab.value !== 'dashboard') return
  typeDashTemplate.value = null
  const { data } = await (db.from as any)('dashboard_templates')
    .select('user_type').eq('org_id', orgId.value).eq('user_type', selected.value.key).maybeSingle()
  typeDashTemplate.value = !!data
})
async function resetTypeDashboard() {
  if (!selected.value) return
  await (db.from as any)('dashboard_templates').delete().eq('org_id', orgId.value).eq('user_type', selected.value.key)
  typeDashTemplate.value = false
}
async function resetTypeProfileDashboard() {
  if (!selected.value) return
  selected.value.profile_dashboard = null
  await (db.from as any)('person_target_types').update({ profile_dashboard: null }).eq('id', selected.value.id)
}

async function load() {
  loading.value = true
  const id = orgId.value
  if (!id) { loading.value = false; return }
  const [all, flds, ce] = await Promise.all([loadOrgTypes(id), resolveFields(id), loadConfig()])
  coreConfig.value = ce
  allTypes.value = (all ?? []).map((t: any) => ({
    ...t, permissions: t.permissions ?? {}, member_slots: t.member_slots ?? [],
  }))
  fields.value = flds
  loading.value = false
}

async function seedStandard() {
  const existing = new Set(personTypes.value.map(t => t.key))
  const rows = STANDARD.filter(s => !existing.has(s.key)).map((s, i) => ({
    org_id: orgId.value, key: s.key, label: s.label, kind: 'person',
    is_access: s.is_access, min_count: 0, max_count: null, sort_order: personTypes.value.length + i,
  }))
  if (rows.length) {
    const { error } = await (db.from as any)('person_target_types').insert(rows)
    if (error) { toast.add({ severity: 'error', summary: 'Failed', detail: error.message, life: 4000 }); return }
  }
  await load()
  toast.add({ severity: 'success', summary: 'Standard types added', life: 2000 })
}

const newEntityLabel = ref('')
async function addType(sec: any) {
  const label = (newLabels[sec.id] ?? '').trim()
  if (!label || !orgId.value) return
  const count = allTypes.value.filter(x => (x.kind ?? 'person') === sec.kind && !!x.is_access === !!sec.access).length
  const { error } = await (db.from as any)('person_target_types').insert({
    org_id: orgId.value, key: slugify(label) || 'type_' + Date.now(), label,
    kind: sec.kind, is_access: !!sec.access, min_count: 0, max_count: null, sort_order: count,
  })
  if (error) { toast.add({ severity: 'error', summary: 'Failed', detail: error.message, life: 4000 }); return }
  newLabels[sec.id] = ''; adding.value = false
  await load(); openEditor(slugify(label), 'layout')
}
async function removeType(t: any) {
  if (!confirm(`Delete the "${t.label}" type?`)) return
  await (db.from as any)('person_target_types').delete().eq('id', t.id)
  editingKey.value = null; await load()
}

// Duplicate a person/entity type — copies the type row (permissions / member slots
// / landing / profile dashboard), shares its OWN fields (adds the new key to their
// targets[]) and copies its form LAYOUT (profile_forms). Works for both kinds.
async function duplicateType(t: any) {
  if (!orgId.value) return
  const existing = new Set(allTypes.value.map(x => x.key))
  const base = slugify(t.label + ' copy') || 'type_copy'
  let key = base, n = 2
  while (existing.has(key)) key = `${base}_${n++}`
  const { data: src } = await (db.from as any)('person_target_types')
    .select('label, kind, is_access, permissions, member_slots, min_count, max_count, landing_path, profile_dashboard')
    .eq('id', t.id).maybeSingle()
  const s = src ?? t
  const count = allTypes.value.filter(x => (x.kind ?? 'person') === (s.kind ?? 'person')).length
  const { error } = await (db.from as any)('person_target_types').insert({
    org_id: orgId.value, key, label: `${s.label} (copy)`, kind: s.kind ?? 'person',
    is_access: !!s.is_access, permissions: s.permissions ?? {}, member_slots: s.member_slots ?? [],
    min_count: s.min_count ?? 0, max_count: s.max_count ?? null,
    landing_path: s.landing_path ?? null, profile_dashboard: s.profile_dashboard ?? null,
    sort_order: count,
  })
  if (error) { toast.add({ severity: 'error', summary: 'Could not duplicate', detail: error.message, life: 4000 }); return }
  // Share the source type's OWN fields with the copy (inherited/NSO fields flow in on their own).
  const own = fields.value.filter((f: any) => !f.inherited && fieldAppliesTo(f, t.key))
  for (const f of own) {
    const targets = Array.from(new Set([...(Array.isArray(f.targets) && f.targets.length ? f.targets : (f.target ? [f.target] : [])), key]))
    await (db.from as any)('field_definitions').update({ targets }).eq('id', f.id)
  }
  // Copy the form layout if the source type has a designed one.
  const { data: pf } = await (db.from as any)('profile_forms').select('config').eq('org_id', orgId.value).eq('type_key', t.key).maybeSingle()
  if (pf?.config) await (db.from as any)('profile_forms').insert({ org_id: orgId.value, type_key: key, config: pf.config })
  await load(); openEditor(key, 'layout')
  toast.add({ severity: 'success', summary: `Duplicated "${t.label}"`, life: 2200 })
}

async function addField(p: any) {
  const { error } = await (db.from as any)('field_definitions').insert({
    org_id: orgId.value, label: p.label, field_type: p.type, is_required: p.required,
    options: p.options, help_text: p.placeholder || null,
    targets: (p.targets?.length ? p.targets : [selected.value?.key]),
    target: (p.targets?.length ? p.targets[0] : selected.value?.key),
    rules: [], sort_order: fields.value.length,
  })
  if (error) { toast.add({ severity: 'error', summary: 'Failed', detail: error.message, life: 4000 }); return }
  toast.add({ severity: 'success', summary: `Field "${p.label}" added`, life: 2000 })
  fields.value = await resolveFields(orgId.value!)
}
async function onFieldChanged() { fields.value = await resolveFields(orgId.value!); editingField.value = null }
watch(editingKey, () => { editingField.value = null })

async function savePermissions() {
  const t = selected.value
  if (!t) return
  saving.value = true
  await (db.from as any)('person_target_types').update({ permissions: t.permissions, is_access: !!t.is_access }).eq('id', t.id)
  saving.value = false
  toast.add({ severity: 'success', summary: 'Saved', life: 2000 })
}

// Entity member slots
function addSlot() {
  selected.value!.member_slots.push({ person_type: personTypes.value[0]?.key ?? 'member', label: '', min: 1, max: null, role: '' })
}
function removeSlot(i: number) { selected.value!.member_slots.splice(i, 1) }
async function saveMembers() {
  const t = selected.value
  if (!t) return
  saving.value = true
  await (db.from as any)('person_target_types').update({ member_slots: t.member_slots }).eq('id', t.id)
  saving.value = false
  toast.add({ severity: 'success', summary: 'Members saved', life: 2000 })
}

watch(orgId, load, { immediate: true })
</script>

<template>
  <div class="p-3 sm:p-6 flex flex-col md:flex-row gap-4 md:gap-6">
    <SettingsNav />
    <div class="flex-1 min-w-0">
      <div class="mb-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold text-gray-900">People &amp; Entities</h1>
          <p class="text-sm text-gray-500">The kinds of people and entities your club tracks — their fields, profile layout, and what they can do.</p>
        </div>
        <button v-if="personTypes.length" class="text-xs text-primary hover:underline shrink-0 self-start sm:self-auto" @click="seedStandard">+ Add standard set</button>
      </div>

      <div v-if="loading" class="text-sm text-gray-400">Loading…</div>

      <!-- STACKED sections: People, then Entities (no toggle) -->
      <div v-else-if="!editingKey" class="space-y-8">
        <section v-for="sec in sections" :key="sec.kind" class="space-y-2">
          <h2 class="text-xs font-bold uppercase tracking-wide text-gray-400">{{ sec.label }}<span v-if="sec.hint" class="ml-2 font-normal normal-case text-gray-300">{{ sec.hint }}</span></h2>
          <div class="card p-0 overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
                  <th class="text-left px-4 sm:px-5 py-2.5 font-medium">{{ sec.kind === 'person' ? 'Person type' : 'Entity type' }}</th>
                  <th class="text-left px-4 py-3 font-medium w-24">Form</th>
                  <th class="text-left px-4 py-3 font-medium w-36">{{ sec.kind === 'person' ? 'Permissions' : 'Members' }}</th>
                  <th v-if="sec.kind === 'person'" class="text-left px-4 py-3 font-medium w-28">Landing page</th>
                  <th v-if="sec.kind === 'person'" class="text-left px-4 py-3 font-medium w-24">Profile</th>
                  <th v-if="sec.kind === 'person'" class="text-left px-4 py-3 font-medium w-24">Menu items</th>
                  <th class="w-16" />
                </tr>
              </thead>
              <tbody>
                <tr v-for="t in sec.list" :key="t.key"
                  class="group border-b border-gray-50 hover:bg-gray-50/60"
                  :class="dropMark?.key === t.key ? (dropMark.pos === 'before' ? 'shadow-[inset_0_2px_0_0_var(--brand-primary)]' : 'shadow-[inset_0_-2px_0_0_var(--brand-primary)]') : ''"
                  draggable="true" @dragstart="onTypeDragStart(t, $event)" @dragover.prevent="onTypeDragOver($event, t)"
                  @drop.prevent="onTypeDrop(t)" @dragend="resetTypeDrag">
                  <td class="px-4 sm:px-5 py-2.5">
                    <span class="font-medium text-gray-800 inline-flex items-center gap-1.5">
                      <i class="pi pi-bars text-gray-300 group-hover:text-gray-600 text-xs cursor-grab active:cursor-grabbing shrink-0 transition-colors" title="Drag to reorder" />
                      {{ t.label }}<i v-if="t.is_access" v-tooltip.top="'Grants access (permissions)'" class="pi pi-shield text-[10px] text-emerald-400" /></span>
                  </td>
                  <td class="px-4 py-3">
                    <button class="text-primary hover:underline inline-flex items-center gap-1" @click="openEditor(t.key, 'layout')"><i class="pi pi-window-maximize text-[10px]" />Form</button>
                  </td>
                  <td class="px-4 py-3">
                    <button class="text-primary hover:underline inline-flex items-center gap-1 whitespace-nowrap" @click="openEditor(t.key, 'access')"><i class="pi pi-shield text-[10px]" />{{ sec.kind === 'person' ? 'Permissions' : 'Members' }}</button>
                  </td>
                  <td v-if="sec.kind === 'person'" class="px-4 py-3">
                    <NuxtLink :to="`/dashboard?editTemplate=${t.key}`" class="text-primary hover:underline inline-flex items-center gap-1 whitespace-nowrap"><i class="pi pi-th-large text-[10px]" />Landing page</NuxtLink>
                  </td>
                  <td v-if="sec.kind === 'person'" class="px-4 py-3">
                    <button class="text-primary hover:underline inline-flex items-center gap-1 whitespace-nowrap" @click="openEditor(t.key, 'profile')"><i class="pi pi-user text-[10px]" />Profile</button>
                  </td>
                  <td v-if="sec.kind === 'person'" class="px-4 py-3">
                    <button class="text-primary hover:underline inline-flex items-center gap-1 whitespace-nowrap" @click="openEditor(t.key, 'menu')"><i class="pi pi-bars text-[10px]" />Menu items</button>
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex items-center justify-center gap-3">
                      <button class="text-gray-300 hover:text-primary" title="Duplicate type" @click="duplicateType(t)"><i class="pi pi-copy text-sm" /></button>
                      <button class="text-gray-300 hover:text-red-500" title="Delete type" @click="removeType(t)"><i class="pi pi-trash text-sm" /></button>
                    </div>
                  </td>
                </tr>
                <!-- add-a-type row -->
                <tr class="bg-gray-50/40">
                  <td :colspan="sec.kind === 'person' ? 7 : 4" class="px-4 sm:px-5 py-2.5">
                    <div class="flex items-center gap-2 max-w-md">
                      <InputText v-model="newLabels[sec.id]"
                        :placeholder="sec.id === 'admins' ? 'Add an admin type (e.g. Coach)' : sec.kind === 'person' ? 'Add a person type (e.g. Member)' : 'Add an entity type (e.g. Team)'"
                        class="flex-1" size="small" @keyup.enter="addType(sec)" />
                      <Button icon="pi pi-plus" label="Add" size="small"
                        :disabled="!(newLabels[sec.id] ?? '').trim()"
                        @click="addType(sec)" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <!-- EDITOR for one type -->
      <div v-else-if="selected" class="space-y-3">
        <div class="flex items-center gap-2 flex-wrap">
          <button class="text-sm text-gray-500 hover:text-primary inline-flex items-center gap-1" @click="backToTable"><i class="pi pi-arrow-left text-xs" /> All types</button>
          <span class="text-gray-300">/</span>
          <span class="text-sm font-semibold text-gray-800 inline-flex items-center gap-1.5">{{ selected.label }}<i v-if="selected.is_access" v-tooltip.top="'Grants access'" class="pi pi-shield text-[10px] text-emerald-400" /></span>
        </div>
        <div class="flex gap-1 border-b border-gray-200">
          <button v-for="tb in (kind === 'person' ? ['layout','fields','access','dashboard','profile','menu'] : ['layout','fields','access'])" :key="tb"
            class="px-3 py-2 text-sm font-medium border-b-2 -mb-px capitalize transition-colors whitespace-nowrap"
            :class="tab === tb ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'"
            @click="tab = tb as any">{{ tb === 'access' ? accessTabLabel : tb === 'profile' ? 'Profile dashboard' : tb === 'layout' ? 'Form' : tb === 'menu' ? 'Menu items' : tb }}</button>
        </div>

          <!-- DASHBOARD: what this type sees after login (landing + club dashboard) -->
          <div v-show="tab === 'dashboard'" class="space-y-4 max-w-2xl">
            <div class="card p-5 space-y-2">
              <p class="text-sm font-semibold text-gray-800">Landing page</p>
              <p class="text-xs text-gray-400">Where a {{ selected?.label }} lands right after logging in.</p>
              <Select :model-value="selected?.landing_path ?? null" :options="LANDING_OPTIONS"
                optionLabel="label" optionValue="value" class="w-full sm:w-72"
                @update:model-value="saveLanding" />
            </div>
            <div class="card p-5 space-y-2">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <p class="text-sm font-semibold text-gray-800">Club dashboard</p>
                  <p class="text-xs text-gray-400">The widget layout a {{ selected?.label }} starts with on the main dashboard.</p>
                </div>
                <span class="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                  :class="typeDashTemplate ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'">
                  {{ typeDashTemplate === null ? '…' : typeDashTemplate ? 'Custom' : 'Standard' }}
                </span>
              </div>
              <div class="flex items-center gap-4">
                <NuxtLink :to="`/dashboard?editTemplate=${selected?.key}`" class="text-sm font-medium text-primary hover:underline">Edit ›</NuxtLink>
                <button v-if="typeDashTemplate" type="button" class="text-sm text-gray-400 hover:text-red-500" @click="resetTypeDashboard">Reset to standard</button>
              </div>
            </div>
          </div>

          <!-- PROFILE DASHBOARD: the Dashboard tab shown on this type's profile page -->
          <div v-show="tab === 'profile'" class="space-y-4 max-w-2xl">
            <div class="card p-5 space-y-2">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <p class="text-sm font-semibold text-gray-800">Profile dashboard</p>
                  <p class="text-xs text-gray-400">The Dashboard tab shown on every {{ selected?.label }}'s profile page (their own memberships, invoices, notes…).</p>
                </div>
                <span class="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                  :class="selected?.profile_dashboard ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'">
                  {{ selected?.profile_dashboard ? 'Custom' : 'Standard' }}
                </span>
              </div>
              <div class="flex items-center gap-4">
                <NuxtLink :to="`/settings/profile-dashboard?type=${selected?.key}`" class="text-sm font-medium text-primary hover:underline">Edit ›</NuxtLink>
                <button v-if="selected?.profile_dashboard" type="button" class="text-sm text-gray-400 hover:text-red-500" @click="resetTypeProfileDashboard">Reset to standard</button>
              </div>
            </div>
          </div>

          <!-- MENU ITEMS: which left-menu items this type sees -->
          <div v-show="tab === 'menu'" class="space-y-4 max-w-2xl">
            <div class="card p-5 space-y-3">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <p class="text-sm font-semibold text-gray-800">Menu items</p>
                  <p class="text-xs text-gray-400">Choose exactly which left-menu items a {{ selected?.label }} sees. Off = decide automatically from their permissions.</p>
                </div>
                <ToggleSwitch :modelValue="menuCustomised" @update:modelValue="setMenuCustomised" />
              </div>
              <div v-if="menuCustomised" class="border-t border-gray-100 -mx-5 px-5 pt-1 divide-y divide-gray-50">
                <label v-for="m in CLUB_MENU" :key="m.href" class="flex items-center gap-3 py-2 cursor-pointer">
                  <input type="checkbox" :checked="menuItemOn(m.href)" class="accent-primary w-4 h-4"
                    @change="toggleMenuItem(m.href, ($event.target as HTMLInputElement).checked)" />
                  <i :class="['pi', m.icon, 'text-gray-400 text-sm w-4 text-center']" />
                  <span class="text-sm text-gray-700">{{ m.label }}</span>
                </label>
              </div>
              <p v-else class="text-xs text-gray-400 border-t border-gray-100 pt-3">Using the default menu based on this type's permissions.</p>
            </div>
          </div>

          <!-- LAYOUT -->
          <div v-show="tab === 'layout'">
            <PersonFormBuilder :key="selected.key" :target="selected.key" :target-label="selected.label" :org-id="orgId!" :entity="kind === 'entity'" />
          </div>

          <!-- FIELDS -->
          <div v-show="tab === 'fields'" class="space-y-3">
            <!-- global core fields block (people only) -->
            <div v-if="kind === 'person'" class="card p-0 overflow-hidden border-dashed">
              <div class="px-4 py-2 bg-gray-50 border-b border-gray-100">
                <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide"><i class="pi pi-lock text-[10px] mr-1" />Global fields</span>
              </div>
              <div v-for="s in coreSections" :key="s.key">
                <div class="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">{{ s.label }}</div>
                <div v-for="f in s.fields" :key="f.key" class="px-4 py-1.5 border-b border-gray-50 flex items-center justify-between text-sm text-gray-500">
                  <span>{{ f.label }}</span>
                  <span class="text-[10px] uppercase tracking-wide font-medium"
                    :class="f.status === 'required' ? 'text-rose-500' : f.status === 'conditional' ? 'text-amber-500' : 'text-gray-300'">
                    {{ f.status === 'required' ? 'required' : f.status === 'conditional' ? 'when needed' : 'optional' }}
                  </span>
                </div>
              </div>
              <p class="px-4 py-2 text-[11px] text-gray-400">Personal details &amp; communication are the same for every person type and always show on the profile.</p>
            </div>

            <div class="card p-0 overflow-hidden">
              <div class="px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">{{ selected.label }} fields</div>
              <div v-if="!applicableFields.length" class="px-4 py-3 text-sm text-gray-400">No fields yet.</div>
              <button v-for="f in applicableFields" :key="f.id" type="button"
                class="w-full text-left px-4 py-2 border-b border-gray-50 flex items-center justify-between text-sm hover:bg-gray-50 transition-colors"
                :class="editingField?.id === f.id ? 'bg-gray-50' : ''" @click="editingField = f">
                <span class="flex items-center gap-1.5 text-gray-800">
                  <i v-if="f.inherited" class="pi pi-lock text-[10px] text-blue-400" />{{ f.label }}
                </span>
                <span class="flex items-center gap-2">
                  <span class="text-[11px] text-gray-400">{{ f.field_type }}</span>
                  <span v-if="f.is_required" class="text-[9px] uppercase tracking-wide text-rose-500">required</span>
                  <span v-if="f.inherited" class="text-[9px] uppercase tracking-wide text-blue-400">NSO</span>
                  <i v-else class="pi pi-pencil text-[10px] text-gray-300" />
                </span>
              </button>
            </div>
            <ProtoFieldEditor v-if="editingField" :key="editingField.id" :field="editingField"
              @saved="onFieldChanged" @deleted="onFieldChanged" @close="editingField = null" />
            <FieldCreator v-else :person-types="fieldTargetOptions" @add="addField" />
          </div>

          <!-- ACCESS: permissions (people) / members (entities) -->
          <div v-show="tab === 'access'" class="space-y-3 max-w-2xl">
            <template v-if="kind === 'person'">
              <div class="flex items-center justify-between">
                <p class="text-xs text-gray-500">What a {{ selected.label }} can do across the club. A person's real access is the union of all their people types.</p>
                <label class="flex items-center gap-2 text-xs text-gray-600 shrink-0"><ToggleSwitch v-model="selected.is_access" />Grants access</label>
              </div>
              <PermissionGrid v-model="selected.permissions" />
              <div class="flex justify-end">
                <Button label="Save permissions" size="small" :loading="saving" @click="savePermissions" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
              </div>
            </template>
            <template v-else>
              <p class="text-xs text-gray-500">A {{ selected.label }} is made up of these people — pick the type, how many, and the role each gets.</p>
              <div class="card p-0 overflow-hidden">
                <div class="hidden sm:grid grid-cols-[1fr_90px_90px_1fr_32px] gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                  <span>People type</span><span>Min</span><span>Max</span><span>Default role</span><span></span>
                </div>
                <div v-for="(s, i) in selected.member_slots" :key="i" class="grid grid-cols-2 sm:grid-cols-[1fr_90px_90px_1fr_32px] gap-2 px-4 py-2.5 border-b border-gray-50 items-center">
                  <Select v-model="s.person_type" :options="personTypeOptions" optionLabel="label" optionValue="value" class="w-full" size="small" />
                  <InputNumber v-model="s.min" :min="0" class="w-full" size="small" inputClass="w-full" />
                  <InputNumber v-model="s.max" :min="0" class="w-full" size="small" inputClass="w-full" placeholder="∞" />
                  <InputText v-model="s.role" placeholder="e.g. Player" class="w-full" size="small" />
                  <button class="w-7 h-7 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50" @click="removeSlot(i)"><i class="pi pi-trash text-xs" /></button>
                </div>
                <div v-if="!selected.member_slots.length" class="px-4 py-3 text-sm text-gray-400">No member slots yet.</div>
              </div>
              <div class="flex items-center justify-between">
                <button class="text-sm font-medium text-primary hover:underline" @click="addSlot"><i class="pi pi-plus text-xs mr-1" />Add member slot</button>
                <Button label="Save members" size="small" :loading="saving" @click="saveMembers" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
              </div>
            </template>
          </div>

          <div class="pt-1">
            <button class="text-sm text-red-600 hover:underline" @click="removeType(selected)">Delete this type</button>
          </div>
        </div>
      <Toast />
    </div>
  </div>
</template>
