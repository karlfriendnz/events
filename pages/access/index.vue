<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-semibold text-surface-900">Access Control</h1>
        <p class="text-sm text-surface-500 mt-0.5">Lighting and access profiles for venues and events.</p>
      </div>
      <Button label="New Profile" icon="pi pi-plus" size="small" @click="showCreate = true" />
    </div>

    <Tabs v-model:value="activeTab">
      <TabList>
        <Tab value="access">Access Profiles</Tab>
        <Tab value="lighting">Lighting Profiles</Tab>
      </TabList>

      <TabPanels>
        <!-- ACCESS PROFILES -->
        <TabPanel value="access">
          <div class="mt-4">
            <div class="card">
              <DataTable :value="accessProfiles" :loading="loading" size="small" striped-rows row-hover>
                <template #empty>
                  <div class="text-center py-12 text-surface-400">
                    <i class="pi pi-shield text-3xl mb-3 block" />
                    <p>No access profiles yet.</p>
                  </div>
                </template>
                <Column field="name" header="Profile Name" />
                <Column field="description" header="Description">
                  <template #body="{ data }">
                    <span class="text-sm text-surface-600">{{ data.description || '—' }}</span>
                  </template>
                </Column>
                <Column field="is_default" header="Default" style="width:80px">
                  <template #body="{ data }">
                    <i :class="data.is_default ? 'pi pi-check-circle text-green-500' : 'pi pi-times-circle text-surface-300'" />
                  </template>
                </Column>
                <Column style="width:60px">
                  <template #body="{ data }">
                    <Button icon="pi pi-ellipsis-v" severity="secondary" text rounded size="small"
                      @click.stop="openAccessMenu($event, data)" />
                  </template>
                </Column>
              </DataTable>
            </div>
          </div>
        </TabPanel>

        <!-- LIGHTING PROFILES -->
        <TabPanel value="lighting">
          <div class="mt-4">
            <div class="card">
              <DataTable :value="lightingProfiles" :loading="lightingLoading" size="small" striped-rows row-hover>
                <template #empty>
                  <div class="text-center py-12 text-surface-400">
                    <i class="pi pi-sun text-3xl mb-3 block" />
                    <p>No lighting profiles yet.</p>
                  </div>
                </template>
                <Column field="name" header="Profile Name" />
                <Column field="description" header="Description">
                  <template #body="{ data }">
                    <span class="text-sm text-surface-600">{{ data.description || '—' }}</span>
                  </template>
                </Column>
                <Column field="schedule" header="Schedule">
                  <template #body="{ data }">
                    <span class="text-sm text-surface-600">{{ data.schedule ? 'Configured' : '—' }}</span>
                  </template>
                </Column>
                <Column style="width:60px">
                  <template #body="{ data }">
                    <Button icon="pi pi-ellipsis-v" severity="secondary" text rounded size="small"
                      @click.stop="openLightingMenu($event, data)" />
                  </template>
                </Column>
              </DataTable>
            </div>
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>

    <Menu ref="accessMenu" :model="accessMenuItems" :popup="true" />
    <Menu ref="lightingMenu" :model="lightingMenuItems" :popup="true" />

    <!-- Create Profile Dialog -->
    <Dialog v-model:visible="showCreate" header="New Profile" modal style="width: 420px">
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Profile Type</label>
          <Select v-model="newProfile.type" :options="['ACCESS', 'LIGHTING']" class="w-full" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Name</label>
          <InputText v-model="newProfile.name" autofocus placeholder="e.g. Members Only" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Description</label>
          <Textarea v-model="newProfile.description" rows="2" auto-resize placeholder="Describe this profile…" />
        </div>
        <div v-if="newProfile.type === 'ACCESS'" class="flex items-center gap-2">
          <Checkbox v-model="newProfile.is_default" :binary="true" />
          <label class="text-sm">Set as default</label>
        </div>
        <div v-if="newProfile.type === 'LIGHTING'" class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">LED Zone Config (JSON)</label>
          <Textarea v-model="newProfile.schedule" rows="3" auto-resize placeholder='{"zones": []}' />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showCreate = false" />
        <Button label="Create" :loading="creating" :disabled="!newProfile.name.trim()" @click="handleCreate" />
      </template>
    </Dialog>

    <Toast />
  </div>
</template>

<script setup lang="ts">
const { orgId } = useOrg()
import { useToast } from 'primevue/usetoast'

const db = useDb()
const toast = useToast()

const activeTab = ref('access')
const loading = ref(true)
const lightingLoading = ref(true)
const creating = ref(false)
const showCreate = ref(false)

const accessProfiles = ref<any[]>([])
const lightingProfiles = ref<any[]>([])

const newProfile = ref({ type: 'ACCESS', name: '', description: '', is_default: false, schedule: '' })

const accessMenu = ref()
const lightingMenu = ref()
const accessMenuItems = ref<any[]>([])
const lightingMenuItems = ref<any[]>([])

async function load() {
  loading.value = true
  lightingLoading.value = true
  const [{ data: access }, { data: lighting }] = await Promise.all([
    db.from('access_profiles').select('*').eq('org_id', orgId.value).order('name'),
    db.from('lighting_profiles').select('*').eq('org_id', orgId.value).order('name'),
  ])
  accessProfiles.value = access ?? []
  lightingProfiles.value = lighting ?? []
  loading.value = false
  lightingLoading.value = false
}

async function handleCreate() {
  creating.value = true
  const table = newProfile.value.type === 'ACCESS' ? 'access_profiles' : 'lighting_profiles'
  const payload: any = {
    org_id: orgId.value,
    name: newProfile.value.name.trim(),
    description: newProfile.value.description || null,
  }
  if (newProfile.value.type === 'ACCESS') payload.is_default = newProfile.value.is_default
  if (newProfile.value.type === 'LIGHTING' && newProfile.value.schedule) {
    try { payload.schedule = JSON.parse(newProfile.value.schedule) } catch { payload.schedule = null }
  }
  const { error } = await db.from(table).insert(payload)
  if (!error) {
    toast.add({ severity: 'success', summary: 'Profile created', life: 3000 })
    showCreate.value = false
    newProfile.value = { type: 'ACCESS', name: '', description: '', is_default: false, schedule: '' }
    load()
  } else {
    toast.add({ severity: 'error', summary: 'Failed to create profile', life: 3000 })
  }
  creating.value = false
}

function openAccessMenu(event: Event, row: any) {
  accessMenuItems.value = [
    {
      label: row.is_default ? 'Remove Default' : 'Set as Default',
      icon: 'pi pi-check',
      command: async () => {
        await db.from('access_profiles').update({ is_default: !row.is_default }).eq('id', row.id)
        load()
      }
    },
    { separator: true },
    {
      label: 'Delete',
      icon: 'pi pi-trash',
      class: 'text-red-500',
      command: async () => {
        await db.from('access_profiles').delete().eq('id', row.id)
        toast.add({ severity: 'success', summary: 'Profile deleted', life: 3000 })
        load()
      }
    },
  ]
  accessMenu.value.toggle(event)
}

function openLightingMenu(event: Event, row: any) {
  lightingMenuItems.value = [
    {
      label: 'Delete',
      icon: 'pi pi-trash',
      class: 'text-red-500',
      command: async () => {
        await db.from('lighting_profiles').delete().eq('id', row.id)
        toast.add({ severity: 'success', summary: 'Profile deleted', life: 3000 })
        load()
      }
    },
  ]
  lightingMenu.value.toggle(event)
}

onMounted(load)
</script>
