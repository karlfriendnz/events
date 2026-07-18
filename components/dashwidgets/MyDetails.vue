<!--
  "My details" dashboard widget (mydetails:<id> instance). Resolves the logged-in
  user to their person record and shows it as a card — photo, name, and the rows
  you choose (Role, Phone, Email, Membership, a custom field). Self-contained:
  renders + owns its config dialog, emits `update:opts` to persist.
-->
<script setup lang="ts">
const props = defineProps<{ opts: any; editable?: boolean }>()
const emit = defineEmits<{ (e: 'update:opts', v: any): void }>()

const people = usePeopleApi()
const { orgId } = useOrg()
const user = useSupabaseUser()
const { loadFieldCatalogue } = usePersonFields()
const { uploadFile } = useUpload()
const uploadingPhoto = ref(false)
async function onPhoto(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f || !me.value?.id) return
  uploadingPhoto.value = true
  const { url } = await uploadFile(f)
  await people.update(me.value.id, { photoUrl: url })
  me.value = { ...me.value, photo_url: url }
  uploadingPhoto.value = false
}
async function removePhoto() {
  if (!me.value?.id) return
  await people.update(me.value.id, { photoUrl: null })
  me.value = { ...me.value, photo_url: null }
}

const BASE_ROWS = [
  { field: 'role', label: 'Role / title', icon: '' },
  { field: 'phone', label: 'Phone', icon: 'phone' },
  { field: 'email', label: 'Email', icon: 'email' },
  { field: 'membership_type', label: 'Membership', icon: '' },
]
const customFields = ref<{ key: string; label: string }[]>([])
const rowOptions = computed(() => [
  ...BASE_ROWS.map(r => ({ label: r.label, value: r.field })),
  ...customFields.value.map(f => ({ label: f.label, value: `cf:${f.key}` })),
])
function defaultLabelFor(field: string) {
  return BASE_ROWS.find(r => r.field === field)?.label ?? customFields.value.find(f => `cf:${f.key}` === field)?.label ?? 'Field'
}
function defaultIconFor(field: string) { return BASE_ROWS.find(r => r.field === field)?.icon ?? '' }

const me = ref<any>(null)
async function loadMe() {
  const email = user.value?.email
  if (!email || !orgId.value) { me.value = null; return }
  // Seam read: resolve my person row by login email; map to the snake shape the card reads.
  const p = await people.findByEmail(orgId.value, email)
  me.value = p ? {
    id: p.id, first_name: p.firstName, last_name: p.lastName, photo_url: p.photoUrl,
    phone: p.phone, email: p.email, person_type: p.personType, person_types: p.personTypes,
    membership_type: p.membershipType, custom_fields: p.customFields,
  } : null
}
onMounted(async () => {
  if (orgId.value) customFields.value = (await loadFieldCatalogue(orgId.value)).filter((f: any) => f.source === 'custom').map((f: any) => ({ key: f.key, label: f.label }))
  await loadMe()
})
watch([orgId, () => user.value?.email], loadMe)

const title = computed(() => props.opts?.title ?? 'My details')
const rows = computed<any[]>(() => Array.isArray(props.opts?.rows) && props.opts.rows.length ? props.opts.rows : [
  { id: 'r_role', field: 'role', label: 'Role / title', icon: '' },
  { id: 'r_phone', field: 'phone', label: 'Phone', icon: 'phone' },
  { id: 'r_email', field: 'email', label: 'Email', icon: 'email' },
])
function personName(p: any) { return `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim() || (user.value?.email ?? 'You') }
function initials(p: any) { return `${(p?.first_name ?? ' ')[0] ?? ''}${(p?.last_name ?? ' ')[0] ?? ''}`.toUpperCase() || 'ME' }
function rowValue(row: any) {
  const p = me.value; if (!p) return ''
  const f = row.field as string
  if (f === 'role') return p.person_type || p.person_types?.[0] || ''
  if (f === 'phone') return p.phone || ''
  if (f === 'email') return p.email || ''
  if (f === 'membership_type') return p.membership_type || ''
  if (f?.startsWith('cf:')) return p.custom_fields?.[f.slice(3)] ?? ''
  return ''
}
function rowIcon(row: any) { return row.icon ?? defaultIconFor(row.field) }

// config
const cfgOpen = ref(false)
const draft = reactive<{ title: string; rows: any[] }>({ title: 'My details', rows: [] })
let rid = 0
function openCfg() {
  draft.title = props.opts?.title ?? 'My details'
  draft.rows = rows.value.map((r: any) => ({ ...r }))
  cfgOpen.value = true
}
function addRow() { draft.rows.push({ id: `r_${Date.now().toString(36)}${rid++}`, field: 'role', label: 'Role / title', icon: '' }) }
function onRowField(row: any, field: string) { row.field = field; row.label = defaultLabelFor(field); row.icon = defaultIconFor(field) }
function removeRow(i: number) { draft.rows.splice(i, 1) }
function save() { emit('update:opts', { title: draft.title.trim() || 'My details', rows: draft.rows }); cfgOpen.value = false }
</script>

<template>
  <div class="card h-full flex flex-col overflow-hidden relative">
    <button v-if="editable" type="button"
      class="absolute top-1.5 right-9 z-10 w-6 h-6 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-400 hover:text-primary pointer-events-auto"
      title="Configure" @click="openCfg"><i class="pi pi-cog text-xs" /></button>

    <div class="px-4 py-3 border-b border-gray-100 shrink-0"><p class="text-sm font-semibold text-gray-800">{{ title }}</p></div>

    <div class="p-4 flex-1 overflow-auto">
      <p v-if="!me" class="text-sm text-gray-400 text-center py-6">No matching profile for your login.</p>
      <div v-else class="flex items-start gap-3">
        <img v-if="me.photo_url" :src="me.photo_url" class="w-14 h-14 rounded-full object-cover shrink-0" />
        <span v-else class="w-14 h-14 rounded-full flex items-center justify-center text-white font-semibold shrink-0 bg-primary">{{ initials(me) }}</span>
        <div class="min-w-0 flex-1">
          <p class="font-semibold text-gray-900 leading-tight">{{ personName(me) }}</p>
          <template v-for="row in rows" :key="row.id">
            <p v-if="rowValue(row)" class="text-sm leading-snug mt-0.5" :class="rowIcon(row) ? 'text-primary flex items-center gap-1.5' : 'text-gray-500'">
              <i v-if="rowIcon(row) === 'phone'" class="pi pi-phone text-xs" />
              <i v-else-if="rowIcon(row) === 'email'" class="pi pi-envelope text-xs" />
              <span class="truncate">{{ rowValue(row) }}</span>
            </p>
          </template>
        </div>
      </div>
    </div>

    <Dialog v-model:visible="cfgOpen" modal header="My details" :style="{ width: '95vw', maxWidth: '32rem' }">
      <div class="space-y-4">
        <div class="flex items-center gap-3">
          <img v-if="me?.photo_url" :src="me.photo_url" class="w-14 h-14 rounded-full object-cover shrink-0" />
          <span v-else class="w-14 h-14 rounded-full flex items-center justify-center text-white font-semibold shrink-0 bg-primary">{{ initials(me) }}</span>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-primary cursor-pointer hover:underline">
              <i class="pi pi-upload text-xs mr-1" />{{ uploadingPhoto ? 'Uploading…' : 'Upload photo' }}
              <input type="file" accept="image/*" class="hidden" :disabled="uploadingPhoto || !me" @change="onPhoto" />
            </label>
            <button v-if="me?.photo_url" type="button" class="text-xs text-gray-400 hover:text-red-500 text-left" @click="removePhoto">Remove photo</button>
          </div>
        </div>
        <div class="flex flex-col gap-1.5"><label class="text-xs font-medium text-gray-500">Title</label><InputText v-model="draft.title" /></div>
        <div class="space-y-2">
          <p class="text-xs font-bold uppercase tracking-wide text-gray-400">Fields shown</p>
          <div v-for="(row, i) in draft.rows" :key="row.id" class="flex items-center gap-2">
            <Select :modelValue="row.field" :options="rowOptions" optionLabel="label" optionValue="value" class="flex-1 min-w-0" @update:modelValue="v => onRowField(row, v)" />
            <Select v-model="row.icon" :options="[{label:'No icon',value:''},{label:'Phone',value:'phone'},{label:'Email',value:'email'}]" optionLabel="label" optionValue="value" class="w-32 shrink-0" />
            <button type="button" class="text-gray-300 hover:text-red-500" @click="removeRow(i)"><i class="pi pi-times-circle" /></button>
          </div>
          <button type="button" class="text-sm text-primary hover:underline" @click="addRow"><i class="pi pi-plus text-[10px] mr-1" />Add field</button>
        </div>
      </div>
      <template #footer><Button label="Done" @click="save" style="background:#1E2157;border-color:#1E2157" /></template>
    </Dialog>
  </div>
</template>
