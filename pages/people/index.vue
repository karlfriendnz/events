<template>
  <div class="p-3 sm:p-6">
    <div class="flex items-center justify-between mb-6 gap-4 flex-wrap">
      <div>
        <h1 class="text-xl font-semibold text-surface-900">People</h1>
        <p class="text-sm text-surface-500 mt-0.5">
          Everyone in your organisation.
          <span v-if="!loading">{{ people.length }} {{ people.length === 1 ? 'person' : 'people' }}.</span>
        </p>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <IconField iconPosition="left">
          <InputIcon class="pi pi-search" />
          <InputText v-model="search" placeholder="Search people…" size="small" class="w-full sm:w-64" />
        </IconField>
        <!-- Per-tab column chooser (desktop table) -->
        <div ref="colMenuWrap" class="relative hidden md:block">
          <Button label="Columns" icon="pi pi-sliders-h" size="small" severity="secondary" outlined @click="colMenuOpen = !colMenuOpen" />
          <div v-if="colMenuOpen" class="absolute right-0 top-full mt-1.5 w-60 bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-1">
            <div class="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-400">Columns · {{ activeTabLabel }}</div>
            <label class="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-gray-400 cursor-not-allowed">
              <Checkbox :modelValue="true" :binary="true" disabled /><span>Name</span>
            </label>
            <label v-for="c in availableCols" :key="c.key" class="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-50 cursor-pointer text-sm">
              <Checkbox :modelValue="visibleColSet.has(c.key)" :binary="true" @update:modelValue="v => toggleCol(c.key, v)" />
              <span class="text-gray-700">{{ c.label }}</span>
            </label>
            <p v-if="!availableCols.length" class="px-3 py-2 text-xs text-gray-400">No columns available.</p>
          </div>
        </div>
        <Button label="Export" icon="pi pi-download" size="small" severity="secondary" outlined @click="exportCsv" />
        <Button label="Add person" icon="pi pi-plus" size="small"
          style="background:#1E2157;border-color:#1E2157" @click="openCreate" />
      </div>
    </div>

    <!-- Type filter: dropdown on mobile, tab strip on desktop -->
    <div class="md:hidden mb-4">
      <Select v-model="activeType" :options="typeTabs" option-label="label" option-value="key" class="w-full">
        <template #option="{ option }">
          <span class="flex-1">{{ option.label }}</span>
          <span class="ml-auto text-xs text-gray-400">{{ typeCounts[option.key] ?? 0 }}</span>
        </template>
      </Select>
    </div>
    <div class="hidden md:flex items-center gap-1 mb-4 border-b border-gray-200 overflow-x-auto overflow-y-hidden no-scrollbar">
      <button v-for="t in typeTabs" :key="t.key" type="button"
        class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap"
        :class="activeType === t.key ? 'border-[#1E2157] text-[#1E2157]' : 'border-transparent text-gray-500 hover:text-gray-800'"
        @click="activeType = t.key">
        {{ t.label }}
        <span class="text-xs px-1.5 rounded-full" :class="activeType === t.key ? 'bg-[#1E2157]/10 text-[#1E2157]' : 'bg-gray-100 text-gray-400'">{{ typeCounts[t.key] ?? 0 }}</span>
      </button>
    </div>

    <!-- Bulk actions -->
    <div v-if="selected.length" class="flex items-center gap-3 mb-3 px-3 py-2 rounded-lg bg-[#1E2157]/5 border border-[#1E2157]/15 flex-wrap">
      <span class="text-sm font-medium text-[#1E2157]">{{ selected.length }} selected</span>
      <span class="text-gray-300 hidden sm:inline">·</span>
      <span class="text-sm text-gray-500">Set type</span>
      <Select v-model="bulkType" :options="personTypes" optionLabel="label" optionValue="key"
        placeholder="Choose…" class="w-44" showClear size="small" />
      <Button label="Apply" size="small" :disabled="!bulkType"
        style="background:#1E2157;border-color:#1E2157" @click="bulkSetType(bulkType)" />
      <button class="text-xs text-gray-500 hover:text-gray-800" @click="bulkSetType(null)">Clear type</button>
      <span class="text-gray-300 hidden sm:inline">·</span>
      <button class="text-xs text-red-500 hover:text-red-700" @click="bulkDelete">Delete</button>
      <button class="text-xs text-gray-400 hover:text-gray-700 ml-auto" @click="selected = []">Deselect all</button>
    </div>

    <!-- Mobile: card list (table is desktop-only) -->
    <div class="md:hidden">
      <div v-if="loading" class="card p-6 text-center text-surface-400"><i class="pi pi-spin pi-spinner text-xl" /></div>
      <div v-else-if="!filtered.length" class="card p-10 text-center text-surface-400">
        <i class="pi pi-users text-3xl mb-3 block" />
        <p v-if="search">No people match “{{ search }}”.</p>
        <p v-else>No people yet.</p>
      </div>
      <div v-else class="space-y-2">
        <div v-for="p in filtered" :key="p.id"
          class="card p-3 flex items-center gap-3 cursor-pointer active:bg-gray-50 transition-colors"
          @click="openPerson(p)">
          <span class="inline-flex items-center justify-center w-10 h-10 rounded-full text-sm font-semibold text-white shrink-0 overflow-hidden"
            :style="p.photo_url ? {} : { background: avatarColor(p.id) }">
            <img v-if="p.photo_url" :src="p.photo_url" class="w-full h-full object-cover" />
            <span v-else>{{ initials(p) }}</span>
          </span>
          <div class="min-w-0 flex-1">
            <p class="font-medium text-surface-800 truncate">{{ p.first_name }} {{ p.last_name }}</p>
            <p class="text-xs text-surface-500 truncate">{{ p.email || p.phone || '—' }}</p>
            <div v-if="typeKeysOf(p).length || p.membership_type || p.dob" class="flex items-center gap-1.5 mt-1 flex-wrap">
              <Tag v-for="k in typeKeysOf(p)" :key="k" :value="typeLabel(k)" />
              <Tag v-if="p.membership_type" :value="p.membership_type" severity="secondary" />
              <span v-if="p.dob" class="text-[11px] text-surface-400">{{ age(p.dob) }} yrs</span>
            </div>
          </div>
          <button type="button" class="w-9 h-9 flex items-center justify-center text-surface-400 shrink-0" @click.stop="openMenu($event, p)">
            <i class="pi pi-ellipsis-v" />
          </button>
        </div>
      </div>
    </div>

    <div class="card overflow-x-auto hidden md:block">
      <DataTable :value="filtered" :loading="loading" row-hover striped-rows size="small"
        v-model:selection="selected" dataKey="id"
        paginator :rows="25" :rowsPerPageOptions="[25, 50, 100]"
        sortField="last_name" :sortOrder="1"
        @row-click="e => openPerson(e.data)" class="cursor-pointer">
        <template #empty>
          <div class="text-center py-12 text-surface-400">
            <i class="pi pi-users text-3xl mb-3 block" />
            <p v-if="search">No people match “{{ search }}”.</p>
            <p v-else>No people yet. Add your first person to get started.</p>
          </div>
        </template>

        <Column selectionMode="multiple" headerStyle="width:3rem" :exportable="false" />
        <Column field="last_name" header="Name" sortable>
          <template #body="{ data }">
            <div class="flex items-center gap-3">
              <span class="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold text-white shrink-0 overflow-hidden"
                :style="data.photo_url ? {} : { background: avatarColor(data.id) }">
                <img v-if="data.photo_url" :src="data.photo_url" class="w-full h-full object-cover" />
                <span v-else>{{ initials(data) }}</span>
              </span>
              <span class="font-medium text-surface-800">{{ data.first_name }} {{ data.last_name }}</span>
            </div>
          </template>
        </Column>
        <Column v-if="visibleColSet.has('email')" field="email" header="Email" sortable>
          <template #body="{ data }">
            <span class="text-surface-600">{{ data.email || '—' }}</span>
          </template>
        </Column>
        <Column v-if="visibleColSet.has('phone')" field="phone" header="Phone">
          <template #body="{ data }">
            <span class="text-surface-600">{{ data.phone || '—' }}</span>
          </template>
        </Column>
        <Column v-if="visibleColSet.has('roles')" header="Roles" style="width:180px">
          <template #body="{ data }">
            <div v-if="typeKeysOf(data).length" class="flex flex-wrap gap-1">
              <Tag v-for="k in typeKeysOf(data)" :key="k" :value="typeLabel(k)" />
            </div>
            <span v-else class="text-surface-400">—</span>
          </template>
        </Column>
        <Column v-if="visibleColSet.has('membership')" field="membership_type" header="Membership" sortable style="width:160px">
          <template #body="{ data }">
            <Tag v-if="data.membership_type" :value="data.membership_type" severity="secondary" />
            <span v-else class="text-surface-400">—</span>
          </template>
        </Column>
        <Column v-if="visibleColSet.has('age')" header="Age" style="width:80px">
          <template #body="{ data }">
            <span class="text-surface-600">{{ age(data.dob) }}</span>
          </template>
        </Column>
        <!-- Per-tab custom-field columns -->
        <Column v-for="c in customColDefs" :key="c.key" :header="c.label" style="min-width:120px">
          <template #body="{ data }">
            <span class="text-surface-600">{{ cfDisplay(data, c) }}</span>
          </template>
        </Column>
        <Column style="width:56px">
          <template #body="{ data }">
            <Button icon="pi pi-ellipsis-v" severity="secondary" text rounded size="small"
              @click.stop="openMenu($event, data)" />
          </template>
        </Column>
      </DataTable>
    </div>

    <Menu ref="rowMenu" :model="menuItems" :popup="true" />

    <!-- Add Person Dialog -->
    <Dialog v-model:visible="showCreate" header="Add person" modal :style="{ width: '95vw', maxWidth: '420px' }">
      <div class="flex flex-col gap-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">First name</label>
            <InputText v-model="newPerson.first_name" autofocus />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Last name</label>
            <InputText v-model="newPerson.last_name" />
          </div>
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Email</label>
          <InputText v-model="newPerson.email" type="email" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Phone</label>
          <InputText v-model="newPerson.phone" />
        </div>
        <div v-if="personTypes.length" class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Type</label>
          <Select v-model="newPerson.person_type" :options="personTypes" optionLabel="label" optionValue="key"
            placeholder="Select a type" class="w-full" showClear />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showCreate = false" />
        <Button label="Add" :loading="creating"
          :disabled="!newPerson.first_name.trim() || !newPerson.last_name.trim()"
          style="background:#1E2157;border-color:#1E2157" @click="handleCreate" />
      </template>
    </Dialog>

    <Toast />
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'

const { orgId } = useOrg()
const db = useDb()
const toast = useToast()
const { resolvePersonTypes, resolveFields, fieldAppliesTo } = useOrgFieldPolicy()

const people = ref<any[]>([])
const personTypes = ref<any[]>([])
const customFields = ref<any[]>([])
const activeType = ref('all')

// ── Per-tab column configuration ──
// Toggleable core columns (Name is always shown). Custom fields are added per
// tab from the org's field catalogue. Visible set is stored per tab on the org.
const CORE_COLS = [
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'roles', label: 'Roles' },
  { key: 'membership', label: 'Membership' },
  { key: 'age', label: 'Age' },
]
const DEFAULT_COLS = CORE_COLS.map(c => c.key) // custom fields default off
const colConfig = ref<Record<string, string[]>>({})
const colMenuOpen = ref(false)
const colMenuWrap = ref<HTMLElement | null>(null)

const activeTabLabel = computed(() => typeTabs.value.find(t => t.key === activeType.value)?.label ?? 'All')

// Custom-field columns offered for a tab — fields applying to that type
// (union of all for the 'all' tab).
function customColsForTab(tabKey: string) {
  const fields = tabKey === 'all'
    ? customFields.value
    : customFields.value.filter(f => fieldAppliesTo(f, tabKey))
  return fields.map(f => ({ key: `cf:${f.id}`, label: f.label, fieldId: f.id, field_type: f.field_type }))
}
const availableCols = computed(() => [...CORE_COLS, ...customColsForTab(activeType.value)])
const visibleCols = computed(() => colConfig.value[activeType.value] ?? DEFAULT_COLS)
const visibleColSet = computed(() => new Set(visibleCols.value))
const customColDefs = computed(() => customColsForTab(activeType.value).filter(c => visibleColSet.value.has(c.key)))

function toggleCol(key: string, on: boolean) {
  const current = new Set(colConfig.value[activeType.value] ?? DEFAULT_COLS)
  if (on) current.add(key); else current.delete(key)
  colConfig.value = { ...colConfig.value, [activeType.value]: [...current] }
  saveColumns()
}
let saveColsTimer: ReturnType<typeof setTimeout> | null = null
function saveColumns() {
  if (saveColsTimer) clearTimeout(saveColsTimer)
  saveColsTimer = setTimeout(async () => {
    await (db.from as any)('organisations').update({ people_columns: colConfig.value }).eq('id', orgId.value)
  }, 500)
}
function cfDisplay(data: any, col: any) {
  const v = data.custom_fields?.[col.fieldId]
  if (v === null || v === undefined || v === '') return '—'
  if (col.field_type === 'checkbox') return v ? 'Yes' : 'No'
  return String(v)
}
function onColDocClick(e: MouseEvent) {
  if (colMenuOpen.value && colMenuWrap.value && !colMenuWrap.value.contains(e.target as Node)) colMenuOpen.value = false
}
const loading = ref(true)
const search = ref('')
const showCreate = ref(false)
const creating = ref(false)
const newPerson = ref({ first_name: '', last_name: '', email: '', phone: '', person_type: null as string | null })
const rowMenu = ref()
const menuItems = ref<any[]>([])
const selected = ref<any[]>([])
const bulkType = ref<string | null>(null)

const typeTabs = computed(() => [{ key: 'all', label: 'All' }, ...personTypes.value.map(t => ({ key: t.key, label: t.label }))])
// A person's role keys — the multi array, falling back to the legacy single type.
function typeKeysOf(p: any): string[] { return p?.person_types?.length ? p.person_types : (p?.person_type ? [p.person_type] : []) }
const typeCounts = computed(() => {
  const c: Record<string, number> = { all: people.value.length }
  for (const t of personTypes.value) c[t.key] = people.value.filter(p => typeKeysOf(p).includes(t.key)).length
  return c
})
function typeLabel(key: string) { return personTypes.value.find(t => t.key === key)?.label ?? key }

const filtered = computed(() => {
  let list = people.value
  if (activeType.value !== 'all') list = list.filter(p => typeKeysOf(p).includes(activeType.value))
  const q = search.value.trim().toLowerCase()
  if (!q) return list
  return list.filter(p =>
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
    (p.email || '').toLowerCase().includes(q) ||
    (p.phone || '').toLowerCase().includes(q) ||
    (p.membership_type || '').toLowerCase().includes(q)
  )
})

function initials(p: any) {
  return `${(p.first_name || '').charAt(0)}${(p.last_name || '').charAt(0)}`.toUpperCase() || '?'
}

const PALETTE = ['#1E2157', '#0f766e', '#9333ea', '#c2410c', '#0369a1', '#be123c', '#15803d', '#4338ca']
function avatarColor(id: string) {
  let h = 0
  for (let i = 0; i < (id || '').length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

function age(dob: string | null) {
  if (!dob) return '—'
  const d = new Date(dob)
  if (isNaN(d.getTime())) return '—'
  const now = new Date()
  let a = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--
  return a >= 0 && a < 130 ? String(a) : '—'
}

function openPerson(row: any) {
  navigateTo(`/people/${row.id}`)
}

async function loadTypes() {
  const all = await resolvePersonTypes(orgId.value as string)
  personTypes.value = (all ?? []).filter((t: any) => (t.kind ?? 'person') === 'person')
  customFields.value = await resolveFields(orgId.value as string)
}

async function loadColumns() {
  const { data } = await (db.from as any)('organisations').select('people_columns').eq('id', orgId.value).single()
  colConfig.value = (data?.people_columns && typeof data.people_columns === 'object') ? data.people_columns : {}
}

async function load() {
  loading.value = true
  const { data } = await (db.from as any)('persons')
    .select('*')
    .eq('org_id', orgId.value)
    .order('last_name', { ascending: true })
  people.value = data ?? []
  loading.value = false
}

function openCreate() {
  // Prefill the type from the active tab (or the first type), so tagging is one less step.
  newPerson.value.person_type = activeType.value !== 'all' ? activeType.value : (personTypes.value[0]?.key ?? null)
  showCreate.value = true
}

async function handleCreate() {
  if (!newPerson.value.first_name.trim() || !newPerson.value.last_name.trim()) return
  creating.value = true
  const { error } = await (db.from as any)('persons').insert({
    org_id: orgId.value,
    first_name: newPerson.value.first_name.trim(),
    last_name: newPerson.value.last_name.trim(),
    email: newPerson.value.email.trim() || null,
    phone: newPerson.value.phone.trim() || null,
    person_type: newPerson.value.person_type || null,
    person_types: newPerson.value.person_type ? [newPerson.value.person_type] : null,
  })
  if (!error) {
    toast.add({ severity: 'success', summary: 'Person added', life: 3000 })
    showCreate.value = false
    newPerson.value = { first_name: '', last_name: '', email: '', phone: '', person_type: null }
    load()
  } else {
    toast.add({ severity: 'error', summary: 'Could not add person', detail: error.message, life: 4000 })
  }
  creating.value = false
}

async function bulkSetType(typeKey: string | null) {
  const ids = selected.value.map(p => p.id)
  if (!ids.length) return
  const { error } = await (db.from as any)('persons').update({ person_type: typeKey, person_types: typeKey ? [typeKey] : null }).in('id', ids)
  if (!error) {
    toast.add({ severity: 'success', summary: `Type set for ${ids.length} ${ids.length === 1 ? 'person' : 'people'}`, life: 2500 })
    selected.value = []
    bulkType.value = null
    load()
  } else {
    toast.add({ severity: 'error', summary: 'Could not set type', detail: error.message, life: 4000 })
  }
}

function exportCsv() {
  // Export the selected rows if any, otherwise the current filtered view.
  const rows = selected.value.length ? selected.value : filtered.value
  if (!rows.length) { toast.add({ severity: 'info', summary: 'Nothing to export', life: 2000 }); return }
  const head = ['First name', 'Last name', 'Email', 'Phone', 'Type', 'Membership', 'Date of birth']
  const esc = (v: any) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
  const lines = [head.join(',')]
  for (const p of rows) {
    lines.push([p.first_name, p.last_name, p.email, p.phone, typeKeysOf(p).map(typeLabel).join(' / '), p.membership_type, p.dob].map(esc).join(','))
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `people-${activeType.value}.csv`; a.click()
  URL.revokeObjectURL(url)
}

async function bulkDelete() {
  const ids = selected.value.map(p => p.id)
  if (!ids.length) return
  if (!window.confirm(`Delete ${ids.length} ${ids.length === 1 ? 'person' : 'people'}? This can't be undone.`)) return
  const { error } = await (db.from as any)('persons').delete().in('id', ids)
  if (!error) {
    toast.add({ severity: 'success', summary: `Deleted ${ids.length} ${ids.length === 1 ? 'person' : 'people'}`, life: 2500 })
    selected.value = []
    load()
  } else {
    toast.add({ severity: 'error', summary: 'Delete failed', detail: error.message, life: 4000 })
  }
}

function openMenu(event: Event, row: any) {
  menuItems.value = [
    {
      label: 'Delete',
      icon: 'pi pi-trash',
      class: 'text-red-500',
      command: async () => {
        await (db.from as any)('persons').delete().eq('id', row.id)
        toast.add({ severity: 'success', summary: 'Person deleted', life: 3000 })
        load()
      },
    },
  ]
  rowMenu.value.toggle(event)
}

onMounted(() => {
  load(); loadTypes(); loadColumns()
  document.addEventListener('click', onColDocClick)
})
onBeforeUnmount(() => document.removeEventListener('click', onColDocClick))
</script>
