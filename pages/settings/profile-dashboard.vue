<template>
  <div class="p-3 sm:p-6 min-h-full flex flex-col">
    <div class="flex flex-col md:flex-row gap-4 md:gap-6 flex-1 min-h-0">
      <SettingsNav />
      <div class="flex-1 min-w-0 settings-fill">
        <div class="mb-5">
          <h1 class="text-xl font-semibold text-gray-900">Profile dashboard<span v-if="typeLabel" class="text-gray-400 font-normal"> — {{ typeLabel }}</span></h1>
          <p class="text-sm text-gray-500 mt-0.5">
            <template v-if="typeLabel">Arrange the dashboard shown on every <strong>{{ typeLabel }}</strong>'s profile (overrides the club default for this type — <NuxtLink :to="'/settings/fields'" class="text-primary hover:underline">back to Types</NuxtLink>).</template>
            <template v-else>Arrange the dashboard that appears on every member's profile.</template>
            You're editing a <strong>demo member</strong> — real profiles will use their own data.
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
const db = useDb()  // retained for the per-TYPE profile_dashboard write only — see SEAM GAP note in saveConfig
const toast = useToast()
const { loadFieldCatalogue } = usePersonFields()
const { getDashboardMeta, setProfileDashboard } = useOrganisationsApi()
const { loadOrgTypes } = useOrgFieldPolicy()

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

// Per-type mode (mig 245): ?type=<person type key> edits that TYPE's profile
// dashboard (person_target_types.profile_dashboard); no param = the org default.
const route = useRoute()
const typeKey = computed(() => (route.query.type as string) || null)
const typeLabel = ref<string | null>(null)

async function load() {
  if (!orgId.value) return
  loading.value = true
  const [meta, cat, orgTypes] = await Promise.all([
    getDashboardMeta(orgId.value as string),
    loadFieldCatalogue(orgId.value as string),
    typeKey.value ? loadOrgTypes(orgId.value as string) : Promise.resolve([] as any[]),
  ])
  // loadOrgTypes rows carry the type's label + its own profile_dashboard layout.
  const typeRow = typeKey.value ? (orgTypes as any[]).find(t => t.key === typeKey.value) : null
  typeLabel.value = typeRow?.label ?? null
  fields.value = cat
  // give the demo person plausible custom-field values so pickers preview something
  for (const f of cat) {
    if (f.source === 'custom') {
      demoPerson.custom_fields[f.key] = f.field_type === 'checkbox' ? true : f.field_type === 'number' ? 1 : 'Sample'
    }
  }
  // Type mode seeds from the type's own layout, falling back to the org default.
  config.value = (typeKey.value ? (typeRow?.profile_dashboard ?? meta.profileDashboard) : meta.profileDashboard) ?? null
  loading.value = false
}

async function saveConfig(next: any[]) {
  if (typeKey.value) {
    // SEAM GAP (person-types): updateType's PersonTypePatch contract has no
    // profileDashboard field (nor landingPath/menuItems) — gap D5. The per-TYPE
    // profile_dashboard write stays on useDb until person-types adds a setter (by
    // org_id + key, or via updateType widened). The READ already goes through
    // loadOrgTypes above.
    await (db.from as any)('person_target_types').update({ profile_dashboard: next }).eq('org_id', orgId.value).eq('key', typeKey.value)
    toast.add({ severity: 'success', summary: `${typeLabel.value ?? 'Type'} profile dashboard saved`, life: 2000 })
  } else {
    await setProfileDashboard(orgId.value as string, next)
    toast.add({ severity: 'success', summary: 'Profile dashboard saved', life: 2000 })
  }
}

watch(orgId, load, { immediate: true })
</script>
