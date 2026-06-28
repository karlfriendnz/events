<template>
  <div class="p-3 sm:p-6 min-h-full flex flex-col">
    <div class="flex flex-col md:flex-row gap-4 md:gap-6 flex-1 min-h-0">
      <SettingsNav />
      <div class="flex-1 min-w-0 settings-fill">
        <div class="mb-5">
          <h1 class="text-xl font-semibold text-gray-900">Profile dashboard</h1>
          <p class="text-sm text-gray-500 mt-0.5">
            Arrange the dashboard that appears on every member's profile. You're editing a
            <strong>demo member</strong> — real profiles will use their own data.
          </p>
        </div>

        <div v-if="loading" class="flex items-center justify-center py-24 text-gray-400">
          <i class="pi pi-spin pi-spinner text-xl" />
        </div>

        <ProfileDashboard v-else
          v-model="config"
          editable
          :data="DEMO_BUNDLE"
          :fields="fields"
          @save="saveConfig" />

        <Toast />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'

const { orgId } = useOrg()
const db = useDb()
const toast = useToast()
const { loadFieldCatalogue } = usePersonFields()

const loading = ref(true)
const config = ref<any[]>([])
const fields = ref<any[]>([])

// Synthetic member so the builder previews a fully-populated layout (mirrors the
// FormDesigner evtPreviewAccount idiom). Custom-field values keyed by field id are
// filled lazily once the catalogue loads.
const demoPerson = reactive<any>({
  first_name: 'Sam', last_name: 'Smith', email: 'sam.smith@example.com', phone: '021 555 0142',
  dob: '2009-03-14', gender: 'MALE', membership_type: 'Junior', photo_url: null,
  custom_fields: {} as Record<string, any>,
})

const DEMO_BUNDLE = reactive({
  person: demoPerson,
  memberships: [
    { group: 'U16 Boys', role: 'Player', expiry: '14 Mar 2025', color: '#1E2157' },
    { group: 'Saturday Squad', role: 'Member', expiry: '—', color: '#0f766e' },
  ],
  financials: [
    { invoice: 'INV-1042', amount: '$120.00', status: 'PENDING' },
    { invoice: 'INV-0987', amount: '$90.00', status: 'PAID' },
  ],
  communications: [
    { date: '12 May', subject: 'Team announcements', status: 'SENT' },
    { date: '03 May', subject: 'November newsletter', status: 'SENT' },
  ],
  parents: [
    { name: 'Jack Smith', phone: '024 245 15', email: 'jacksmith@example.com', relationship: 'Dad' },
    { name: 'Sally Smith', phone: '024 554 1844', email: 'sally.smith@example.com', relationship: 'Mum' },
  ],
  activity: [
    { title: 'Saturday training', start_at: '2025-05-10', status: 'CONFIRMED', attended: true },
    { title: 'Pre-season camp', start_at: '2025-04-22', status: 'CONFIRMED', attended: false },
  ],
  notes: [
    { id: 'd1', body: 'Sam has asthma and needs to get his inhaler.', tags: ['Medical'], author_name: 'Jan Shipply', created_at: '2024-10-15' },
    { id: 'd2', body: 'Running late to training tonight — sore foot.', tags: ['Attendance'], author_name: 'Jan Shipply', created_at: '2024-10-15' },
  ],
})

async function load() {
  if (!orgId.value) return
  loading.value = true
  const [{ data: orgRow }, cat] = await Promise.all([
    (db.from as any)('organisations').select('profile_dashboard').eq('id', orgId.value).maybeSingle(),
    loadFieldCatalogue(orgId.value as string),
  ])
  fields.value = cat
  // give the demo person plausible custom-field values so pickers preview something
  for (const f of cat) {
    if (f.source === 'custom') {
      demoPerson.custom_fields[f.key] = f.field_type === 'checkbox' ? true : f.field_type === 'number' ? 1 : 'Sample'
    }
  }
  config.value = orgRow?.profile_dashboard ?? null
  loading.value = false
}

async function saveConfig(next: any[]) {
  await (db.from as any)('organisations').update({ profile_dashboard: next }).eq('id', orgId.value)
  toast.add({ severity: 'success', summary: 'Profile dashboard saved', life: 2000 })
}

watch(orgId, load, { immediate: true })
</script>
