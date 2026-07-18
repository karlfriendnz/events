<!--
  Settings → Fields. The whole field catalogue at a glance: every field the club
  has (own + inherited from governing bodies), as a GRID of fields × person
  types, showing which types each field is connected to. Clicking a cell for an
  OWN field toggles that connection (writes field_definitions.targets[]);
  inherited (NSO) fields are read-only ticks. Fields are created contextually in
  the profile Layout builder (People & Entities) — this page is the catalogue.
-->
<script setup lang="ts">
const { orgId } = useOrg()
const toast = useToast()
const { resolveFields, resolvePersonTypes, fieldAppliesTo } = useOrgFieldPolicy()
const { createField: apiCreateField, updateField } = usePersonTypesApi()

const loading = ref(true)
const fields = ref<any[]>([])
const types = ref<any[]>([])
const search = ref('')
const savingKey = ref<string | null>(null)

// ── Add a new field ──
const addOpen = ref(false)
const creating = ref(false)
const draft = reactive<{ label: string; field_type: string; options: string; targets: string[] }>({ label: '', field_type: 'text', options: '', targets: [] })
const FIELD_TYPES = [
  { label: 'Short text', value: 'text' }, { label: 'Long text', value: 'textarea' },
  { label: 'Number', value: 'number' }, { label: 'Date', value: 'date' },
  { label: 'Email', value: 'email' }, { label: 'Phone', value: 'phone' },
  { label: 'Dropdown', value: 'select' }, { label: 'Checkbox', value: 'checkbox' },
]
function openAdd() { draft.label = ''; draft.field_type = 'text'; draft.options = ''; draft.targets = []; addOpen.value = true }
async function createField() {
  if (!draft.label.trim() || !draft.targets.length) return
  creating.value = true
  const opts = draft.field_type === 'select' ? draft.options.split('\n').map(o => o.trim()).filter(Boolean) : []
  try {
    await apiCreateField({
      orgId: orgId.value, label: draft.label.trim(), fieldType: draft.field_type,
      target: draft.targets[0], targets: draft.targets, isRequired: false, options: opts,
      meta: { col_span: 1 }, rules: [], sortOrder: fields.value.length,
    })
  } catch (e: any) {
    creating.value = false
    toast.add({ severity: 'error', summary: 'Failed', detail: e?.data?.message || e?.message, life: 4000 }); return
  }
  creating.value = false
  addOpen.value = false
  toast.add({ severity: 'success', summary: 'Field added', life: 2000 })
  await load()
}

const personTypes = computed(() => types.value.filter(t => (t.kind ?? 'person') === 'person'))

async function load() {
  if (!orgId.value) return
  loading.value = true
  const [flds, tps] = await Promise.all([resolveFields(orgId.value), resolvePersonTypes(orgId.value)])
  // Sort: own first, then inherited; alpha within.
  fields.value = (flds ?? []).slice().sort((a: any, b: any) =>
    (a.inherited === b.inherited ? 0 : a.inherited ? 1 : -1) || (a.label || '').localeCompare(b.label || ''))
  types.value = tps ?? []
  loading.value = false
}
onMounted(load)
watch(orgId, v => { if (v) load() })

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return fields.value
  return fields.value.filter(f => (f.label || '').toLowerCase().includes(q) || (f.field_type || '').toLowerCase().includes(q))
})

function applies(f: any, key: string) { return fieldAppliesTo(f, key) }

// Toggle a field↔type connection (own fields only). Writes targets[].
async function toggle(f: any, typeKey: string) {
  if (f.inherited) return
  const current: string[] = (Array.isArray(f.targets) && f.targets.length ? f.targets : [f.target || 'member']).map((s: string) => s.toLowerCase())
  const k = typeKey.toLowerCase()
  const next = current.includes(k) ? current.filter(x => x !== k) : [...current, k]
  savingKey.value = f.id
  // NOTE: the field-definition patch contract types `target` as a non-nullable
  // string, so when the last type is unticked (next=[]) we can't clear target to
  // null as the raw write did — we leave the legacy anchor unchanged. Minor: a
  // fully-disconnected field keeps its old single-target fallback until re-edited.
  await updateField(f.id, { targets: next, target: next[0] ?? undefined })
  savingKey.value = null
  f.targets = next; f.target = next[0] ?? f.target
  toast.add({ severity: 'success', summary: 'Updated', life: 1200 })
}

function typeCount(f: any) { return personTypes.value.filter(t => applies(f, t.key)).length }
</script>

<template>
  <div class="p-3 sm:p-6 min-h-full flex flex-col">
    <div class="flex flex-col md:flex-row gap-4 md:gap-6 flex-1 min-h-0">
      <SettingsNav />
      <div class="flex-1 min-w-0 space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 class="text-lg sm:text-2xl font-semibold text-gray-900">Fields</h1>
            <p class="text-sm text-gray-500">Every field in your club and which person types it's connected to. Tick a cell to connect an own field to a type; inherited fields are locked.</p>
          </div>
          <div class="flex items-center gap-2 w-full sm:w-auto">
            <span class="relative flex-1 sm:w-64">
              <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
              <InputText v-model="search" placeholder="Search fields…" class="w-full !pl-8" size="small" />
            </span>
            <Button label="Add field" icon="pi pi-plus" size="small" class="shrink-0" @click="openAdd" style="background:#1E2157;border-color:#1E2157" />
          </div>
        </div>

        <div v-if="loading" class="text-sm text-gray-400">Loading…</div>
        <p v-else-if="!fields.length" class="card p-8 text-center text-sm text-gray-400">No fields yet — add them in the profile layout of a <NuxtLink to="/settings/fields" class="text-primary hover:underline">person type</NuxtLink>.</p>

        <div v-else class="card p-0 overflow-x-auto">
          <table class="text-sm border-collapse">
            <thead>
              <tr class="bg-gray-50 border-b border-gray-200">
                <th class="sticky left-0 z-10 bg-gray-50 text-left px-4 py-2.5 font-semibold text-gray-600 min-w-[220px]">Field</th>
                <th class="px-2 py-2.5 font-medium text-gray-500 text-center w-20">Type</th>
                <th v-for="pt in personTypes" :key="pt.key" class="px-2 py-2.5 font-medium text-gray-500 text-center min-w-[80px]">
                  <span class="inline-block leading-tight text-xs">{{ pt.label }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="f in filtered" :key="f.id" class="border-b border-gray-50 hover:bg-gray-50/50">
                <td class="sticky left-0 z-10 bg-white px-4 py-2 align-middle">
                  <span class="flex items-center gap-1.5">
                    <span class="font-medium text-gray-800">{{ f.label }}</span>
                    <i v-if="f.inherited" v-tooltip.top="'Inherited from ' + f.ownerName + ' — locked'" class="pi pi-lock text-[10px] text-gray-300" />
                    <span class="ml-auto text-[10px] text-gray-300">{{ typeCount(f) }}</span>
                  </span>
                </td>
                <td class="px-2 py-2 text-center">
                  <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{{ f.field_type }}</span>
                </td>
                <td v-for="pt in personTypes" :key="pt.key" class="px-2 py-2 text-center">
                  <button type="button"
                    class="w-5 h-5 rounded inline-flex items-center justify-center transition-colors"
                    :class="[
                      applies(f, pt.key) ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-transparent hover:bg-gray-200',
                      f.inherited ? 'cursor-default opacity-80' : 'cursor-pointer',
                      savingKey === f.id ? 'opacity-50' : ''
                    ]"
                    :disabled="f.inherited || savingKey === f.id"
                    :title="applies(f, pt.key) ? (f.inherited ? 'Connected (inherited, locked)' : 'Connected — click to disconnect') : 'Click to connect'"
                    @click="toggle(f, pt.key)">
                    <i class="pi pi-check text-[10px]" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <Dialog v-model:visible="addOpen" modal header="Add a field" :style="{ width: '95vw', maxWidth: '32rem' }">
      <div class="space-y-4">
        <div class="flex flex-col gap-1.5"><label class="text-sm font-medium">Field name</label><InputText v-model="draft.label" placeholder="e.g. Medical notes" autofocus /></div>
        <div class="flex flex-col gap-1.5"><label class="text-sm font-medium">Type</label><Select v-model="draft.field_type" :options="FIELD_TYPES" optionLabel="label" optionValue="value" class="w-full" /></div>
        <div v-if="draft.field_type === 'select'" class="flex flex-col gap-1.5"><label class="text-sm font-medium">Options <span class="text-gray-400 font-normal">— one per line</span></label><Textarea v-model="draft.options" rows="4" placeholder="Beginner&#10;Intermediate&#10;Advanced" /></div>
        <div class="flex flex-col gap-1.5"><label class="text-sm font-medium">Applies to</label><ChipMultiSelect v-model="draft.targets" :options="personTypes" optionLabel="label" optionValue="key" placeholder="Which person types?" class="w-full" /></div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="addOpen = false" />
        <Button label="Add field" :loading="creating" :disabled="!draft.label.trim() || !draft.targets.length" @click="createField" style="background:#1E2157;border-color:#1E2157" />
      </template>
    </Dialog>
    <Toast />
  </div>
</template>
