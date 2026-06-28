<!--
  PROTOTYPE · Person editor that ENFORCES the global core-field rules:
   • First/Last/Role + DOB + Gender always required (DOB/Gender match people)
   • Email required only if the person is an account holder OR receives comms
   • Phone required only if the club has set Phone = Required
  Core fields come from the global config (/proto/core-fields); type-specific
  custom fields render below. Isolated from the live /people profile.
-->
<script setup lang="ts">
const db = useDb()
const { orgId } = useOrg()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { loadOrgTypes, resolveFields, fieldAppliesTo } = useOrgFieldPolicy()
const { CORE_SECTIONS, coreStatus, loadConfig, coreErrors } = useCoreFields()

const GENDERS = [
  { label: 'Male', value: 'MALE' },
  { label: 'Female', value: 'FEMALE' },
  { label: 'Non-binary', value: 'NON_BINARY' },
  { label: 'Unspecified', value: 'UNSPECIFIED' },
]

const person = ref<any>(null)
const dobDate = ref<Date | null>(null)
const cfg = ref<any>({ required: {}, enabled: {} })
const personTypes = ref<any[]>([])
const fields = ref<any[]>([])
const loading = ref(true)
const saving = ref(false)
const errors = ref<Record<string, string>>({})

const accountHolder = computed({
  get: () => !!person.value?.custom_fields?.__account_holder,
  set: (v: boolean) => { person.value.custom_fields = { ...(person.value.custom_fields || {}), __account_holder: v } },
})
const receivesComms = computed({
  get: () => !!person.value?.custom_fields?.__receives_comms,
  set: (v: boolean) => { person.value.custom_fields = { ...(person.value.custom_fields || {}), __receives_comms: v } },
})

// Which core fields actually show (skip optional ones switched off globally).
const visibleCore = computed(() => CORE_SECTIONS.map(s => ({
  ...s, fields: s.fields.map(f => ({ ...f, status: coreStatus(cfg.value, f) })).filter(f => f.status !== 'off'),
})))
const typeOptions = computed(() => personTypes.value.map(t => ({ label: t.label, value: t.key })))
const customFields = computed(() => {
  const keys = person.value?.person_types ?? []
  return fields.value.filter(f => keys.some((k: string) => fieldAppliesTo(f, k)))
})

async function load() {
  loading.value = true
  const id = route.params.id as string
  const [{ data: p }, all, flds, c] = await Promise.all([
    (db.from as any)('persons').select('*').eq('id', id).maybeSingle(),
    loadOrgTypes(orgId.value!),
    resolveFields(orgId.value!),
    loadConfig(),
  ])
  person.value = p
  if (person.value) {
    if (!person.value.custom_fields) person.value.custom_fields = {}
    if (!Array.isArray(person.value.person_types)) person.value.person_types = person.value.person_type ? [person.value.person_type] : []
    dobDate.value = person.value.dob ? new Date(person.value.dob) : null
  }
  personTypes.value = all.filter((t: any) => (t.kind ?? 'person') === 'person')
  fields.value = flds
  cfg.value = c
  loading.value = false
}

function fieldStatus(key: string) {
  for (const s of visibleCore.value) { const f = s.fields.find((x: any) => x.key === key); if (f) return f.status }
  return 'optional'
}
function reqMark(key: string) {
  const st = fieldStatus(key)
  if (st === 'required') return true
  if (key === 'email') return accountHolder.value || receivesComms.value
  if (key === 'phone') return !!cfg.value.required?.phone
  return false
}

async function save() {
  if (dobDate.value) {
    const d = dobDate.value
    person.value.dob = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  } else person.value.dob = null
  errors.value = coreErrors(cfg.value, person.value, { accountHolder: accountHolder.value, receivesComms: receivesComms.value })
  if (Object.keys(errors.value).length) {
    toast.add({ severity: 'warn', summary: 'Some required fields are missing', life: 3000 })
    return
  }
  saving.value = true
  await (db.from as any)('persons').update({
    first_name: person.value.first_name, last_name: person.value.last_name,
    email: person.value.email || null, phone: person.value.phone || null, phone2: person.value.phone2 || null,
    dob: person.value.dob, gender: person.value.gender || null,
    person_types: person.value.person_types, person_type: person.value.person_types[0] ?? null,
    custom_fields: person.value.custom_fields,
  }).eq('id', person.value.id)
  saving.value = false
  toast.add({ severity: 'success', summary: 'Saved', life: 1800 })
}
</script>

<template>
  <div class="p-3 sm:p-6 min-h-full flex flex-col">
    <div class="flex flex-col md:flex-row gap-4 md:gap-6 flex-1 min-h-0">
      <ProtoNav />
      <div class="flex-1 min-w-0 max-w-2xl">
        <div v-if="loading" class="text-sm text-gray-400">Loading…</div>
        <div v-else-if="!person" class="card p-8 text-center text-sm text-gray-400">Person not found.</div>
        <template v-else>
          <div class="mb-4 flex items-center gap-3">
            <button class="text-gray-400 hover:text-gray-700" @click="router.back()"><i class="pi pi-chevron-left" /></button>
            <h1 class="text-lg sm:text-xl font-semibold text-gray-900 flex-1 truncate">{{ person.first_name }} {{ person.last_name }}</h1>
            <Button label="Save" size="small" :loading="saving" @click="save" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
          </div>

          <!-- access & comms drivers -->
          <AppCard title="Access & communication" description="These decide whether an email address is required." class="mb-4">
            <div class="divide-y divide-gray-50">
              <div class="flex items-center justify-between px-4 sm:px-5 py-2.5">
                <div><p class="text-sm text-gray-800">Account holder</p><p class="text-[11px] text-gray-400">Can log in — needs an email.</p></div>
                <ToggleSwitch v-model="accountHolder" />
              </div>
              <div class="flex items-center justify-between px-4 sm:px-5 py-2.5">
                <div><p class="text-sm text-gray-800">Receives communications</p><p class="text-[11px] text-gray-400">Gets club emails — needs an email.</p></div>
                <ToggleSwitch v-model="receivesComms" />
              </div>
            </div>
          </AppCard>

          <!-- core sections -->
          <AppCard v-for="s in visibleCore" :key="s.key" :title="s.label" class="mb-4">
            <div class="px-4 sm:px-5 py-3 space-y-3">
              <div v-for="f in s.fields" :key="f.key">
                <label class="text-sm font-medium text-gray-600">{{ f.label }}<span v-if="reqMark(f.key)" class="text-rose-500"> *</span></label>
                <div class="mt-1">
                  <MultiSelect v-if="f.key === 'role'" v-model="person.person_types" :options="typeOptions" optionLabel="label" optionValue="value" display="chip" placeholder="Roles" class="w-full" />
                  <DatePicker v-else-if="f.key === 'dob'" v-model="dobDate" dateFormat="yy-mm-dd" showIcon class="w-full" />
                  <Select v-else-if="f.key === 'gender'" v-model="person.gender" :options="GENDERS" optionLabel="label" optionValue="value" placeholder="Select" class="w-full" />
                  <ToggleSwitch v-else-if="f.key === 'comms'" v-model="receivesComms" />
                  <InputText v-else v-model="person[f.key]" class="w-full" :class="{ 'p-invalid': errors[f.key] }" />
                </div>
                <p v-if="errors[f.key]" class="text-xs text-rose-500 mt-1">{{ errors[f.key] }}</p>
              </div>
            </div>
          </AppCard>

          <!-- type-specific custom fields -->
          <AppCard v-if="customFields.length" title="Other details" class="mb-4">
            <div class="px-4 sm:px-5 py-3 space-y-3">
              <div v-for="f in customFields" :key="f.id" class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-6">
                <label class="text-sm font-medium w-full sm:w-40 text-gray-600 flex items-center gap-1">
                  <i v-if="f.inherited" v-tooltip.top="'Set by ' + (f.ownerName || 'your governing body') + ' — values are locked'" class="pi pi-lock text-[10px] text-blue-400" />{{ f.label }}
                </label>
                <div class="w-full">
                  <Textarea v-if="f.field_type === 'textarea'" v-model="person.custom_fields[f.id]" class="w-full" rows="2" />
                  <InputNumber v-else-if="f.field_type === 'number'" v-model="person.custom_fields[f.id]" class="w-full" />
                  <Select v-else-if="f.field_type === 'select'" v-model="person.custom_fields[f.id]" :options="f.options" class="w-full" />
                  <ToggleSwitch v-else-if="f.field_type === 'checkbox'" :modelValue="!!person.custom_fields[f.id]" @update:modelValue="v => person.custom_fields[f.id] = v" />
                  <InputText v-else v-model="person.custom_fields[f.id]" class="w-full" />
                </div>
              </div>
            </div>
          </AppCard>

          <p class="text-xs text-gray-400">Email becomes required when “Account holder” or “Receives communications” is on. Phone is required only if set so in <NuxtLink to="/proto/core-fields" class="text-primary hover:underline">Personal &amp; communication</NuxtLink>.</p>
        </template>
        <Toast />
      </div>
    </div>
  </div>
</template>
