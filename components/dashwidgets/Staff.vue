<!--
  Staff / people-showcase dashboard widget (staff:<id> instance). Pick people
  and show them as cards — photo, name, and any rows you choose (Role, Phone,
  Email, a custom field, or a free-text line). Each row pulls the person's own
  value by default; you can override the displayed text per person. Mirrors the
  club "Spotlight / Staff" section. Self-contained: renders + owns its config
  dialog, emits `update:opts` back to the dashboard to persist.
-->
<script setup lang="ts">
const props = defineProps<{ opts: any; editable?: boolean }>()
const emit = defineEmits<{ (e: 'update:opts', v: any): void }>()

const db = useDb()
const { orgId } = useOrg()
const { loadFieldCatalogue } = usePersonFields()
const { uploadFile } = useUpload()
const uploadingId = ref<string | null>(null)
async function onPersonPhoto(pe: any, e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  uploadingId.value = pe.id
  const { url } = await uploadFile(f)
  pe.overrides = { ...(pe.overrides ?? {}), __photo: url }
  uploadingId.value = null
}

// ── Row (field) catalogue a card can show ──
const BASE_ROWS = [
  { field: 'role', label: 'Role / title', icon: '' },
  { field: 'subtitle', label: 'Tagline', icon: '' },
  { field: 'phone', label: 'Phone', icon: 'phone' },
  { field: 'email', label: 'Email', icon: 'email' },
  { field: 'membership_type', label: 'Membership', icon: '' },
]
const customFields = ref<{ key: string; label: string }[]>([])
const rowOptions = computed(() => [
  ...BASE_ROWS.map(r => ({ label: r.label, value: r.field })),
  ...customFields.value.map(f => ({ label: f.label, value: `cf:${f.key}` })),
  { label: 'Custom text…', value: 'custom' },
])
function defaultLabelFor(field: string) {
  return BASE_ROWS.find(r => r.field === field)?.label
    ?? customFields.value.find(f => `cf:${f.key}` === field)?.label
    ?? 'Custom'
}
function defaultIconFor(field: string) { return BASE_ROWS.find(r => r.field === field)?.icon ?? '' }

// resolved people
const people = ref<Record<string, any>>({})
async function loadPeople() {
  const ids = (props.opts?.people ?? []).map((p: any) => p.id).filter(Boolean)
  if (!ids.length) { people.value = {}; return }
  const { data } = await (db.from as any)('persons')
    .select('id, first_name, last_name, photo_url, phone, email, person_type, person_types, membership_type, custom_fields')
    .in('id', ids)
  people.value = Object.fromEntries((data ?? []).map((p: any) => [p.id, p]))
}
onMounted(async () => {
  if (orgId.value) customFields.value = (await loadFieldCatalogue(orgId.value)).filter((f: any) => f.source === 'custom').map((f: any) => ({ key: f.key, label: f.label }))
  await loadPeople()
})
watch(() => JSON.stringify((props.opts?.people ?? []).map((p: any) => p.id)), loadPeople)

const title = computed(() => props.opts?.title ?? 'Staff')
const cols = computed(() => props.opts?.columns ?? 2)
const rows = computed<any[]>(() => Array.isArray(props.opts?.rows) ? props.opts.rows : [])

function personName(p: any) { return `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim() || 'Unnamed' }
function initials(p: any) { return `${(p?.first_name ?? ' ')[0] ?? ''}${(p?.last_name ?? ' ')[0] ?? ''}`.toUpperCase() }
function avatarColor(id: string) { const c = ['#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#06B6D4', '#EF4444']; let h = 0; for (const ch of id || '') h = (h * 31 + ch.charCodeAt(0)) >>> 0; return c[h % c.length] }

// the value shown for a (person, row): override wins, else pull from the record
function rowValue(personEntry: any, row: any) {
  const override = personEntry?.overrides?.[row.id]
  if (override != null && String(override).trim()) return override
  const p = people.value[personEntry.id]
  if (!p) return ''
  const f = row.field as string
  if (f === 'custom') return ''
  if (f === 'role') return p.person_type || (p.person_types?.[0]) || ''
  if (f === 'subtitle') return ''
  if (f === 'phone') return p.phone || ''
  if (f === 'email') return p.email || ''
  if (f === 'membership_type') return p.membership_type || ''
  if (f.startsWith('cf:')) return p.custom_fields?.[f.slice(3)] ?? ''
  return ''
}
function rowIcon(row: any) { return row.icon ?? defaultIconFor(row.field) }

// ── Config dialog ──
const cfgOpen = ref(false)
const draft = reactive<{ title: string; columns: number; rows: any[]; people: any[] }>({ title: 'Staff', columns: 2, rows: [], people: [] })
let rid = 0
function openCfg() {
  draft.title = props.opts?.title ?? 'Staff'
  draft.columns = props.opts?.columns ?? 2
  draft.rows = (props.opts?.rows ?? []).map((r: any) => ({ ...r }))
  if (!draft.rows.length) draft.rows = [
    { id: 'r_role', field: 'role', label: 'Role / title', icon: '' },
    { id: 'r_sub', field: 'subtitle', label: 'Tagline', icon: '' },
    { id: 'r_phone', field: 'phone', label: 'Phone', icon: 'phone' },
    { id: 'r_email', field: 'email', label: 'Email', icon: 'email' },
  ]
  draft.people = (props.opts?.people ?? []).map((p: any) => ({ id: p.id, overrides: { ...(p.overrides ?? {}) } }))
  cfgOpen.value = true
}
function addRow() { draft.rows.push({ id: `r_${Date.now().toString(36)}${rid++}`, field: 'role', label: 'Role / title', icon: '' }) }
function onRowField(row: any, field: string) { row.field = field; row.label = defaultLabelFor(field); row.icon = defaultIconFor(field) }
function removeRow(i: number) { draft.rows.splice(i, 1) }

// person search
const suggestions = ref<any[]>([])
const picked = ref<any>(null)
async function searchPeople(e: { query: string }) {
  const q = (e.query ?? '').trim()
  if (!q) { suggestions.value = []; return }
  const { data } = await (db.from as any)('persons').select('id, first_name, last_name, email').eq('org_id', orgId.value)
    .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`).limit(8)
  suggestions.value = (data ?? []).map((p: any) => ({ ...p, _label: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || p.email }))
}
function onPick(e: any) {
  const p = e.value
  if (p?.id && !draft.people.some(x => x.id === p.id)) { draft.people.push({ id: p.id, overrides: {} }); if (!people.value[p.id]) people.value[p.id] = p }
  picked.value = null
}
function removePerson(i: number) { draft.people.splice(i, 1) }
function draftName(id: string) { const p = people.value[id]; return p ? personName(p) : '…' }

function save() {
  emit('update:opts', { title: draft.title.trim() || 'Staff', columns: draft.columns, rows: draft.rows, people: draft.people })
  cfgOpen.value = false
}
</script>

<template>
  <div class="card h-full flex flex-col overflow-hidden relative">
    <button v-if="editable" type="button"
      class="absolute top-1.5 right-9 z-10 w-6 h-6 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-400 hover:text-primary pointer-events-auto"
      title="Configure staff" @click="openCfg"><i class="pi pi-cog text-xs" /></button>

    <div class="px-4 py-3 border-b border-gray-100 shrink-0">
      <p class="text-sm font-semibold text-gray-800">{{ title }}</p>
    </div>

    <div class="p-4 flex-1 overflow-auto">
      <p v-if="!(opts?.people ?? []).length" class="text-sm text-gray-400 text-center py-6">
        No one yet.<span v-if="editable"> Click the cog to add people.</span>
      </p>
      <div v-else class="grid gap-4" :style="{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }">
        <div v-for="pe in opts.people" :key="pe.id" class="flex items-start gap-3">
          <img v-if="pe.overrides?.__photo || people[pe.id]?.photo_url" :src="pe.overrides?.__photo || people[pe.id].photo_url" class="w-14 h-14 rounded-full object-cover shrink-0" />
          <span v-else class="w-14 h-14 rounded-full flex items-center justify-center text-white font-semibold shrink-0" :style="{ background: avatarColor(pe.id) }">{{ initials(people[pe.id]) }}</span>
          <div class="min-w-0 flex-1">
            <p class="font-semibold text-gray-900 leading-tight">{{ (pe.overrides?.__name) || personName(people[pe.id]) }}</p>
            <template v-for="row in rows" :key="row.id">
              <p v-if="rowValue(pe, row)" class="text-sm leading-snug mt-0.5"
                :class="rowIcon(row) ? 'text-primary flex items-center gap-1.5' : 'text-gray-500'">
                <i v-if="rowIcon(row) === 'phone'" class="pi pi-phone text-xs" />
                <i v-else-if="rowIcon(row) === 'email'" class="pi pi-envelope text-xs" />
                <span class="truncate">{{ rowValue(pe, row) }}</span>
              </p>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- Config -->
    <Dialog v-model:visible="cfgOpen" modal header="Staff widget" :style="{ width: '95vw', maxWidth: '40rem' }">
      <div class="space-y-5">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="flex flex-col gap-1.5 sm:col-span-2"><label class="text-xs font-medium text-gray-500">Section title</label><InputText v-model="draft.title" /></div>
          <div class="flex flex-col gap-1.5"><label class="text-xs font-medium text-gray-500">Columns</label><Select v-model="draft.columns" :options="[1,2,3]" /></div>
        </div>

        <!-- Rows / fields on every card -->
        <div class="space-y-2">
          <p class="text-xs font-bold uppercase tracking-wide text-gray-400">Fields on each card</p>
          <div v-for="(row, i) in draft.rows" :key="row.id" class="flex items-center gap-2">
            <Select :modelValue="row.field" :options="rowOptions" optionLabel="label" optionValue="value" class="flex-1 min-w-0" @update:modelValue="v => onRowField(row, v)" />
            <InputText v-if="row.field === 'custom'" v-model="row.label" placeholder="Label" class="w-28 shrink-0" />
            <Select v-model="row.icon" :options="[{label:'No icon',value:''},{label:'Phone',value:'phone'},{label:'Email',value:'email'}]" optionLabel="label" optionValue="value" class="w-32 shrink-0" />
            <button type="button" class="text-gray-300 hover:text-red-500" @click="removeRow(i)"><i class="pi pi-times-circle" /></button>
          </div>
          <button type="button" class="text-sm text-primary hover:underline" @click="addRow"><i class="pi pi-plus text-[10px] mr-1" />Add field</button>
        </div>

        <!-- People + per-person overrides -->
        <div class="space-y-2">
          <p class="text-xs font-bold uppercase tracking-wide text-gray-400">People</p>
          <AutoComplete v-model="picked" :suggestions="suggestions" optionLabel="_label" placeholder="Search a person…" class="w-full" @complete="searchPeople" @item-select="onPick" />
          <div v-for="(pe, i) in draft.people" :key="pe.id" class="rounded-lg border border-gray-100 p-3 space-y-2">
            <div class="flex items-center gap-2">
              <span class="font-medium text-sm text-gray-800 flex-1">{{ draftName(pe.id) }}</span>
              <button type="button" class="text-gray-300 hover:text-red-500" @click="removePerson(i)"><i class="pi pi-trash text-sm" /></button>
            </div>
            <p class="text-[11px] text-gray-400">Leave a field blank to use their own info; type here to override what shows.</p>
            <div class="flex items-center gap-3">
              <img v-if="pe.overrides?.__photo || people[pe.id]?.photo_url" :src="pe.overrides?.__photo || people[pe.id].photo_url" class="w-11 h-11 rounded-full object-cover shrink-0" />
              <span v-else class="w-11 h-11 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0" :style="{ background: avatarColor(pe.id) }">{{ initials(people[pe.id]) }}</span>
              <label class="text-xs font-medium text-primary cursor-pointer hover:underline">
                <i class="pi pi-upload text-[10px] mr-1" />{{ uploadingId === pe.id ? 'Uploading…' : 'Upload photo' }}
                <input type="file" accept="image/*" class="hidden" :disabled="uploadingId === pe.id" @change="e => onPersonPhoto(pe, e)" />
              </label>
              <button v-if="pe.overrides?.__photo" type="button" class="text-xs text-gray-400 hover:text-red-500" @click="pe.overrides.__photo = ''">Clear</button>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div class="flex flex-col gap-1"><label class="text-[11px] text-gray-400">Name</label><InputText v-model="pe.overrides.__name" :placeholder="draftName(pe.id)" class="text-sm" /></div>
              <div v-for="row in draft.rows" :key="row.id" class="flex flex-col gap-1">
                <label class="text-[11px] text-gray-400">{{ row.label || defaultLabelFor(row.field) }}</label>
                <InputText v-model="pe.overrides[row.id]" placeholder="Their info" class="text-sm" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Done" @click="save" style="background:#1E2157;border-color:#1E2157" />
      </template>
    </Dialog>
  </div>
</template>
