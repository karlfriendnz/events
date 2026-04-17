<template>
  <div class="p-6">
    <div class="mb-6">
      <h1 class="text-xl font-semibold text-surface-900">Settings</h1>
      <p class="text-sm text-surface-500 mt-0.5">Organisation configuration and preferences.</p>
    </div>

    <div class="grid grid-cols-3 gap-6">
      <!-- Org settings -->
      <div class="col-span-2 space-y-4">
        <div class="card p-5">
          <h2 class="text-sm font-semibold text-surface-700 mb-4">Organisation</h2>
          <div class="flex flex-col gap-4">
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium">Organisation Name</label>
              <InputText v-model="org.name" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium">Currency</label>
                <Select v-model="org.currency" :options="['AUD', 'NZD', 'USD', 'GBP', 'EUR']" class="w-full" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium">Locale</label>
                <Select v-model="org.locale" :options="['en-AU', 'en-NZ', 'en-US', 'en-GB']" class="w-full" />
              </div>
            </div>
          </div>
          <div class="mt-4 flex justify-end">
            <Button label="Save Organisation" :loading="savingOrg" @click="saveOrg" size="small" />
          </div>
        </div>

        <div class="card p-5">
          <h2 class="text-sm font-semibold text-surface-700 mb-4">Event Defaults</h2>
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium">Default to phased registration</p>
                <p class="text-xs text-surface-500">New events start with member-only window enabled</p>
              </div>
              <ToggleSwitch v-model="defaults.phased_registration" />
            </div>
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium">Default hold-spot flow</p>
                <p class="text-xs text-surface-500">Enable 24h parent confirmation for all new events</p>
              </div>
              <ToggleSwitch v-model="defaults.hold_spot_enabled" />
            </div>
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium">Show attendee list to members</p>
                <p class="text-xs text-surface-500">Members can see who else is attending</p>
              </div>
              <ToggleSwitch v-model="defaults.show_attendee_list" />
            </div>
            <div class="flex flex-col gap-1.5 pt-1">
              <label class="text-sm font-medium">Default member window (days)</label>
              <InputNumber v-model="defaults.member_window_days" :min="0" class="w-32" />
            </div>
          </div>
          <div class="mt-4 flex justify-end">
            <Button label="Save Defaults" size="small" @click="toast.add({ severity: 'success', summary: 'Defaults saved', life: 3000 })" />
          </div>
        </div>
      </div>

      <!-- Right panel -->
      <div class="space-y-4">
        <div class="card p-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-surface-700">Calendars</h3>
            <Button label="Manage" icon="pi pi-arrow-right" icon-pos="right" text size="small" @click="navigateTo('/settings/calendars')" />
          </div>
          <div class="space-y-1 mb-3">
            <div v-for="cat in categories" :key="cat.id"
              class="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-surface-50">
              <span class="w-3 h-3 rounded-full shrink-0" :style="{ background: cat.color || '#94a3b8' }" />
              <span class="text-sm flex-1 truncate">{{ cat.name }}</span>
              <Button icon="pi pi-trash" severity="danger" text rounded size="small"
                @click="deleteCategory(cat.id)" />
            </div>
            <p v-if="!categories.length" class="text-sm text-surface-400 py-2">No calendars yet.</p>
          </div>
          <div class="flex gap-2">
            <InputText v-model="newCatName" placeholder="Calendar name" size="small" class="flex-1" />
            <Button icon="pi pi-plus" size="small" :disabled="!newCatName.trim()" @click="addCategory" />
          </div>
        </div>

        <div class="card p-4">
          <h3 class="text-sm font-semibold text-surface-700 mb-3">Members (Persons)</h3>
          <p class="text-sm text-surface-500 mb-3">{{ personCount }} members in this organisation.</p>
          <Button label="Add Member" icon="pi pi-user-plus" size="small" severity="secondary" @click="showAddPerson = true" class="w-full" />
        </div>
      </div>
    </div>

    <!-- Danger Zone -->
    <div class="mt-6 rounded-xl border border-red-200 bg-white p-5 space-y-4">
      <h2 class="text-sm font-semibold text-red-600">Danger Zone</h2>
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-gray-700">Reset database</p>
          <p class="text-xs text-gray-500">Deletes all events, sessions, registrations, bookings, fees, discounts, forms, and related data. People are preserved.</p>
        </div>
        <Button
          label="Reset Database"
          severity="danger"
          size="small"
          :loading="resetting"
          class="ml-6 shrink-0"
          @click="resetDatabase" />
      </div>
    </div>

    <!-- Add Person Dialog -->
    <Dialog v-model:visible="showAddPerson" header="Add Member" modal style="width: 400px">
      <div class="flex flex-col gap-4">
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">First Name</label>
            <InputText v-model="personForm.first_name" autofocus />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Last Name</label>
            <InputText v-model="personForm.last_name" />
          </div>
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Email</label>
          <InputText v-model="personForm.email" type="email" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Phone</label>
          <InputText v-model="personForm.phone" type="tel" />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showAddPerson = false" />
        <Button label="Add" :loading="addingPerson" :disabled="!personForm.first_name || !personForm.last_name" @click="handleAddPerson" />
      </template>
    </Dialog>

    <Toast />
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'

const db = useDb()
const toast = useToast()

const org = ref({ name: 'Demo Club', currency: 'AUD', locale: 'en-AU' })
const defaults = ref({ phased_registration: false, hold_spot_enabled: false, show_attendee_list: false, member_window_days: 40 })
const savingOrg = ref(false)
const categories = ref<any[]>([])
const personCount = ref(0)
const newCatName = ref('')
const showAddPerson = ref(false)
const addingPerson = ref(false)
const personForm = ref({ first_name: '', last_name: '', email: '', phone: '' })

async function load() {
  const { DEFAULT_ORG_ID } = await import('~/composables/useDb')
  const [{ data: orgData }, { data: catData }, { count }] = await Promise.all([
    db.from('organisations').select('*').eq('id', DEFAULT_ORG_ID).single(),
    db.from('categories').select('*').eq('org_id', DEFAULT_ORG_ID).order('name'),
    db.from('persons').select('*', { count: 'exact', head: true }).eq('org_id', DEFAULT_ORG_ID),
  ])
  if (orgData) org.value = { name: orgData.name, currency: orgData.currency, locale: orgData.locale }
  categories.value = catData ?? []
  personCount.value = count ?? 0
}

async function saveOrg() {
  savingOrg.value = true
  const { DEFAULT_ORG_ID } = await import('~/composables/useDb')
  await db.from('organisations').update({ name: org.value.name, currency: org.value.currency, locale: org.value.locale }).eq('id', DEFAULT_ORG_ID)
  toast.add({ severity: 'success', summary: 'Organisation saved', life: 3000 })
  savingOrg.value = false
}

async function addCategory() {
  if (!newCatName.value.trim()) return
  const { DEFAULT_ORG_ID } = await import('~/composables/useDb')
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16']
  const color = colors[categories.value.length % colors.length]
  await db.from('categories').insert({ org_id: DEFAULT_ORG_ID, name: newCatName.value.trim(), color })
  newCatName.value = ''
  load()
}

async function deleteCategory(id: string) {
  await db.from('categories').delete().eq('id', id)
  categories.value = categories.value.filter(c => c.id !== id)
}

async function handleAddPerson() {
  addingPerson.value = true
  const { DEFAULT_ORG_ID } = await import('~/composables/useDb')
  const { error } = await db.from('persons').insert({
    org_id: DEFAULT_ORG_ID,
    first_name: personForm.value.first_name,
    last_name: personForm.value.last_name,
    email: personForm.value.email || null,
    phone: personForm.value.phone || null,
  })
  if (!error) {
    toast.add({ severity: 'success', summary: 'Member added', life: 3000 })
    showAddPerson.value = false
    personForm.value = { first_name: '', last_name: '', email: '', phone: '' }
    load()
  }
  addingPerson.value = false
}

const resetting = ref(false)

async function resetDatabase() {
  const ok = confirm('Reset the database? This will delete all events, sessions, registrations, bookings, forms, fees, discounts, and related data. People will be kept. This cannot be undone.')
  if (!ok) return
  resetting.value = true
  try {
    // Delete in dependency order (children before parents)
    const tables = [
      'audit_log', 'access_scans', 'physical_schedules', 'lighting_profiles',
      'tasks', 'attendance', 'communications',
      'registration_sessions', 'transactions', 'registrations',
      'form_fields', 'registration_forms',
      'discounts', 'addons', 'fee_rules', 'fee_components',
      'invitees', 'connection_group_events', 'connection_groups',
      'sessions', 'events',
      'member_group_memberships', 'member_groups',
      'bookings', 'bookable_closures', 'bookables',
    ]
    for (const table of tables) {
      await db.from(table as any).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    }
    toast.add({ severity: 'success', summary: 'Database reset', detail: 'All data except people has been cleared.', life: 4000 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Reset failed', detail: e?.message ?? 'Unknown error', life: 5000 })
  } finally {
    resetting.value = false
  }
}

onMounted(load)
</script>
