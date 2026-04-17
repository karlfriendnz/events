<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-semibold text-surface-900">Bookables</h1>
        <p class="text-sm text-surface-500 mt-0.5">Venues, persons, and items that can be booked for events.</p>
      </div>
      <Button label="New Venue" icon="pi pi-plus" size="small" @click="navigateTo('/bookables/new')" style="background:#1E2157; border-color:#1E2157" />
    </div>

    <!-- Filters -->
    <div class="flex items-center gap-3 mb-4">
      <IconField>
        <InputIcon class="pi pi-search" />
        <InputText v-model="search" placeholder="Search bookables…" size="small" class="w-64" />
      </IconField>
      <Select
        v-model="typeFilter"
        :options="typeOptions"
        option-label="label"
        option-value="value"
        placeholder="All types"
        size="small"
        class="w-40"
      />
      <Select
        v-model="statusFilter"
        :options="statusOptions"
        option-label="label"
        option-value="value"
        placeholder="All statuses"
        size="small"
        class="w-40"
      />
    </div>

    <div class="card">
      <DataTable
        :value="filtered"
        :loading="loading"
        row-hover
        striped-rows
        size="small"
      >
        <template #empty>
          <div class="text-center py-12 text-surface-400">
            <i class="pi pi-building text-3xl mb-3 block" />
            <p>No bookables yet. Add a venue, person, or item.</p>
          </div>
        </template>

        <Column field="name" header="Name" min-header-width="200">
          <template #body="{ data }">
            <div class="flex items-center gap-1">
              <span
                v-for="_ in getDepth(data)"
                :key="_"
                class="text-gray-300 text-xs"
              >›</span>
              <i
                class="pi text-xs mr-1"
                :class="getDepth(data) === 0 ? 'pi-building text-[#1E2157]' : 'pi-sitemap text-gray-400'"
              />
              <div>
                <p class="font-medium text-surface-900">{{ data.name }}</p>
                <p v-if="data.internal_name" class="text-xs text-surface-500">{{ data.internal_name }}</p>
                <p v-if="data.parent_id && getParentName(data)" class="text-xs text-gray-400">
                  <i class="pi pi-arrow-up text-xs mr-0.5" />{{ getParentName(data) }}
                </p>
              </div>
            </div>
          </template>
        </Column>

        <Column field="type" header="Type" style="width:110px">
          <template #body="{ data }">
            <Tag :value="data.type" :severity="typeSeverity(data.type)" />
          </template>
        </Column>

        <Column field="status" header="Status" style="width:100px">
          <template #body="{ data }">
            <Tag :value="data.status" :severity="statusSeverity(data.status)" />
          </template>
        </Column>

        <Column field="location" header="Location">
          <template #body="{ data }">
            <span class="text-surface-600 text-sm">{{ data.location || '—' }}</span>
          </template>
        </Column>

        <Column field="max_concurrent" header="Max Concurrent" style="width:130px">
          <template #body="{ data }">
            <span class="text-surface-600 text-sm">{{ data.max_concurrent }}</span>
          </template>
        </Column>

        <Column field="is_public" header="Public" style="width:80px">
          <template #body="{ data }">
            <i :class="data.is_public ? 'pi pi-check-circle text-green-500' : 'pi pi-times-circle text-surface-300'" />
          </template>
        </Column>

        <Column style="width:60px">
          <template #body="{ data }">
            <Button
              icon="pi pi-ellipsis-v"
              severity="secondary"
              text
              rounded
              size="small"
              @click.stop="openMenu($event, data)"
            />
          </template>
        </Column>
      </DataTable>
    </div>

    <Menu ref="rowMenu" :model="menuItems" :popup="true" />

    <!-- Create Dialog -->
    <Dialog v-model:visible="showCreate" header="New Bookable" modal style="width: 480px">
      <div class="flex flex-col gap-4">
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Name</label>
            <InputText v-model="form.name" autofocus placeholder="e.g. Main Oval" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Internal Name</label>
            <InputText v-model="form.internal_name" placeholder="Optional" />
          </div>
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Type</label>
          <Select v-model="form.type" :options="['VENUE', 'PERSON', 'ITEM']" class="w-full" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Location / Description</label>
          <InputText v-model="form.location" placeholder="Address or description" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Max Concurrent Bookings</label>
            <InputNumber v-model="form.max_concurrent" :min="1" />
          </div>
          <div class="flex items-end gap-4 pb-1">
            <div class="flex items-center gap-2">
              <Checkbox v-model="form.is_public" :binary="true" />
              <label class="text-sm">Public</label>
            </div>
          </div>
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Description</label>
          <Textarea v-model="form.description" rows="2" auto-resize />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showCreate = false" />
        <Button label="Create" :loading="creating" :disabled="!form.name.trim()" @click="handleCreate" />
      </template>
    </Dialog>

    <!-- Edit Dialog -->
    <Dialog v-model:visible="showEdit" header="Edit Bookable" modal style="width: 480px">
      <div class="flex flex-col gap-4" v-if="editTarget">
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Name</label>
            <InputText v-model="editTarget.name" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Internal Name</label>
            <InputText v-model="editTarget.internal_name" />
          </div>
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Status</label>
          <Select v-model="editTarget.status" :options="['ACTIVE', 'DRAFT', 'ARCHIVED']" class="w-full" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Location</label>
          <InputText v-model="editTarget.location" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Max Concurrent</label>
          <InputNumber v-model="editTarget.max_concurrent" :min="1" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Description</label>
          <Textarea v-model="editTarget.description" rows="2" auto-resize />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showEdit = false" />
        <Button label="Save" :loading="saving" @click="handleEdit" />
      </template>
    </Dialog>

    <Toast />
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'

const db = useDb()
const toast = useToast()

const bookables = ref<any[]>([])
const loading = ref(true)
const search = ref('')
const typeFilter = ref('')
const statusFilter = ref('')
const showCreate = ref(false)
const showEdit = ref(false)
const creating = ref(false)
const saving = ref(false)
const editTarget = ref<any>(null)
const rowMenu = ref()
const menuItems = ref<any[]>([])

const form = ref({ name: '', internal_name: '', type: 'VENUE', location: '', max_concurrent: 1, is_public: false, description: '' })

const typeOptions = [
  { label: 'All types', value: '' },
  { label: 'Venue', value: 'VENUE' },
  { label: 'Person', value: 'PERSON' },
  { label: 'Item', value: 'ITEM' },
]
const statusOptions = [
  { label: 'All statuses', value: '' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Archived', value: 'ARCHIVED' },
]

function typeSeverity(t: string) {
  return { VENUE: 'info', PERSON: 'success', ITEM: 'warn' }[t] ?? 'secondary'
}
function statusSeverity(s: string) {
  return { ACTIVE: 'success', DRAFT: 'secondary', ARCHIVED: 'warn', DELETED: 'danger' }[s] ?? 'secondary'
}

const filtered = computed(() => bookables.value.filter(b => {
  const matchSearch = b.name.toLowerCase().includes(search.value.toLowerCase())
  const matchType = !typeFilter.value || b.type === typeFilter.value
  const matchStatus = !statusFilter.value || b.status === statusFilter.value
  return matchSearch && matchType && matchStatus
}))

function getDepth(item: any, visited = new Set()): number {
  if (!item.parent_id || visited.has(item.id)) return 0
  visited.add(item.id)
  const parent = bookables.value.find(b => b.id === item.parent_id)
  return parent ? 1 + getDepth(parent, visited) : 0
}

function getParentName(item: any): string | null {
  if (!item.parent_id) return null
  return bookables.value.find(b => b.id === item.parent_id)?.name ?? null
}

async function load() {
  loading.value = true
  const { DEFAULT_ORG_ID } = await import('~/composables/useDb')
  const { data } = await db.from('bookables').select('*').eq('org_id', DEFAULT_ORG_ID).neq('status', 'DELETED').order('name')
  // Sort to show parents before children
  const raw = data ?? []
  const sorted: any[] = []
  function addSorted(parentId: string | null) {
    for (const item of raw.filter(b => b.parent_id === parentId)) {
      sorted.push(item)
      addSorted(item.id)
    }
  }
  addSorted(null)
  // Include any orphaned items (parent deleted)
  for (const item of raw) {
    if (!sorted.find(s => s.id === item.id)) sorted.push(item)
  }
  bookables.value = sorted
  loading.value = false
}

async function handleCreate() {
  if (!form.value.name.trim()) return
  creating.value = true
  const { DEFAULT_ORG_ID } = await import('~/composables/useDb')
  const { error } = await db.from('bookables').insert({
    org_id: DEFAULT_ORG_ID,
    name: form.value.name.trim(),
    internal_name: form.value.internal_name || null,
    type: form.value.type,
    location: form.value.location || null,
    max_concurrent: form.value.max_concurrent,
    is_public: form.value.is_public,
    description: form.value.description || null,
  })
  if (!error) {
    toast.add({ severity: 'success', summary: 'Bookable created', life: 3000 })
    showCreate.value = false
    form.value = { name: '', internal_name: '', type: 'VENUE', location: '', max_concurrent: 1, is_public: false, description: '' }
    load()
  }
  creating.value = false
}

function openMenu(event: Event, row: any) {
  menuItems.value = [
    { label: 'Edit', icon: 'pi pi-pencil', command: () => { editTarget.value = { ...row }; showEdit.value = true } },
    { label: 'Add Sub-venue', icon: 'pi pi-sitemap', command: () => navigateTo(`/bookables/new?parentId=${row.id}&parentName=${encodeURIComponent(row.name)}`) },
    { separator: true },
    {
      label: 'Archive',
      icon: 'pi pi-trash',
      class: 'text-red-500',
      command: async () => {
        await db.from('bookables').update({ status: 'ARCHIVED' }).eq('id', row.id)
        toast.add({ severity: 'success', summary: 'Bookable archived', life: 3000 })
        load()
      }
    },
  ]
  rowMenu.value.toggle(event)
}

async function handleEdit() {
  saving.value = true
  const { error } = await db.from('bookables').update({
    name: editTarget.value.name,
    internal_name: editTarget.value.internal_name || null,
    status: editTarget.value.status,
    location: editTarget.value.location || null,
    max_concurrent: editTarget.value.max_concurrent,
    description: editTarget.value.description || null,
  }).eq('id', editTarget.value.id)
  if (!error) {
    toast.add({ severity: 'success', summary: 'Saved', life: 3000 })
    showEdit.value = false
    load()
  }
  saving.value = false
}

onMounted(load)
</script>
