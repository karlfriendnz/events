<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-semibold text-surface-900">Registration</h1>
        <p class="text-sm text-surface-500 mt-0.5">Registration forms, custom fields, and terms & conditions.</p>
      </div>
      <Button label="New Form" icon="pi pi-plus" size="small" @click="showCreate = true" />
    </div>

    <!-- Forms list -->
    <div class="card">
      <DataTable :value="forms" :loading="loading" row-hover striped-rows size="small"
        @row-click="e => selectedForm = e.data">
        <template #empty>
          <div class="text-center py-12 text-surface-400">
            <i class="pi pi-clipboard text-3xl mb-3 block" />
            <p>No registration forms yet.</p>
          </div>
        </template>

        <Column field="name" header="Form Name" />
        <Column field="status" header="Status" style="width:110px">
          <template #body="{ data }">
            <Tag :value="data.status" :severity="data.status === 'PUBLISHED' ? 'success' : 'secondary'" />
          </template>
        </Column>
        <Column header="Fields" style="width:80px">
          <template #body="{ data }">
            <span class="text-surface-600">{{ data.field_count ?? 0 }}</span>
          </template>
        </Column>
        <Column field="updated_at" header="Updated" style="width:140px">
          <template #body="{ data }">
            <span class="text-sm text-surface-600">{{ formatDate(data.updated_at) }}</span>
          </template>
        </Column>
        <Column style="width:60px">
          <template #body="{ data }">
            <Button icon="pi pi-ellipsis-v" severity="secondary" text rounded size="small"
              @click.stop="openMenu($event, data)" />
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- Form detail panel -->
    <div v-if="selectedForm" class="mt-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-base font-semibold text-surface-800">{{ selectedForm.name }}</h2>
        <Button icon="pi pi-times" severity="secondary" text rounded size="small" @click="selectedForm = null" />
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div class="card p-4">
          <h3 class="text-sm font-semibold text-surface-700 mb-3">Form Fields</h3>
          <div v-if="formFields.length" class="space-y-2">
            <div v-for="field in formFields" :key="field.id"
              class="flex items-center justify-between p-2 bg-surface-50 rounded border border-surface-100">
              <div>
                <p class="text-sm font-medium">{{ field.label }}</p>
                <p class="text-xs text-surface-500">{{ field.field_type }} {{ field.is_required ? '· Required' : '' }}</p>
              </div>
              <Button icon="pi pi-trash" severity="danger" text rounded size="small"
                @click="deleteField(field.id)" />
            </div>
          </div>
          <div v-else class="text-sm text-surface-400 py-4 text-center">No fields yet.</div>
          <Button label="Add Field" icon="pi pi-plus" size="small" class="mt-3 w-full" severity="secondary"
            @click="showAddField = true" />
        </div>
        <div class="card p-4">
          <h3 class="text-sm font-semibold text-surface-700 mb-3">Terms & Conditions</h3>
          <Textarea v-model="selectedForm.tc_content" rows="6" class="w-full text-sm" auto-resize
            placeholder="Enter T&Cs text here…" />
          <Button label="Save T&Cs" size="small" class="mt-3" @click="saveTCs" />
        </div>
      </div>
    </div>

    <Menu ref="rowMenu" :model="menuItems" :popup="true" />

    <!-- Create Form Dialog -->
    <Dialog v-model:visible="showCreate" header="New Registration Form" modal style="width: 380px">
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Form Name</label>
          <InputText v-model="newFormName" autofocus placeholder="e.g. Standard Registration" />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showCreate = false" />
        <Button label="Create" :loading="creating" :disabled="!newFormName.trim()" @click="handleCreate" />
      </template>
    </Dialog>

    <!-- Add Field Dialog -->
    <Dialog v-model:visible="showAddField" header="Add Field" modal style="width: 380px">
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Field Label</label>
          <InputText v-model="newField.label" autofocus placeholder="e.g. Dietary requirements" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Field Type</label>
          <Select v-model="newField.field_type"
            :options="['TEXT', 'TEXTAREA', 'SELECT', 'MULTISELECT', 'CHECKBOX', 'DATE', 'FILE']"
            class="w-full" />
        </div>
        <div class="flex items-center gap-2">
          <Checkbox v-model="newField.is_required" :binary="true" />
          <label class="text-sm">Required</label>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showAddField = false" />
        <Button label="Add" :loading="addingField" :disabled="!newField.label.trim()" @click="handleAddField" />
      </template>
    </Dialog>

    <Toast />
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'

const db = useDb()
const toast = useToast()

const forms = ref<any[]>([])
const formFields = ref<any[]>([])
const loading = ref(true)
const creating = ref(false)
const addingField = ref(false)
const showCreate = ref(false)
const showAddField = ref(false)
const selectedForm = ref<any>(null)
const newFormName = ref('')
const newField = ref({ label: '', field_type: 'TEXT', is_required: false })
const rowMenu = ref()
const menuItems = ref<any[]>([])

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

watch(selectedForm, async (form) => {
  if (!form) { formFields.value = []; return }
  const { data } = await db.from('form_fields').select('*').eq('form_id', form.id).order('sort_order')
  formFields.value = data ?? []
})

async function load() {
  loading.value = true
  const { DEFAULT_ORG_ID } = await import('~/composables/useDb')
  const { data } = await db.from('registration_forms').select('*').eq('org_id', DEFAULT_ORG_ID).order('updated_at', { ascending: false })
  forms.value = (data ?? []).map(f => ({ ...f, field_count: 0 }))
  loading.value = false
}

async function handleCreate() {
  if (!newFormName.value.trim()) return
  creating.value = true
  const { DEFAULT_ORG_ID } = await import('~/composables/useDb')
  const { error } = await db.from('registration_forms').insert({
    org_id: DEFAULT_ORG_ID,
    name: newFormName.value.trim(),
    status: 'DRAFT',
    schema: [],
  })
  if (!error) {
    toast.add({ severity: 'success', summary: 'Form created', life: 3000 })
    showCreate.value = false
    newFormName.value = ''
    load()
  }
  creating.value = false
}

async function handleAddField() {
  if (!newField.value.label.trim() || !selectedForm.value) return
  addingField.value = true
  const maxOrder = formFields.value.length
  const { error } = await db.from('form_fields').insert({
    form_id: selectedForm.value.id,
    label: newField.value.label,
    field_type: newField.value.field_type,
    is_required: newField.value.is_required,
    sort_order: maxOrder,
  })
  if (!error) {
    toast.add({ severity: 'success', summary: 'Field added', life: 3000 })
    showAddField.value = false
    newField.value = { label: '', field_type: 'TEXT', is_required: false }
    const { data } = await db.from('form_fields').select('*').eq('form_id', selectedForm.value.id).order('sort_order')
    formFields.value = data ?? []
  }
  addingField.value = false
}

async function deleteField(fieldId: string) {
  await db.from('form_fields').delete().eq('id', fieldId)
  formFields.value = formFields.value.filter(f => f.id !== fieldId)
}

async function saveTCs() {
  if (!selectedForm.value) return
  await db.from('registration_forms').update({ tc_content: selectedForm.value.tc_content }).eq('id', selectedForm.value.id)
  toast.add({ severity: 'success', summary: 'T&Cs saved', life: 3000 })
}

function openMenu(event: Event, row: any) {
  menuItems.value = [
    { label: 'View / Edit', icon: 'pi pi-pencil', command: () => { selectedForm.value = row } },
    {
      label: row.status === 'PUBLISHED' ? 'Unpublish' : 'Publish',
      icon: 'pi pi-send',
      command: async () => {
        const newStatus = row.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED'
        await db.from('registration_forms').update({ status: newStatus }).eq('id', row.id)
        toast.add({ severity: 'success', summary: `Form ${newStatus.toLowerCase()}`, life: 3000 })
        load()
      }
    },
    { separator: true },
    {
      label: 'Delete',
      icon: 'pi pi-trash',
      class: 'text-red-500',
      command: async () => {
        await db.from('registration_forms').delete().eq('id', row.id)
        toast.add({ severity: 'success', summary: 'Form deleted', life: 3000 })
        load()
      }
    },
  ]
  rowMenu.value.toggle(event)
}

onMounted(load)
</script>
