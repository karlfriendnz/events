<!--
  PersonCirclesEditor — manages the families & circles a person belongs to.
  Family = guardians ↔ dependents (guardians manage dependents). Circle = peer group
  (book-for / view, never manage). A person can be in many of each (split families =
  two family circles). Used on the /people/[id] "Family & Circles" tab.
-->
<template>
  <div class="space-y-4">
    <div v-if="loading" class="py-8 text-center text-sm text-surface-400"><i class="pi pi-spin pi-spinner" /></div>
    <div v-else class="space-y-4">
      <!-- CONTACTS (flat list of people connected to the viewed person) -->
      <AppCard title="Contacts" :description="`People connected to ${viewedFirstName} — parents, guardians and other contacts.`">
        <template #header-action>
          <Button label="Add contact" icon="pi pi-user-plus" size="small" severity="secondary" outlined @click="addContact" />
        </template>
        <div class="p-4 sm:p-5">
          <div class="overflow-x-auto">
            <div class="min-w-[49rem]">
              <!-- Header -->
              <div v-if="contactRows.length" class="grid grid-cols-[minmax(7rem,1fr)_7rem_11rem_9rem_9rem_1.5rem] gap-3 px-3 pb-1.5 text-xs font-bold uppercase tracking-wide text-gray-400 border-b border-gray-100">
                <span>Contact</span>
                <span>Relationship</span>
                <span>Type</span>
                <span>Contact</span>
                <span>Communication</span>
                <span></span>
              </div>
              <!-- Rows -->
              <div v-for="{ m, c } in contactRows" :key="m.id"
                class="grid grid-cols-[minmax(7rem,1fr)_7rem_11rem_9rem_9rem_1.5rem] gap-3 items-center px-3 py-2 border-b border-gray-50 last:border-0">
                <!-- Contact -->
                <div class="flex items-center gap-2 min-w-0">
                  <span class="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-semibold shrink-0 overflow-hidden">
                    <img v-if="m.person?.photo_url" :src="m.person.photo_url" class="w-full h-full object-cover" />
                    <span v-else>{{ initials(m.person) }}</span>
                  </span>
                  <NuxtLink :to="`/people/${m.person_id}`" class="text-sm font-semibold text-gray-800 hover:text-primary flex items-center gap-1 truncate">
                    {{ personName(m.person) }}<i class="pi pi-arrow-circle-right text-primary text-xs shrink-0" />
                  </NuxtLink>
                </div>
                <!-- Relationship -->
                <input :value="m.relationship" placeholder="e.g. Mum" maxlength="40"
                  class="text-xs text-gray-700 bg-transparent outline-none border-b border-dashed border-transparent hover:border-gray-300 focus:border-gray-400 min-w-0 w-full"
                  @change="onRelationship(m, $event)" />
                <!-- Type -->
                <Select :modelValue="m.contact_type || 'contact'" :options="CONTACT_TYPES" optionLabel="label" optionValue="value" size="small" class="w-full"
                  @update:modelValue="v => setType(c, m, v)" />
                <!-- Contact: phone text + an email icon (mailto) -->
                <div class="flex items-center gap-2 text-xs">
                  <span class="flex items-center gap-1.5 text-gray-600 w-24 shrink-0 truncate"><i class="pi pi-phone text-gray-300 text-xs shrink-0" />{{ m.person?.phone || '—' }}</span>
                  <a v-if="m.person?.email" :href="`mailto:${m.person.email}`" class="text-gray-400 hover:text-primary shrink-0" :title="`Email ${m.person.email}`"><i class="pi pi-envelope text-sm" /></a>
                </div>
                <!-- Communication (green ✓ / red ✗ toggle + Customise) -->
                <div class="flex items-center gap-2">
                  <button :title="m.receives_comms ? `Receives communication on behalf of ${viewedFirstName} — click to stop` : `Will not receive communication — click to enable`" @click="toggleComms(m, !m.receives_comms)">
                    <i v-if="m.receives_comms" class="pi pi-check-circle text-green-500" />
                    <i v-else class="pi pi-times-circle text-red-500" />
                  </button>
                  <Button v-if="m.receives_comms" label="Customise" icon="pi pi-envelope" size="small" severity="secondary" outlined
                    class="!py-0.5 !px-1.5 !text-xs" title="Choose which communication they receive" @click="openComms(m)" />
                </div>
                <!-- Remove -->
                <button class="text-gray-300 hover:text-red-500" title="Remove contact" @click="removeMember(m.id).then(reload)"><i class="pi pi-times text-xs" /></button>
              </div>
            </div>
          </div>
          <div v-if="!contactRows.length" class="text-sm text-gray-400 px-1 py-2">No contacts yet.</div>
        </div>
      </AppCard>

      <!-- CIRCLES -->
      <AppCard title="Circles" description="Peer groups (friends, carpool, training buddies). Members can book on behalf of and track each other — but can't manage profiles.">
        <div class="space-y-4 p-4 sm:p-5">
          <div v-for="c in circlesOnly" :key="c.id" class="rounded-xl border border-gray-200 overflow-hidden">
            <div class="flex items-center gap-2.5 px-4 py-2.5 border-b border-gray-100" :style="{ background: c.color ? c.color + '14' : 'rgba(249,250,251,0.6)' }">
              <label class="relative w-9 h-9 rounded-full overflow-hidden shrink-0 cursor-pointer ring-1 ring-black/10 flex items-center justify-center" :style="{ background: c.color || '#e5e7eb' }" title="Add a picture">
                <img v-if="c.image_url" :src="c.image_url" class="w-full h-full object-cover" />
                <i v-else class="fa-solid fa-circle-nodes text-white/90 text-xs" />
                <input type="file" accept="image/*" class="hidden" @change="onPicture(c, $event)" />
              </label>
              <button class="w-4 h-4 rounded-full ring-1 ring-black/20 shrink-0" :style="{ background: c.color || '#cbd5e1' }" title="Background colour" @click="toggleColor(c.id)" />
              <input v-model="c.name" class="flex-1 bg-transparent text-sm font-bold text-gray-800 outline-none" @change="renameCircle(c.id, c.name)" />
              <Button label="Add" icon="pi pi-user-plus" size="small" text @click="openAdd(c)" />
              <button class="text-gray-400 hover:text-red-500" title="Delete circle" @click="confirmDelete(c)"><i class="pi pi-trash text-xs" /></button>
            </div>
            <div v-if="colorOpenFor === c.id" class="flex flex-wrap items-center gap-1.5 px-4 py-2 bg-gray-50/40 border-b border-gray-100">
              <button v-for="col in PALETTE" :key="col" class="w-5 h-5 rounded-full ring-1 ring-black/10 hover:scale-110 transition-transform" :style="{ background: col }" @click="setColor(c, col)" />
              <button v-if="c.image_url" class="ml-1 text-xs text-gray-500 hover:text-red-500" @click="removePicture(c)">Remove photo</button>
            </div>
            <div class="divide-y divide-gray-50">
              <div v-for="m in c.members" :key="m.id" class="px-4 py-2.5">
                <div class="flex items-center gap-3">
                  <span class="w-7 h-7 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-semibold shrink-0 overflow-hidden">
                    <img v-if="m.person?.photo_url" :src="m.person.photo_url" class="w-full h-full object-cover" />
                    <span v-else>{{ initials(m.person) }}</span>
                  </span>
                  <NuxtLink :to="`/people/${m.person_id}`" class="text-sm font-medium text-gray-800 hover:text-primary flex-1 truncate">
                    {{ personName(m.person) }}<span v-if="m.person_id === personId" class="ml-1.5 text-xs font-semibold text-primary">You</span>
                  </NuxtLink>
                  <button class="shrink-0" :title="m.is_lead ? 'Circle lead — click to demote' : 'Make circle lead'" @click="updateMember(m.id, { is_lead: !m.is_lead }).then(reload)">
                    <i class="fa-solid fa-star text-xs" :class="m.is_lead ? 'text-amber-400' : 'text-gray-200 hover:text-amber-200'" />
                  </button>
                  <label class="text-xs text-gray-500 flex items-center gap-1.5"><Checkbox :modelValue="m.can_book_for" :binary="true" @update:modelValue="v => updateMember(m.id, { can_book_for: v }).then(reload)" />Book</label>
                  <label class="text-xs text-gray-500 flex items-center gap-1.5"><Checkbox :modelValue="m.can_register" :binary="true" @update:modelValue="v => updateMember(m.id, { can_register: v }).then(reload)" />Register</label>
                  <button class="text-gray-300 hover:text-red-500" title="Remove" @click="removeMember(m.id).then(reload)"><i class="pi pi-times text-xs" /></button>
                </div>
              </div>
              <div v-if="!c.members.length" class="px-4 py-3 text-sm text-gray-400">No members yet.</div>
            </div>
          </div>
          <Button label="New circle" icon="pi pi-plus" size="small" severity="secondary" outlined @click="newCircle('circle')" />
        </div>
      </AppCard>
    </div>

    <!-- Add member / contact dialog -->
    <Dialog v-model:visible="addOpen" modal :style="{ width: '95vw', maxWidth: '440px' }"
      :header="addTarget?.kind === 'family' ? `Add a contact for ${viewedFirstName}` : `Add to ${addTarget?.name || ''}`">
      <div class="flex flex-col gap-3">
        <label class="text-sm font-medium">Person</label>
        <AutoComplete v-model="pickQuery" :suggestions="pickResults" optionLabel="label" dropdown forceSelection
          placeholder="Search people…" class="w-full" @complete="searchPersons" @item-select="onPick" />
        <template v-if="addTarget?.kind === 'family'">
          <label class="text-sm font-medium">Relationship <span class="text-gray-400 font-normal">(optional)</span></label>
          <InputText v-model="addRelationship" :placeholder="`e.g. Mum, Dad, Guardian`" class="w-full" />
        </template>
      </div>
      <template #footer><Button label="Done" text @click="addOpen = false" /></template>
    </Dialog>

    <!-- Email types modal (what a contact receives on the viewed person's behalf) -->
    <Dialog v-model:visible="commsModalOpen" modal :style="{ width: '95vw', maxWidth: '420px' }"
      :header="`Communication ${commsTarget ? personName(commsTarget.person) : ''} receives`">
      <p class="text-xs text-gray-500 mb-3">Choose which types of communication this contact receives on {{ viewedFirstName }}'s behalf.</p>
      <div class="space-y-2.5">
        <label v-for="cat in COMMS_CATEGORIES" :key="cat.key" class="flex items-center gap-2.5 text-sm cursor-pointer">
          <Checkbox :modelValue="commsTargetCats.includes(cat.key)" :binary="true" @update:modelValue="v => toggleCat(cat.key, v)" />
          {{ cat.label }}
        </label>
      </div>
      <template #footer><Button label="Done" text @click="commsModalOpen = false" /></template>
    </Dialog>
    <Toast />
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { COMMS_CATEGORIES, COMMS_CATEGORY_KEYS } from '~/composables/usePeopleLinks'

const props = defineProps<{ personId: string }>()
const db = useDb()
const { orgId } = useOrg()
const toast = useToast()
const { circlesForPerson, loadCommsPrefsForSubject, setCommsPref, createCircle, renameCircle, updateCircle, deleteCircle, addMember, updateMember, removeMember } = usePeopleLinks()

const FAMILY_ROLES = [{ label: 'Guardian', value: 'guardian' }, { label: 'Dependent', value: 'dependent' }]
const CONTACT_TYPES = [
  { label: 'Primary contact', value: 'primary' },
  { label: 'Standard contact', value: 'standard' },
  { label: 'Emergency contact', value: 'emergency' },
  { label: 'Contact', value: 'contact' },
]
const PALETTE = ['#1E2157', '#2563eb', '#0891b2', '#059669', '#65a30d', '#d97706', '#dc2626', '#db2777', '#7c3aed', '#475569']

// Colour picker — which circle's swatch tray is open.
const colorOpenFor = ref<string | null>(null)
function toggleColor(id: string) { colorOpenFor.value = colorOpenFor.value === id ? null : id }
async function setColor(c: any, color: string) {
  c.color = color
  colorOpenFor.value = null
  await updateCircle(c.id, { color })
}

// Picture upload (per circle/family).
const { uploadFile } = useUpload()
async function onPicture(c: any, e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const url = await uploadFile(file)
    c.image_url = url
    await updateCircle(c.id, { image_url: url })
    toast.add({ severity: 'success', summary: 'Picture updated', life: 1800 })
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Upload failed', detail: err?.message, life: 3500 })
  } finally { (e.target as HTMLInputElement).value = '' }
}
async function removePicture(c: any) {
  c.image_url = null
  colorOpenFor.value = null
  await updateCircle(c.id, { image_url: null })
}

const loading = ref(true)
const circles = ref<any[]>([])
const families = computed(() => circles.value.filter(c => c.kind === 'family'))
const circlesOnly = computed(() => circles.value.filter(c => c.kind === 'circle'))

function personName(p: any) { return p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || '—' : '—' }
function initials(p: any) { return p ? `${(p.first_name || '').charAt(0)}${(p.last_name || '').charAt(0)}`.toUpperCase() : '?' }

// ── Contacts (people connected to the viewed person) ──
// The viewed person (props.personId) is the SUBJECT; their contacts live in their
// family-kind circle(s) and are shown as one flat list (no grouping card).
const contactRows = computed(() => {
  const rows: { m: any; c: any }[] = []
  for (const c of families.value) for (const m of (c.members ?? [])) if (m.person_id !== props.personId) rows.push({ m, c })
  return rows
})

// First name of the person being viewed (for "… of Jordan" labels).
const viewedFirstName = computed(() => {
  for (const c of circles.value) {
    const m = (c.members ?? []).find((x: any) => x.person_id === props.personId)
    if (m?.person?.first_name) return m.person.first_name
  }
  return 'them'
})

// Comms categories each contact receives on the viewed person's behalf.
// Missing row + receives_comms on = all categories; receives_comms off = none.
const commsForMe = ref<Record<string, string[]>>({})
function commsDefault(m: any): string[] { return m.receives_comms ? [...COMMS_CATEGORY_KEYS] : [] }
function commsOf(m: any): string[] { return commsForMe.value[m.person_id] ?? commsDefault(m) }
async function setComms(m: any, categories: string[]) {
  commsForMe.value = { ...commsForMe.value, [m.person_id]: categories }
  await setCommsPref(m.person_id, props.personId, categories)
}

async function onRelationship(m: any, e: Event) {
  const v = (e.target as HTMLInputElement).value.trim()
  m.relationship = v
  await updateMember(m.id, { relationship: v || null })
}
async function setType(c: any, m: any, type: string) {
  // One primary per person — demote any other primary to standard.
  if (type === 'primary') {
    for (const other of (c.members ?? [])) if (other.id !== m.id && other.contact_type === 'primary') {
      await updateMember(other.id, { contact_type: 'standard', is_primary: false })
    }
  }
  await updateMember(m.id, { contact_type: type, is_primary: type === 'primary' })
  await reload()
}
async function toggleComms(m: any, on: boolean) {
  await updateMember(m.id, { receives_comms: on })
  await reload()
}

// Email-types modal
const commsModalOpen = ref(false)
const commsTarget = ref<any>(null)
const commsTargetCats = computed(() => commsTarget.value ? commsOf(commsTarget.value) : [])
function openComms(m: any) { commsTarget.value = m; commsModalOpen.value = true }
async function toggleCat(key: string, on: boolean) {
  if (!commsTarget.value) return
  const cur = commsOf(commsTarget.value)
  const next = on ? Array.from(new Set([...cur, key])) : cur.filter(k => k !== key)
  await setComms(commsTarget.value, next)
}

async function reload() {
  loading.value = true
  circles.value = await circlesForPerson(props.personId)
  commsForMe.value = await loadCommsPrefsForSubject(props.personId)
  loading.value = false
}

async function newCircle(kind: 'family' | 'circle') {
  const c = await createCircle(kind === 'family' ? 'New family' : 'New circle', kind)
  if (c) { await addMember(c.id, props.personId, kind === 'family' ? 'dependent' : 'member'); await reload() }
}
async function confirmDelete(c: any) {
  if (!window.confirm(`Delete "${c.name}"? This unlinks everyone in it.`)) return
  await deleteCircle(c.id); await reload()
}

// Ensure the viewed person has a contacts container (a hidden family circle),
// then open the add dialog against it.
async function ensureContactsContainer() {
  if (families.value.length) return families.value[0]
  const c = await createCircle('Contacts', 'family')
  if (c) { await addMember(c.id, props.personId, 'dependent'); await reload() }
  return families.value[0] ?? null
}
async function addContact() {
  const c = await ensureContactsContainer()
  if (c) openAdd(c)
}

// add member / contact dialog
const addOpen = ref(false)
const addTarget = ref<any>(null)
const addRelationship = ref('')
const pickQuery = ref<any>('')
const pickResults = ref<any[]>([])
function openAdd(c: any) { addTarget.value = c; addRelationship.value = ''; pickQuery.value = ''; addOpen.value = true }
async function searchPersons(e: { query: string }) {
  const q = (e.query || '').trim()
  const existing = new Set((addTarget.value?.members ?? []).map((m: any) => m.person_id))
  let query = (db.from as any)('persons').select('id, first_name, last_name, email').eq('org_id', orgId.value).order('last_name').limit(20)
  if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
  const { data } = await query
  pickResults.value = (data ?? []).filter((p: any) => !existing.has(p.id))
    .map((p: any) => ({ ...p, label: personName(p) + (p.email ? ` · ${p.email}` : '') }))
}
async function onPick(e: { value: any }) {
  const p = e.value
  if (!p?.id || !addTarget.value) return
  let ok = false
  if (addTarget.value.kind === 'family') {
    // A contact is a guardian (can act for the person) who receives comms by default.
    // The first contact becomes the primary; the rest default to standard.
    const hasPrimary = (addTarget.value.members ?? []).some((x: any) => x.person_id !== props.personId && x.contact_type === 'primary')
    ok = await addMember(addTarget.value.id, p.id, 'guardian', {
      relationship: addRelationship.value.trim() || null,
      receives_comms: true,
      contact_type: hasPrimary ? 'standard' : 'primary',
      is_primary: !hasPrimary,
    })
  } else {
    ok = await addMember(addTarget.value.id, p.id, 'member')
  }
  if (ok) { toast.add({ severity: 'success', summary: 'Added', life: 2000 }); addRelationship.value = ''; await reload(); addTarget.value = circles.value.find(c => c.id === addTarget.value.id) }
  pickQuery.value = ''; pickResults.value = []
}

watch(() => props.personId, reload, { immediate: true })
</script>
