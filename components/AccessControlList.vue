<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-semibold text-surface-900">Access Control</h1>
        <p class="text-sm text-surface-500 mt-0.5">
          Doors and lights you can connect to venues. Bookings on a connected venue
          generate an access code and an unlock window automatically.
        </p>
      </div>
      <Button
        :label="activeTab === 'doors' ? 'New door' : 'New light zone'"
        icon="pi pi-plus" size="small"
        style="background:var(--brand-primary);border-color:var(--brand-primary)"
        @click="openCreate(activeTab)" />
    </div>

    <Tabs v-model:value="activeTab">
      <TabList>
        <Tab value="doors"><i class="pi pi-key text-xs mr-2" />Doors</Tab>
        <Tab value="lights"><i class="pi pi-sun text-xs mr-2" />Lights</Tab>
      </TabList>

      <TabPanels>
        <!-- DOORS -->
        <TabPanel value="doors">
          <div class="mt-4">
            <div v-if="!loading && !doors.length"
              class="text-center py-16 px-6 bg-white rounded-xl border-2 border-dashed border-primary/20">
              <div class="w-16 h-16 mx-auto rounded-full bg-[#EFF6FF] flex items-center justify-center mb-4">
                <i class="pi pi-key text-2xl text-primary" />
              </div>
              <h3 class="text-base font-semibold text-gray-900 mb-1">Add your first door</h3>
              <p class="text-sm text-gray-500 mb-5 max-w-sm mx-auto">
                Doors are the physical entry points (gates, magnetic locks, smart locks)
                you'll connect to venues.
              </p>
              <Button label="New door" icon="pi pi-plus"
                style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="openCreate('doors')" />
            </div>
            <div v-else class="card overflow-x-auto">
              <DataTable :value="doors" :loading="loading" size="small" striped-rows row-hover
                @row-click="(e: any) => openEdit('doors', e.data)">
                <Column field="name" header="Name" />
                <Column header="Hardware">
                  <template #body="{ data }">
                    <span class="text-sm text-surface-600">
                      {{ data.hardware_provider ? `${data.hardware_provider}${data.hardware_id ? ` · ${data.hardware_id}` : ''}` : '—' }}
                    </span>
                  </template>
                </Column>
                <Column header="Unlock" style="width:120px">
                  <template #body="{ data }">
                    <span class="text-sm text-surface-600">{{ data.default_unlock_seconds }}s</span>
                  </template>
                </Column>
                <Column header="Connected" style="width:120px">
                  <template #body="{ data }">
                    <span class="text-sm text-surface-600">{{ doorVenueCounts[data.id] ?? 0 }} venue{{ (doorVenueCounts[data.id] ?? 0) === 1 ? '' : 's' }}</span>
                  </template>
                </Column>
                <Column header="Active" style="width:80px">
                  <template #body="{ data }">
                    <i :class="data.is_active ? 'pi pi-check-circle text-green-500' : 'pi pi-times-circle text-surface-300'" />
                  </template>
                </Column>
                <Column style="width:60px">
                  <template #body="{ data }">
                    <Button icon="pi pi-ellipsis-v" severity="secondary" text rounded size="small"
                      @click.stop="openMenu($event, 'doors', data)" />
                  </template>
                </Column>
              </DataTable>
            </div>
          </div>
        </TabPanel>

        <!-- LIGHTS -->
        <TabPanel value="lights">
          <div class="mt-4">
            <div v-if="!loading && !zones.length"
              class="text-center py-16 px-6 bg-white rounded-xl border-2 border-dashed border-primary/20">
              <div class="w-16 h-16 mx-auto rounded-full bg-[#EFF6FF] flex items-center justify-center mb-4">
                <i class="pi pi-sun text-2xl text-primary" />
              </div>
              <h3 class="text-base font-semibold text-gray-900 mb-1">Add your first light zone</h3>
              <p class="text-sm text-gray-500 mb-5 max-w-sm mx-auto">
                Light zones are LED groups or dimmer circuits you can switch on while
                a venue is in use.
              </p>
              <Button label="New light zone" icon="pi pi-plus"
                style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="openCreate('lights')" />
            </div>
            <div v-else class="card overflow-x-auto">
              <DataTable :value="zones" :loading="loading" size="small" striped-rows row-hover
                @row-click="(e: any) => openEdit('lights', e.data)">
                <Column field="name" header="Name" />
                <Column header="Hardware">
                  <template #body="{ data }">
                    <span class="text-sm text-surface-600">
                      {{ data.hardware_provider ? `${data.hardware_provider}${data.hardware_id ? ` · ${data.hardware_id}` : ''}` : '—' }}
                    </span>
                  </template>
                </Column>
                <Column header="Default level" style="width:120px">
                  <template #body="{ data }">
                    <span class="text-sm text-surface-600">{{ data.default_level_percent }}%</span>
                  </template>
                </Column>
                <Column header="Connected" style="width:120px">
                  <template #body="{ data }">
                    <span class="text-sm text-surface-600">{{ zoneVenueCounts[data.id] ?? 0 }} venue{{ (zoneVenueCounts[data.id] ?? 0) === 1 ? '' : 's' }}</span>
                  </template>
                </Column>
                <Column header="Active" style="width:80px">
                  <template #body="{ data }">
                    <i :class="data.is_active ? 'pi pi-check-circle text-green-500' : 'pi pi-times-circle text-surface-300'" />
                  </template>
                </Column>
                <Column style="width:60px">
                  <template #body="{ data }">
                    <Button icon="pi pi-ellipsis-v" severity="secondary" text rounded size="small"
                      @click.stop="openMenu($event, 'lights', data)" />
                  </template>
                </Column>
              </DataTable>
            </div>
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>

    <Menu ref="rowMenu" :model="rowMenuItems" :popup="true" />

    <!-- Edit Dialog -->
    <Dialog v-model:visible="editVisible" :header="editHeader" modal :style="{ width: '95vw', maxWidth: '480px' }">
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Name</label>
          <InputText v-model="editForm.name" autofocus :placeholder="editKind === 'doors' ? 'e.g. Main Gate' : 'e.g. Court 1 Lights'" />
        </div>

        <div v-if="editKind === 'doors'" class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Location note</label>
          <InputText v-model="editForm.location_note" placeholder="e.g. Front entrance" />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Hardware provider</label>
            <Select v-model="editForm.hardware_provider"
              :options="providerOptions" option-label="label" option-value="value"
              show-clear placeholder="Pick a provider" class="w-full" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Hardware ID</label>
            <InputText v-model="editForm.hardware_id" placeholder="Vendor's identifier" />
          </div>
        </div>

        <div v-if="editKind === 'doors'" class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Default unlock duration</label>
          <div class="flex items-center gap-2">
            <InputNumber v-model="editForm.default_unlock_seconds" :min="1" :max="3600" class="w-24" />
            <span class="text-sm text-surface-500">seconds</span>
          </div>
        </div>

        <div v-if="editKind === 'lights'" class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Default level</label>
          <div class="flex items-center gap-2">
            <InputNumber v-model="editForm.default_level_percent" :min="0" :max="100" class="w-24" />
            <span class="text-sm text-surface-500">%</span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <ToggleSwitch v-model="editForm.is_active" />
          <label class="text-sm">Active</label>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="editVisible = false" />
        <Button :label="editId ? 'Save' : 'Create'" :loading="saving"
          :disabled="!editForm.name?.trim()"
          style="background:var(--brand-primary);border-color:var(--brand-primary)"
          @click="handleSave" />
      </template>
    </Dialog>

    <Toast />
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'

type Kind = 'doors' | 'lights'

const { orgId } = useOrg()
const api = useBookingsApi()
const toast = useToast()

const activeTab = ref<Kind>('doors')
const loading = ref(true)
const saving = ref(false)

const doors = ref<any[]>([])
const zones = ref<any[]>([])
const doorVenueCounts = ref<Record<string, number>>({})
const zoneVenueCounts = ref<Record<string, number>>({})

const editVisible = ref(false)
const editKind = ref<Kind>('doors')
const editId = ref<string | null>(null)
const editForm = reactive<any>({
  name: '',
  location_note: '',
  hardware_provider: null,
  hardware_id: '',
  default_unlock_seconds: 5,
  default_level_percent: 100,
  is_active: true,
})

const providerOptions = [
  { label: 'ZKTeco', value: 'zkteco' },
  { label: 'HID',    value: 'hid' },
  { label: 'Brivo',  value: 'brivo' },
  { label: 'Nuki',   value: 'nuki' },
  { label: 'Mock (testing)', value: 'mock' },
]

const editHeader = computed(() => {
  const noun = editKind.value === 'doors' ? 'door' : 'light zone'
  return editId.value ? `Edit ${noun}` : `New ${noun}`
})

const rowMenu = ref<any>(null)
const rowMenuItems = ref<any[]>([])

function openCreate(kind: Kind) {
  editKind.value = kind
  editId.value = null
  Object.assign(editForm, {
    name: '',
    location_note: '',
    hardware_provider: null,
    hardware_id: '',
    default_unlock_seconds: 5,
    default_level_percent: 100,
    is_active: true,
  })
  editVisible.value = true
}

function openEdit(kind: Kind, row: any) {
  editKind.value = kind
  editId.value = row.id
  Object.assign(editForm, {
    name: row.name ?? '',
    location_note: row.location_note ?? '',
    hardware_provider: row.hardware_provider ?? null,
    hardware_id: row.hardware_id ?? '',
    default_unlock_seconds: row.default_unlock_seconds ?? 5,
    default_level_percent: row.default_level_percent ?? 100,
    is_active: row.is_active ?? true,
  })
  editVisible.value = true
}

function openMenu(event: Event, kind: Kind, row: any) {
  rowMenuItems.value = [
    { label: 'Edit', icon: 'pi pi-pencil', command: () => openEdit(kind, row) },
    { separator: true },
    {
      label: 'Delete',
      icon: 'pi pi-trash',
      class: 'text-red-500',
      command: () => handleDelete(kind, row),
    },
  ]
  rowMenu.value.toggle(event)
}

async function load() {
  if (!orgId.value) return
  loading.value = true
  const [dSeam, zSeam] = await Promise.all([
    api.doors(orgId.value),
    api.lightZones(orgId.value),
  ])
  // Seam returns camelCase; template + openEdit read snake_case — bridge each row.
  const dRows = (dSeam ?? []).map((d: any) => ({
    ...d,
    location_note: d.locationNote,
    hardware_provider: d.hardwareProvider,
    hardware_id: d.hardwareId,
    default_unlock_seconds: d.defaultUnlockSeconds,
    is_active: d.isActive,
  }))
  const zRows = (zSeam ?? []).map((z: any) => ({
    ...z,
    hardware_provider: z.hardwareProvider,
    hardware_id: z.hardwareId,
    default_level_percent: z.defaultLevelPercent,
    is_active: z.isActive,
  }))
  doors.value = dRows ?? []
  zones.value = zRows ?? []
  // Connection-count join tables have no org_id — scope to THIS org's doors/zones
  // so counts don't include other orgs' connections.
  // Per-door / per-zone connected-venue counts, org-scoped server-side (the join tables
  // have no org_id, so the seam scopes them by joining to this org's doors/zones).
  const counts = await api.accessConnectionCounts(orgId.value)
  doorVenueCounts.value = counts?.doors ?? {}
  zoneVenueCounts.value = counts?.zones ?? {}
  loading.value = false
}

async function handleSave() {
  saving.value = true
  const isDoor = editKind.value === 'doors'
  // Seam takes camelCase; build the domain payload.
  const payload: any = {
    orgId: orgId.value,
    name: editForm.name.trim(),
    hardwareProvider: editForm.hardware_provider || null,
    hardwareId: editForm.hardware_id?.trim() || null,
    isActive: editForm.is_active,
  }
  if (isDoor) {
    payload.locationNote = editForm.location_note?.trim() || null
    payload.defaultUnlockSeconds = editForm.default_unlock_seconds ?? 5
  } else {
    payload.defaultLevelPercent = editForm.default_level_percent ?? 100
  }

  try {
    if (editId.value) {
      isDoor ? await api.updateDoor(editId.value, payload) : await api.updateLightZone(editId.value, payload)
    } else {
      isDoor ? await api.createDoor(payload) : await api.createLightZone(payload)
    }
    toast.add({ severity: 'success', summary: editId.value ? 'Updated' : 'Created', life: 2500 })
    editVisible.value = false
    await load()
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Save failed', detail: e?.message, life: 4000 })
  }
  saving.value = false
}

async function handleDelete(kind: Kind, row: any) {
  try {
    kind === 'doors' ? await api.removeDoor(row.id) : await api.removeLightZone(row.id)
    toast.add({ severity: 'success', summary: 'Deleted', life: 2500 })
    await load()
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Delete failed', detail: e?.message, life: 4000 })
  }
}

watch(orgId, () => load(), { immediate: true })
</script>
