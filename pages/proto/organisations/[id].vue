<!--
  PROTOTYPE · An entity record (a Team, Business, School…). Two tabs:
   • Profile — the entity's own fields (from its type), like a person profile.
   • People  — the roster: people attached to this entity, each with a role.
  This is where "people are connected to an entity" lives.
-->
<script setup lang="ts">
const db = useDb()
const { orgId } = useOrg()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { resolveFields, fieldAppliesTo } = useOrgFieldPolicy()
const { loadEntity, saveEntity, deleteEntity, loadMembers, addMember, updateMember, removeMember } = useEntities()

const entity = ref<any>(null)
const typeLabel = ref('')
const slots = ref<any[]>([])
const fields = ref<any[]>([])
const members = ref<any[]>([])
const persons = ref<any[]>([])
const tab = ref<'profile' | 'people'>('profile')
const loading = ref(true)
const saving = ref(false)
const dirty = ref(false)

// attach state
const attachOpen = ref(false)
const attachPerson = ref<string | null>(null)
const attachRole = ref<string | null>(null)

const roleOptions = computed(() => {
  const set = new Set<string>()
  for (const s of slots.value) if (s.role) set.add(s.role)
  if (!set.size) set.add('Member')
  return [...set].map(r => ({ label: r, value: r }))
})
const personOptions = computed(() => {
  const taken = new Set(members.value.map(m => m.person_id))
  return persons.value.filter(p => !taken.has(p.id)).map(p => ({ label: `${p.first_name} ${p.last_name}`.trim(), value: p.id }))
})

async function load() {
  loading.value = true
  const id = route.params.id as string
  entity.value = await loadEntity(id)
  if (!entity.value) { loading.value = false; return }
  if (!entity.value.custom_fields) entity.value.custom_fields = {}
  const [{ data: typeRows }, flds, mem, { data: ppl }] = await Promise.all([
    (db.from as any)('person_target_types').select('label, member_slots, org_id').eq('key', entity.value.type_key),
    resolveFields(orgId.value!),
    loadMembers(id),
    (db.from as any)('persons').select('id, first_name, last_name, email, phone').eq('org_id', orgId.value).order('last_name'),
  ])
  const own = (typeRows ?? []).find((r: any) => r.org_id === orgId.value) ?? (typeRows ?? [])[0]
  typeLabel.value = own?.label ?? entity.value.type_key
  slots.value = own?.member_slots ?? []
  fields.value = flds.filter(f => fieldAppliesTo(f, entity.value.type_key))
  members.value = mem
  persons.value = ppl ?? []
  dirty.value = false
  loading.value = false
}

async function save() {
  saving.value = true
  await saveEntity(entity.value.id, { name: entity.value.name, custom_fields: entity.value.custom_fields })
  saving.value = false; dirty.value = false
  toast.add({ severity: 'success', summary: 'Saved', life: 1800 })
}
async function remove() {
  if (!confirm('Delete this record?')) return
  await deleteEntity(entity.value.id)
  router.push('/proto/organisations')
}

function openAttach() {
  attachPerson.value = null
  attachRole.value = roleOptions.value[0]?.value ?? 'Member'
  attachOpen.value = true
}
async function doAttach() {
  if (!attachPerson.value) return
  try {
    await addMember(entity.value.id, attachPerson.value, attachRole.value ? [attachRole.value] : [], members.value.length)
    attachOpen.value = false
    members.value = await loadMembers(entity.value.id)
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Could not attach', detail: e?.message, life: 4000 })
  }
}
async function changeRole(m: any, roles: string[]) {
  m.roles = roles
  await updateMember(m.id, roles)
}
async function detach(m: any) {
  await removeMember(m.id)
  members.value = members.value.filter(x => x.id !== m.id)
}

watch(() => route.params.id, load, { immediate: true })
</script>

<template>
  <div class="p-3 sm:p-6 min-h-full flex flex-col">
    <div class="flex flex-col md:flex-row gap-4 md:gap-6 flex-1 min-h-0">
      <ProtoNav />
      <div class="flex-1 min-w-0">
        <div v-if="loading" class="text-sm text-gray-400">Loading…</div>
        <div v-else-if="!entity" class="card p-8 text-center text-sm text-gray-400">Record not found.</div>
        <template v-else>
          <!-- header -->
          <div class="card p-0 overflow-hidden mb-4">
            <div class="px-4 sm:px-5 py-3 flex items-center gap-3">
              <button class="text-gray-400 hover:text-gray-700" @click="router.push('/proto/organisations')"><i class="pi pi-chevron-left" /></button>
              <div class="min-w-0 flex-1">
                <h1 class="text-lg sm:text-xl font-semibold text-gray-900 truncate">{{ entity.name }}</h1>
                <p class="text-xs uppercase tracking-wide text-violet-500">{{ typeLabel }}</p>
              </div>
              <Button label="Save" size="small" :loading="saving" :disabled="!dirty" @click="save" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
            </div>
            <div class="flex gap-1 px-4 sm:px-5 border-t border-gray-100">
              <button class="px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors"
                :class="tab === 'profile' ? 'border-primary text-primary' : 'border-transparent text-gray-500'" @click="tab = 'profile'">Profile</button>
              <button class="px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors"
                :class="tab === 'people' ? 'border-primary text-primary' : 'border-transparent text-gray-500'" @click="tab = 'people'">People ({{ members.length }})</button>
            </div>
          </div>

          <!-- PROFILE -->
          <div v-show="tab === 'profile'" class="card p-4 sm:p-5 space-y-4 max-w-2xl">
            <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-6">
              <label class="text-sm font-medium w-full sm:w-40 text-gray-600">Name</label>
              <InputText v-model="entity.name" class="w-full" @input="dirty = true" />
            </div>
            <div v-for="f in fields" :key="f.id" class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-6">
              <label class="text-sm font-medium w-full sm:w-40 text-gray-600">{{ f.label }}</label>
              <div class="w-full">
                <Textarea v-if="f.field_type === 'textarea'" v-model="entity.custom_fields[f.id]" class="w-full" rows="2" @input="dirty = true" />
                <InputNumber v-else-if="f.field_type === 'number'" v-model="entity.custom_fields[f.id]" class="w-full" @input="dirty = true" />
                <DatePicker v-else-if="f.field_type === 'date'" v-model="entity.custom_fields[f.id]" dateFormat="yy-mm-dd" class="w-full" @update:modelValue="dirty = true" />
                <Select v-else-if="f.field_type === 'select'" v-model="entity.custom_fields[f.id]" :options="f.options" class="w-full" @change="dirty = true" />
                <ToggleSwitch v-else-if="f.field_type === 'checkbox'" :modelValue="!!entity.custom_fields[f.id]" @update:modelValue="v => { entity.custom_fields[f.id] = v; dirty = true }" />
                <InputText v-else v-model="entity.custom_fields[f.id]" class="w-full" @input="dirty = true" />
              </div>
            </div>
            <p v-if="!fields.length" class="text-sm text-gray-400">No fields defined for {{ typeLabel }}. Add some in <NuxtLink to="/proto/entity-types" class="text-primary hover:underline">Teams &amp; organisations</NuxtLink>.</p>
            <div class="pt-2 border-t border-gray-100">
              <button class="text-sm text-red-600 hover:underline" @click="remove">Delete record</button>
            </div>
          </div>

          <!-- PEOPLE -->
          <div v-show="tab === 'people'" class="space-y-3">
            <div class="flex items-center justify-between">
              <p class="text-sm text-gray-500">People attached to this {{ typeLabel.toLowerCase() }}, each with a role.</p>
              <Button label="Attach person" icon="pi pi-plus" size="small" @click="openAttach" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
            </div>
            <div class="card p-0 overflow-hidden">
              <div v-if="!members.length" class="px-4 py-6 text-center text-sm text-gray-400">No one attached yet.</div>
              <div v-for="m in members" :key="m.id" class="px-4 py-2.5 border-b border-gray-50 flex items-center gap-3">
                <div class="min-w-0 flex-1">
                  <NuxtLink :to="`/people/${m.person_id}`" class="text-sm font-medium text-gray-800 hover:text-primary">{{ m.person?.first_name }} {{ m.person?.last_name }}</NuxtLink>
                  <p class="text-[11px] text-gray-400 truncate">{{ m.person?.email || m.person?.phone || '—' }}</p>
                </div>
                <MultiSelect :modelValue="m.roles" :options="roleOptions" optionLabel="label" optionValue="value"
                  display="chip" placeholder="Role" class="w-56" size="small" @update:modelValue="v => changeRole(m, v)" />
                <button class="w-7 h-7 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50" @click="detach(m)"><i class="pi pi-times text-xs" /></button>
              </div>
            </div>
          </div>

          <Dialog v-model:visible="attachOpen" modal header="Attach person" :style="{ width: '95vw', maxWidth: '440px' }">
            <div class="space-y-3">
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium">Person</label>
                <Select v-model="attachPerson" :options="personOptions" optionLabel="label" optionValue="value" filter placeholder="Search people…" class="w-full" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium">Role</label>
                <Select v-model="attachRole" :options="roleOptions" optionLabel="label" optionValue="value" class="w-full" />
              </div>
            </div>
            <template #footer>
              <Button label="Cancel" text size="small" @click="attachOpen = false" />
              <Button label="Attach" size="small" :disabled="!attachPerson" @click="doAttach" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
            </template>
          </Dialog>
        </template>
        <Toast />
      </div>
    </div>
  </div>
</template>
