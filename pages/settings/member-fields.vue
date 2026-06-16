<!--
  Field engine. Each org owns a "member fields" form built with the global
  <FormBuilder> (edited at /forms/:id). A club inherits its governing bodies'
  member fields (e.g. NSO-required) and adds its own. This page lets the org pick
  / create / edit its own form, and shows the inherited fields read-only.
-->
<script setup lang="ts">
const db = useDb()
const { orgId } = useOrg()
const route = useRoute()
const toast = useToast()
const { resolveChain, formFields } = useOrgFieldPolicy()

const memberFormId = ref<string | null>(null)
const orgName = ref('')
const allForms = ref<{ id: string; name: string }[]>([])
const inherited = ref<{ orgName: string; orgLevel: string; fields: any[] }[]>([])
const ownFields = ref<any[]>([])
const loading = ref(true)
const here = computed(() => route.fullPath.split('?')[0])

async function load() {
  loading.value = true
  const [{ data: org }, { data: forms }] = await Promise.all([
    (db.from as any)('organisations').select('name, member_form_id').eq('id', orgId.value).single(),
    (db.from as any)('registration_forms').select('id, name').eq('org_id', orgId.value).order('name'),
  ])
  orgName.value = org?.name ?? ''
  memberFormId.value = org?.member_form_id ?? null
  allForms.value = forms ?? []

  // Inherited chain (ancestors only) + own fields.
  const chain = await resolveChain(orgId.value as string)
  const ancestorLinks = chain.filter(l => l.inherited)
  inherited.value = await Promise.all(ancestorLinks.map(async l => ({
    orgName: l.orgName, orgLevel: l.orgLevel, fields: await formFields(l.formId),
  })))
  ownFields.value = memberFormId.value ? await formFields(memberFormId.value) : []
  loading.value = false
}

async function setForm(id: string | null) {
  memberFormId.value = id
  await (db.from as any)('organisations').update({ member_form_id: id }).eq('id', orgId.value)
  await load()
  toast.add({ severity: 'success', summary: 'Member fields form updated', life: 2000 })
}

function editForm() {
  if (memberFormId.value) navigateTo(`/forms/${memberFormId.value}?return=${encodeURIComponent(here.value)}`)
}
function createForm() {
  navigateTo(`/forms/new?return=${encodeURIComponent(here.value)}&name=${encodeURIComponent(orgName.value + ' member fields')}`)
}

onMounted(async () => {
  await load()
  const returningId = (route.query.form_id as string | undefined) ?? null
  if (returningId && returningId !== memberFormId.value) await setForm(returningId)
})
</script>

<template>
  <div class="p-6 max-w-3xl mx-auto space-y-5">
    <div>
      <h1 class="text-xl font-semibold text-gray-900">Member fields</h1>
      <p class="text-sm text-gray-500">The fields collected when someone registers. Built with the standard form builder. Your governing bodies' required fields are inherited automatically.</p>
    </div>

    <!-- Inherited (read-only) -->
    <div v-if="inherited.length" class="card p-0 overflow-hidden">
      <div class="bg-blue-50 px-5 py-2.5 border-b border-blue-100 text-sm font-semibold text-blue-800">
        <i class="pi pi-lock mr-1.5" />Inherited from your governing bodies
      </div>
      <div v-for="(src, i) in inherited" :key="i" class="px-5 py-3 border-b border-gray-50 last:border-0">
        <p class="text-xs font-semibold text-gray-500 mb-1.5">{{ src.orgName }} <span class="text-gray-300">· {{ orgLevelLabel(src.orgLevel) }}</span></p>
        <div v-if="!src.fields.length" class="text-xs text-gray-400">No required fields.</div>
        <div v-else class="flex flex-wrap gap-1.5">
          <span v-for="f in src.fields" :key="f.id"
            class="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 inline-flex items-center gap-1">
            {{ f.label }}
            <span v-if="f.is_required" class="text-red-500" title="Required">*</span>
          </span>
        </div>
      </div>
    </div>

    <!-- This org's own member fields -->
    <div class="card p-5 space-y-3">
      <h2 class="text-sm font-semibold text-gray-700">This organisation's member fields</h2>
      <div class="flex items-end gap-2">
        <div class="flex flex-col gap-1.5 flex-1">
          <label class="text-xs font-medium text-gray-600">Form</label>
          <Select :modelValue="memberFormId" :options="allForms" option-label="name" option-value="id"
            placeholder="No member form set" show-clear filter class="w-full"
            @update:modelValue="setForm($event)" />
        </div>
        <Button v-if="memberFormId" label="Edit" icon="pi pi-pencil" severity="secondary" outlined @click="editForm" />
        <Button label="New form" icon="pi pi-plus" style="background:#1E2157;border-color:#1E2157" @click="createForm" />
      </div>
      <div v-if="ownFields.length" class="flex flex-wrap gap-1.5 pt-1">
        <span v-for="f in ownFields" :key="f.id" class="text-xs px-2 py-1 rounded bg-[#1E2157]/10 text-[#1E2157] inline-flex items-center gap-1">
          {{ f.label }}<span v-if="f.is_required" class="text-red-500">*</span>
        </span>
      </div>
      <p class="text-xs text-gray-400">Editing opens the standard form builder. Inherited fields above are always collected on top of these.</p>
    </div>
  </div>
</template>
