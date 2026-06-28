<template>
  <div class="p-3 sm:p-6">
    <div v-if="loading" class="flex items-center justify-center py-24 text-gray-400">
      <i class="pi pi-spin pi-spinner text-xl" />
    </div>

    <div v-else-if="!person" class="text-center py-24 text-surface-400">
      <i class="pi pi-user text-3xl mb-3 block" />
      <p>This person could not be found.</p>
      <Button label="Back to People" text class="mt-3" @click="navigateTo('/people')" />
    </div>

    <template v-else>
      <!-- ── Tab strip (identity shown in the top-bar breadcrumbs) ── -->
      <div class="card p-0 overflow-hidden mb-4">
        <div class="flex items-center gap-1 px-2 sm:px-4 border-b border-gray-100 overflow-x-auto overflow-y-hidden no-scrollbar">
          <button v-for="t in TABS" :key="t.key" type="button"
            class="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap"
            :class="activeTab === t.key
              ? 'border-[#1E2157] text-[#1E2157]'
              : 'border-transparent text-gray-500 hover:text-gray-800'"
            @click="selectTab(t.key)">
            <i :class="`pi ${t.icon} text-xs`" />
            {{ t.label }}
          </button>
        </div>
      </div>

      <!-- ── DASHBOARD ── -->
      <div v-show="activeTab === 'dashboard'">
        <!-- Stat tiles -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div class="card p-4 flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><i class="pi pi-wallet" /></div>
            <div class="min-w-0">
              <p class="text-lg font-bold text-gray-900 leading-none">{{ currency(outstandingBalance) }}</p>
              <p class="text-xs text-gray-500 mt-1">Outstanding</p>
            </div>
          </div>
          <div class="card p-4 flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><i class="pi pi-calendar" /></div>
            <div class="min-w-0">
              <p class="text-sm font-bold text-gray-900 leading-tight truncate">{{ nextEvent ? formatDate(new Date(nextEvent.start_at)) : 'None' }}</p>
              <p class="text-xs text-gray-500 mt-1 truncate">{{ nextEvent ? nextEvent.title : 'Next event' }}</p>
            </div>
          </div>
          <div class="card p-4 flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><i class="pi pi-envelope" /></div>
            <div class="min-w-0">
              <p class="text-lg font-bold text-gray-900 leading-none">{{ emailCount }}</p>
              <p class="text-xs text-gray-500 mt-1">Emails</p>
            </div>
          </div>
          <div class="card p-4 flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><i class="pi pi-users" /></div>
            <div class="min-w-0">
              <p class="text-lg font-bold text-gray-900 leading-none">{{ groupCount }}</p>
              <p class="text-xs text-gray-500 mt-1">Groups</p>
            </div>
          </div>
        </div>

        <ProfileDashboard
          :model-value="dashConfig"
          :data="dashBundle"
          :fields="fieldCatalogue"
          live-notes
          @add-note="createNote"
          @delete-note="removeNote" />
      </div>

      <!-- ── PROFILE ── -->
      <div v-show="activeTab === 'profile'">
        <!-- Designed layout (Settings → Fields → Configure form) — mirrors the builder: section cards, half/full, tabs -->
        <template v-if="profileItems">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <template v-for="u in renderUnits" :key="u.key">
              <!-- Tab strip (full width) — pill style like the builder -->
              <div v-if="u.kind === 'strip'" class="lg:col-span-2 flex items-center gap-1.5 flex-wrap">
                <button v-for="t in profileTabList" :key="t.id" type="button"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors"
                  :class="activeProfileTab === t.id ? 'bg-[#1E2157] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
                  @click="activeProfileTab = t.id"><i v-if="t.icon" :class="`${t.icon} text-xs`" />{{ t.label || 'Tab' }}</button>
              </div>
              <!-- Section card — full spans both columns, half sits side-by-side -->
              <div v-else class="card overflow-hidden min-w-0" :class="(!u.sec.section || u.sec.section.col_span === 2) ? 'lg:col-span-2' : ''">
                <div v-if="u.sec.section" class="px-4 py-2.5 border-b border-gray-100 bg-gray-50/60 flex items-center gap-3">
                  <div class="flex-1 min-w-0">
                    <h3 class="text-sm font-bold text-gray-800">{{ u.sec.section.label || 'Section' }}</h3>
                    <p v-if="u.sec.section.placeholder" class="text-xs text-gray-400 mt-0.5">{{ u.sec.section.placeholder }}</p>
                  </div>
                  <img v-if="u.sec.section.block && u.sec.section.block[0]" :src="u.sec.section.block[0]" class="h-11 w-auto object-contain shrink-0" />
                </div>
                <div class="grid gap-x-8 gap-y-5 p-4 sm:p-5" :class="(!u.sec.section || u.sec.section.col_span === 2) ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'">
                  <template v-for="item in u.sec.fields" :key="item._key">
                    <p v-if="item.field_type === 'text-block'" class="sm:col-span-2 text-sm text-gray-500 whitespace-pre-wrap">{{ item.label }}</p>
                    <img v-else-if="item.field_type === 'image' && item.block && item.block[0]" :src="item.block[0]" class="sm:col-span-2 w-full max-h-48 object-contain rounded-lg" />
                    <a v-else-if="item.field_type === 'button'" :href="(item.block && item.block[1]) || '#'" :target="(item.block && item.block[1]) ? '_blank' : undefined" rel="noopener" class="sm:col-span-2 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-primary-hover w-fit">{{ (item.block && item.block[0]) || item.label || 'Button' }}</a>
                    <!-- Communication preferences (the comms system field) -->
                    <div v-else-if="item.field_type === 'comms'" class="flex flex-col gap-2" :class="item.col_span === 2 ? 'sm:col-span-2' : ''">
                      <label class="text-xs font-medium text-gray-600">{{ item.label || 'Communication' }}</label>
                      <ChipMultiSelect v-if="editing" v-model="form.comms_topics" :options="COMMS_CATEGORIES" optionLabel="label" optionValue="key" placeholder="Subscribe to communications" />
                      <span v-else class="text-sm text-gray-700">{{ commsDisplay() }}</span>
                    </div>
                    <div v-else-if="isFieldItem(item)" class="flex flex-col gap-2" :class="item.col_span === 2 ? 'sm:col-span-2' : ''">
                      <label class="text-xs font-medium text-gray-600">{{ item.label }}<span v-if="item.is_required" class="text-red-500"> *</span></label>
                      <template v-if="editing">
                        <DatePicker v-if="item.core === 'dob'" v-model="form.dob" dateFormat="dd M yy" showIcon iconDisplay="input" :maxDate="today" class="w-full" />
                        <Select v-else-if="item.core === 'gender'" v-model="form.gender" :options="GENDER_OPTIONS" optionLabel="label" optionValue="value" placeholder="Unspecified" class="w-full" showClear />
                        <MultiSelect v-else-if="item.core === 'role'" v-model="form.person_types" :options="personTypes" optionLabel="label" optionValue="key" display="chip" placeholder="Select roles" class="w-full" :showToggleAll="false" />
                        <InputText v-else-if="item.core" v-model="form[item.core]" :type="item.core === 'email' ? 'email' : (item.core === 'phone' || item.core === 'phone2') ? 'tel' : 'text'" class="w-full" />
                        <Textarea v-else-if="item.field_type === 'textarea'" v-model="form.custom[item.def_id]" rows="3" autoResize class="w-full" />
                        <InputNumber v-else-if="item.field_type === 'number'" v-model="form.custom[item.def_id]" class="w-full" />
                        <DatePicker v-else-if="item.field_type === 'date'" v-model="form.custom[item.def_id]" dateFormat="dd M yy" showIcon iconDisplay="input" class="w-full" />
                        <Select v-else-if="item.field_type === 'select'" v-model="form.custom[item.def_id]" :options="item.options" placeholder="Select…" class="w-full" showClear />
                        <div v-else-if="item.field_type === 'checkbox'" class="flex"><ToggleSwitch v-model="form.custom[item.def_id]" /></div>
                        <InputText v-else v-model="form.custom[item.def_id]" :type="item.field_type === 'email' ? 'email' : item.field_type === 'phone' ? 'tel' : 'text'" class="w-full" />
                      </template>
                      <span v-else class="text-sm text-gray-700">{{ item.core ? coreDisplay(item) : defDisplay(item) }}</span>
                    </div>
                  </template>
                </div>
              </div>
            </template>
          </div>
          <!-- Fields from this person's OTHER roles (the designed layout only covers their primary role) -->
          <AppCard v-if="extraRoleFields.length" title="Other role details" description="Fields that apply to this person's other roles." class="mt-4">
            <div class="divide-y divide-gray-100">
              <SettingsRow v-for="f in extraRoleFields" :key="f.id" :label="f.label"
                :description="f.help_text || (f.inherited ? `From ${f.ownerName}` : '')">
                <template v-if="editing">
                  <Textarea v-if="f.field_type === 'textarea'" v-model="form.custom[f.id]" rows="3" autoResize class="w-full" />
                  <InputNumber v-else-if="f.field_type === 'number'" v-model="form.custom[f.id]" class="w-full" />
                  <DatePicker v-else-if="f.field_type === 'date'" v-model="form.custom[f.id]" dateFormat="dd M yy" showIcon iconDisplay="input" class="w-full" />
                  <Select v-else-if="f.field_type === 'select'" v-model="form.custom[f.id]" :options="f.options" placeholder="Select…" class="w-full" showClear />
                  <div v-else-if="f.field_type === 'checkbox'" class="flex"><ToggleSwitch v-model="form.custom[f.id]" /></div>
                  <InputText v-else v-model="form.custom[f.id]" :type="f.field_type === 'email' ? 'email' : f.field_type === 'phone' ? 'tel' : 'text'" class="w-full" />
                </template>
                <span v-else class="text-sm text-gray-700">{{ displayCustom(f) }}</span>
              </SettingsRow>
            </div>
          </AppCard>
        </template>

        <!-- Fallback default list (no designed layout yet) -->
        <AppCard v-else title="Details" description="Basic information about this person.">
          <div class="divide-y divide-gray-100">
            <SettingsRow label="Name">
              <div v-if="editing" class="grid grid-cols-2 gap-3 w-full">
                <InputText v-model="form.first_name" placeholder="First name" />
                <InputText v-model="form.last_name" placeholder="Last name" />
              </div>
              <span v-else class="text-sm text-gray-700">{{ form.first_name }} {{ form.last_name }}</span>
            </SettingsRow>
            <SettingsRow v-if="personTypes.length" label="User Role" description="The kinds of person this is — one or more.">
              <MultiSelect v-if="editing" v-model="form.person_types" :options="personTypes" optionLabel="label" optionValue="key"
                placeholder="Select roles" class="w-full" display="chip" :showToggleAll="false" />
              <span v-else class="text-sm text-gray-700">{{ personTypeLabel || '—' }}</span>
            </SettingsRow>
            <SettingsRow label="Email">
              <InputText v-if="editing" v-model="form.email" type="email" class="w-full" placeholder="name@example.com" />
              <span v-else class="text-sm text-gray-700">{{ form.email || '—' }}</span>
            </SettingsRow>
            <SettingsRow label="Phone">
              <InputText v-if="editing" v-model="form.phone" type="tel" class="w-full" placeholder="Phone number" />
              <span v-else class="text-sm text-gray-700">{{ form.phone || '—' }}</span>
            </SettingsRow>
            <SettingsRow label="Secondary phone">
              <InputText v-if="editing" v-model="form.phone2" type="tel" class="w-full" placeholder="Second phone number" />
              <span v-else class="text-sm text-gray-700">{{ form.phone2 || '—' }}</span>
            </SettingsRow>
            <SettingsRow label="Date of birth" description="Used to work out age.">
              <DatePicker v-if="editing" v-model="form.dob" dateFormat="dd M yy" showIcon iconDisplay="input"
                :maxDate="today" placeholder="Select date" class="w-full" />
              <span v-else class="text-sm text-gray-700">{{ form.dob ? formatDate(form.dob) : '—' }}</span>
            </SettingsRow>
            <SettingsRow label="Gender">
              <Select v-if="editing" v-model="form.gender" :options="GENDER_OPTIONS" optionLabel="label" optionValue="value"
                placeholder="Unspecified" class="w-full" showClear />
              <span v-else class="text-sm text-gray-700">{{ genderLabel || '—' }}</span>
            </SettingsRow>
            <SettingsRow label="Membership type" description="e.g. Senior, Junior, Social.">
              <InputText v-if="editing" v-model="form.membership_type" class="w-full" placeholder="—" />
              <span v-else class="text-sm text-gray-700">{{ form.membership_type || '—' }}</span>
            </SettingsRow>
            <SettingsRow label="Communication" description="Which club communications this person receives.">
              <ChipMultiSelect v-if="editing" v-model="form.comms_topics" :options="COMMS_CATEGORIES" optionLabel="label" optionValue="key"
                placeholder="Subscribe to communications" />
              <span v-else class="text-sm text-gray-700">{{ commsDisplay() }}</span>
            </SettingsRow>

            <!-- Custom (org-defined) fields, in the same list -->
            <SettingsRow v-for="f in customFields" :key="f.id" :label="f.label"
              :description="f.help_text || (f.inherited ? `From ${f.ownerName}` : '')">
              <template v-if="editing">
                <Textarea v-if="f.field_type === 'textarea'" v-model="form.custom[f.id]" rows="3" autoResize class="w-full" />
                <InputNumber v-else-if="f.field_type === 'number'" v-model="form.custom[f.id]" class="w-full" />
                <DatePicker v-else-if="f.field_type === 'date'" v-model="form.custom[f.id]" dateFormat="dd M yy" showIcon iconDisplay="input" class="w-full" />
                <Select v-else-if="f.field_type === 'select'" v-model="form.custom[f.id]" :options="f.options" placeholder="Select…" class="w-full" showClear />
                <div v-else-if="f.field_type === 'checkbox'" class="flex">
                  <ToggleSwitch v-model="form.custom[f.id]" />
                </div>
                <InputText v-else v-model="form.custom[f.id]"
                  :type="f.field_type === 'email' ? 'email' : f.field_type === 'phone' ? 'tel' : 'text'" class="w-full" />
              </template>
              <span v-else class="text-sm text-gray-700">{{ displayCustom(f) }}</span>
            </SettingsRow>
          </div>
        </AppCard>

        <!-- Save / Delete actions for the profile -->
        <div class="flex items-center justify-between gap-3 mt-4">
          <Button label="Delete" icon="pi pi-trash" severity="danger" text size="small" @click="deletePerson" />
          <Button label="Save" icon="pi pi-check" size="small" :loading="saving"
            :disabled="!isDirty || !(form.first_name || '').trim() || !(form.last_name || '').trim()"
            style="background:#1E2157;border-color:#1E2157" @click="save" />
        </div>
      </div>

      <!-- ── MEMBERSHIP ── -->
      <div v-show="activeTab === 'membership'">
        <AppCard title="Member groups" description="Groups this person belongs to and their role in each.">
          <div class="space-y-3">
            <MultiSelect v-if="editing" v-model="form.group_ids" :options="allGroups" optionLabel="name" optionValue="id"
              placeholder="Add to groups…" display="chip" filter class="w-full" :showToggleAll="false">
              <template #option="{ option }">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: option.color ?? '#94a3b8' }" />
                  <span>{{ option.name }}</span>
                </div>
              </template>
            </MultiSelect>

            <div v-if="memberGroupChips.length" class="overflow-x-auto">
              <table class="w-full min-w-[24rem] text-sm">
                <thead>
                  <tr class="text-xs font-bold uppercase tracking-wide text-gray-400 border-b border-gray-100">
                    <th class="text-left font-bold py-2">Group</th>
                    <th class="text-left font-bold py-2">Role</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="g in memberGroupChips" :key="g.id" class="border-b border-gray-50 last:border-0">
                    <td class="py-2 pr-3">
                      <NuxtLink :to="`/groups/${g.id}`" class="inline-flex items-center gap-2 text-gray-800 hover:text-primary font-medium">
                        <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: g.color ?? '#94a3b8' }" />
                        {{ g.name }}
                      </NuxtLink>
                    </td>
                    <td class="py-2">
                      <MultiSelect v-if="editing" v-model="form.group_roles[g.id]" :options="groupRoleOptions" optionLabel="label" optionValue="value"
                        display="chip" :showToggleAll="false" placeholder="Roles" class="w-full" />
                      <div v-else class="flex flex-wrap gap-1">
                        <span v-for="r in (form.group_roles[g.id] || [])" :key="r" class="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">{{ groupRoleLabel(r) }}</span>
                        <span v-if="!(form.group_roles[g.id] || []).length" class="text-gray-400">—</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p v-if="editing && !allGroups.length" class="text-sm text-surface-400">
              No member groups exist yet. Create them under <NuxtLink to="/groups" class="text-primary hover:underline">Groups</NuxtLink>.
            </p>
            <p v-else-if="!memberGroupChips.length" class="text-sm text-surface-400">
              Not in any groups yet.<span v-if="!editing"> Click <strong>Edit</strong> to add some.</span>
            </p>
          </div>
        </AppCard>
      </div>

      <!-- ── FAMILY & CIRCLES ── -->
      <div v-show="activeTab === 'links'">
        <PersonCirclesEditor v-if="person" :person-id="person.id" />
      </div>
    </template>

    <Toast />
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { COMMS_CATEGORIES } from '~/composables/usePeopleLinks'

const route = useRoute()
const router = useRouter()
const { orgId } = useOrg()
const db = useDb()
const toast = useToast()
const { resolveFields, resolvePersonTypes, fieldAppliesTo } = useOrgFieldPolicy()
const personTypes = ref<any[]>([])

const TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'pi-th-large' },
  { key: 'profile', label: 'Profile', icon: 'pi-user' },
  { key: 'links', label: 'Contacts & Circles', icon: 'pi-sitemap' },
  { key: 'membership', label: 'Membership', icon: 'pi-users' },
]
const VALID_TABS = TABS.map(t => t.key)

const GENDER_OPTIONS = [
  { label: 'Male', value: 'MALE' },
  { label: 'Female', value: 'FEMALE' },
  { label: 'Non-binary', value: 'NON_BINARY' },
  { label: 'Unspecified', value: 'UNSPECIFIED' },
]

const today = new Date()
const loading = ref(true)
const saving = ref(false)
const editing = ref(true)  // profile shows the fields as live inputs (a form), not read-only
const person = ref<any>(null)
const allGroups = ref<any[]>([])
const customFields = ref<any[]>([])
const activity = ref<any[]>([])
const initialGroupIds = ref<string[]>([])
const actionsMenu = ref()

// Dashboard tab
const { CORE_FIELDS } = usePersonFields()
const user = useSupabaseUser()
const dashConfig = ref<any>(null)
const financials = ref<any[]>([])
const communications = ref<any[]>([])
const notes = ref<any[]>([])
const fieldCatalogue = computed(() => [
  ...CORE_FIELDS,
  ...customFields.value.map((f: any) => ({ key: f.id, label: f.label, source: 'custom', field_type: f.field_type })),
])
const dashBundle = computed(() => ({
  person: person.value || {},
  memberships: form.group_ids.map(id => {
    const g = allGroups.value.find(x => x.id === id)
    return { id, group: g?.name || 'Group', color: g?.color, role: '', expiry: '' }
  }),
  financials: financials.value,
  communications: communications.value,
  parents: [],
  activity: activity.value,
  activityFeed: activityFeed.value,
  notes: notes.value,
}))

// Scoped group roles (per-group membership roles — Member/Player/Coach/Manager…)
const scopedRoles = useScopedRoles()
const groupRoleOptions = computed(() => scopedRoles.rolesFor('group').map(r => ({ label: r.label, value: r.key })))
const groupRoleLabel = (key: string) => scopedRoles.roleDef('group', key)?.label ?? key

// Stat tiles
const outstandingBalance = ref(0)
const emailCount = computed(() => communications.value.length)
const groupCount = computed(() => form.group_ids.length)
const nextEvent = computed(() => {
  const now = Date.now()
  return [...activity.value]
    .filter(a => a.start_at && new Date(a.start_at).getTime() >= now)
    .sort((a, b) => (a.start_at || '').localeCompare(b.start_at || ''))[0] || null
})
function currency(n: number) {
  return '$' + Number(n || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const activeTab = ref('dashboard')
function selectTab(key: string) {
  activeTab.value = key
  router.replace({ hash: `#${key}` })
}

const form = reactive({
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  phone2: '',
  dob: null as Date | null,
  gender: null as string | null,
  membership_type: '',
  person_type: null as string | null,
  person_types: [] as string[],
  comms_topics: [] as string[],
  group_ids: [] as string[],
  group_roles: {} as Record<string, string[]>,
  custom: {} as Record<string, any>,
})
const snapshot = ref('') // canon JSON of form at load / last save, for Cancel + dirty check
// Treat '' / undefined / null as equal so typing then clearing a field isn't "dirty".
function canonForm() { return JSON.stringify(form, (_k, v) => (v === '' || v === undefined ? null : v)) }
const isDirty = computed(() => canonForm() !== snapshot.value)

// Avatar upload
const { uploadFile } = useUpload()
const uploadingPhoto = ref(false)
async function onAvatarFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return
  uploadingPhoto.value = true
  try {
    const url = await uploadFile(file)
    await (db.from as any)('persons').update({ photo_url: url }).eq('id', route.params.id)
    if (person.value) person.value.photo_url = url
    toast.add({ severity: 'success', summary: 'Photo updated', life: 2000 })
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Upload failed', detail: err?.message, life: 4000 })
  } finally { uploadingPhoto.value = false }
}

const initials = computed(() =>
  `${(form.first_name || '').charAt(0)}${(form.last_name || '').charAt(0)}`.toUpperCase() || '?'
)
const genderLabel = computed(() => GENDER_OPTIONS.find(g => g.value === form.gender)?.label ?? '')
// Primary type = first role (anchors the designed layout + dashboard catalogue).
const primaryType = computed(() => form.person_types[0] ?? null)
const personTypeLabel = computed(() =>
  form.person_types.map(k => personTypes.value.find(t => t.key === k)?.label ?? k).join(', '))

// Designed profile layout (from Settings → Fields → "Configure form"; profile_forms table).
// When present, the Profile tab renders this exact layout (sections + 2-column col_span);
// otherwise it falls back to the default field list below.
const profileLayout = ref<any[] | null>(null)
const PROFILE_BLOCKS = new Set(['tab', 'section', 'image', 'text-block', 'button', 'account', 'comms'])
const profileItems = computed(() => (profileLayout.value && profileLayout.value.length) ? profileLayout.value : null)
function isFieldItem(i: any) { return !PROFILE_BLOCKS.has(i.field_type) }
// The designed layout is for the person's PRIMARY type only. A multi-role person
// (e.g. coach + player) also has fields from their OTHER roles — show those that
// the primary layout doesn't already cover, so the profile reflects every role.
const layoutDefIds = computed(() => {
  const s = new Set<string>()
  for (const i of (profileItems.value || [])) if (i.def_id) s.add(i.def_id)
  return s
})
const extraRoleFields = computed(() => customFields.value.filter((f: any) => !layoutDefIds.value.has(f.id)))
// Group a list of layout items into sections (leading "no section" group + one per section item).
function sectionsOf(items: any[]) {
  const out: { key: string; section: any | null; fields: any[] }[] = []
  let cur: { key: string; section: any | null; fields: any[] } = { key: '__top', section: null, fields: [] }
  out.push(cur)
  for (const it of items) {
    if (it.field_type === 'section') { cur = { key: it._key, section: it, fields: [] }; out.push(cur) }
    else cur.fields.push(it)
  }
  return out.filter((g, i) => (i === 0 ? g.fields.length > 0 : true))
}
// Tabs model: ONE `tabs` element holds the tab list; items carry `tab_id`.
const profileTabsEl = computed(() => profileItems.value?.find((i: any) => i.field_type === 'tabs') || null)
const profileTabList = computed(() => (profileTabsEl.value?.tabs ?? []) as { id: string; label: string }[])
const profileHasTabs = computed(() => profileTabList.value.length > 0)
const profileTopSections = computed(() =>
  profileItems.value ? sectionsOf(profileItems.value.filter((i: any) => i.field_type !== 'tabs' && !i.tab_id)) : [])
const activeProfileTab = ref('')
watch(profileTabList, (tabs) => {
  if (!tabs.find(t => t.id === activeProfileTab.value)) activeProfileTab.value = tabs[0]?.id ?? ''
}, { immediate: true })
const activeProfileSections = computed(() =>
  (profileItems.value && activeProfileTab.value)
    ? sectionsOf(profileItems.value.filter((i: any) => i.field_type !== 'tabs' && i.tab_id === activeProfileTab.value))
    : [])
// One render list: top-level sections, then a full-width tab strip, then the active tab's sections.
const renderUnits = computed(() => {
  const units: any[] = []
  profileTopSections.value.forEach((s: any) => units.push({ kind: 'section', key: 'top:' + s.key, sec: s }))
  if (profileHasTabs.value) {
    units.push({ kind: 'strip', key: '__strip' })
    activeProfileSections.value.forEach((s: any) => units.push({ kind: 'section', key: 'tab:' + s.key, sec: s }))
  }
  return units
})
function coreDisplay(item: any) {
  const c = item.core
  if (c === 'dob') return form.dob ? formatDate(form.dob) : '—'
  if (c === 'gender') return genderLabel.value || '—'
  if (c === 'role') return personTypeLabel.value || '—'
  return (form as any)[c] || '—'
}
function commsDisplay() {
  return form.comms_topics.length ? form.comms_topics.map(k => COMMS_CATEGORIES.find(x => x.key === k)?.label ?? k).join(', ') : 'None'
}
function defDisplay(item: any) {
  const v = form.custom[item.def_id]
  if (v === null || v === undefined || v === '') return '—'
  if (item.field_type === 'checkbox') return v ? 'Yes' : 'No'
  if (item.field_type === 'date') return v instanceof Date ? formatDate(v) : String(v)
  return String(v)
}
const ageLabel = computed(() => {
  const a = ageFromDob(form.dob)
  return a == null ? '' : `${a} yrs`
})
const memberGroupChips = computed(() =>
  form.group_ids.map(id => allGroups.value.find(g => g.id === id)).filter(Boolean)
)

// Activity feed — visual prototype (representative entries; no audit log yet).
// Uses the person's real name + groups where available; samples otherwise.
const activityFeed = computed(() => {
  const who = form.first_name || person.value?.first_name || 'This member'
  const groups = memberGroupChips.value as any[]
  const ent = (g: any, fallback: string) => g
    ? { text: g.name, to: `/groups/${g.id}` }
    : { text: fallback, to: '/groups' }
  return [
    { id: 1, type: 'payment', date: '15/10/24', author: 'Jan Shipply',
      parts: [{ text: `${who} has paid $23.50 for ` }, { text: 'Invoice 234', to: '#' }] },
    { id: 2, type: 'group-remove', date: '15/10/24', author: 'Jan Shipply',
      parts: [{ text: `${who} has been removed from the ` }, ent(groups[0], 'Junior Tigers')] },
    { id: 3, type: 'group-transfer', date: '15/10/24', author: 'Susan Shorts',
      parts: [{ text: `${who} has been transferred from the ` }, ent(groups[0], 'Junior Tigers'), { text: ' to the ' }, ent(groups[1], 'Senior Tigers')] },
    { id: 4, type: 'payment', date: '15/10/24', author: 'Jan Shipply',
      parts: [{ text: `${who} has paid $23.50 for ` }, { text: 'Invoice 234', to: '#' }] },
    { id: 5, type: 'invoice', date: '15/10/24', author: 'Jan Shipply',
      parts: [{ text: `${who} has been invoiced $23.50` }] },
    { id: 6, type: 'registration', date: '15/10/24', author: 'Jan Shipply',
      parts: [{ text: `${who} has been registered for the ` }, ent(groups[0], 'Junior Tigers')] },
  ]
})

const PALETTE = ['#1E2157', '#0f766e', '#9333ea', '#c2410c', '#0369a1', '#be123c', '#15803d', '#4338ca']
function avatarColor(id: string) {
  let h = 0
  for (let i = 0; i < (id || '').length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

function ageFromDob(dob: Date | null) {
  if (!dob || isNaN(dob.getTime())) return null
  let a = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) a--
  return a >= 0 && a < 130 ? a : null
}
function formatDate(d: Date) {
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}
function titleCase(s: string) {
  return (s || '').charAt(0) + (s || '').slice(1).toLowerCase()
}
function statusSeverity(s: string) {
  return ({ CONFIRMED: 'success', DECLINED: 'danger', WAITLISTED: 'warn', EXCLUDED: 'secondary' } as any)[s] || 'info'
}
function displayCustom(f: any) {
  const v = form.custom[f.id]
  if (v === null || v === undefined || v === '') return '—'
  if (f.field_type === 'checkbox') return v ? 'Yes' : 'No'
  if (f.field_type === 'date') return v instanceof Date ? formatDate(v) : String(v)
  return String(v)
}

const actionsMenuItems = computed(() => [
  { label: 'Delete person', icon: 'pi pi-trash', class: 'text-red-500', command: deletePerson },
])

useBreadcrumbs([
  { label: 'People', to: '/people' },
  { label: computed(() => person.value ? `${form.first_name} ${form.last_name}` : '…') },
])

function toIsoDate(d: Date | null): string | null {
  if (!d) return null
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

async function load() {
  loading.value = true
  const [{ data: p }, { data: groups }, { data: memberships }, fields, { data: invites }] = await Promise.all([
    (db.from as any)('persons').select('*').eq('id', route.params.id).eq('org_id', orgId.value).single(),
    (db.from as any)('member_groups').select('id, name, color').eq('org_id', orgId.value).order('sort_order').order('name'),
    (db.from as any)('member_group_memberships').select('group_id, roles, role').eq('person_id', route.params.id),
    resolveFields(orgId.value as string),
    (db.from as any)('invitees').select('event_id, status, attended, events(title, start_at, status)').eq('person_id', route.params.id),
  ])
  resolvePersonTypes(orgId.value as string).then(all => { personTypes.value = (all ?? []).filter((t: any) => (t.kind ?? 'person') === 'person') })
  person.value = p ?? null
  allGroups.value = groups ?? []
  // A person can hold several roles — show every custom field that applies to ANY
  // of them. Fall back to the legacy single type, then 'member'.
  const ptypes: string[] = (p?.person_types?.length ? p.person_types : (p?.person_type ? [p.person_type] : ['member']))
  customFields.value = (fields ?? []).filter((f: any) => ptypes.some(t => fieldAppliesTo(f, t)))
  activity.value = (invites ?? [])
    .map((i: any) => ({ event_id: i.event_id, status: i.status, attended: i.attended, title: i.events?.title ?? 'Event', start_at: i.events?.start_at }))
    .sort((a: any, b: any) => (b.start_at || '').localeCompare(a.start_at || ''))

  if (p) {
    form.first_name = p.first_name ?? ''
    form.last_name = p.last_name ?? ''
    form.email = p.email ?? ''
    form.phone = p.phone ?? ''
    form.phone2 = p.phone2 ?? ''
    form.dob = p.dob ? new Date(p.dob) : null
    form.gender = p.gender ?? null
    form.membership_type = p.membership_type ?? ''
    form.person_types = (p.person_types?.length ? p.person_types : (p.person_type ? [p.person_type] : [])) as string[]
    form.person_type = form.person_types[0] ?? null
    form.comms_topics = Array.isArray(p.comms_topics) ? p.comms_topics : []
    form.group_ids = (memberships ?? []).map((m: any) => m.group_id)
    form.group_roles = Object.fromEntries((memberships ?? []).map((m: any) => [m.group_id, scopedRoles.normalizeRoles('group', m.roles, m.role)]))
    initialGroupIds.value = [...form.group_ids]
    // hydrate custom field values (dates → Date objects)
    const raw = p.custom_fields ?? {}
    const custom: Record<string, any> = {}
    for (const f of customFields.value) {
      let v = raw[f.id]
      if (f.field_type === 'date' && v) v = new Date(v)
      if (f.field_type === 'checkbox') v = !!v
      custom[f.id] = v ?? (f.field_type === 'checkbox' ? false : null)
    }
    form.custom = custom
  }

  // ── Designed profile layout for this person's PRIMARY type (falls back to default list) ──
  const typeKey = (ptypes[0] || 'member')
  ;(db.from as any)('profile_forms').select('config').eq('org_id', orgId.value).eq('type_key', typeKey).maybeSingle()
    .then(({ data }: any) => { profileLayout.value = Array.isArray(data?.config?.fields) ? data.config.fields : null })

  // ── Dashboard bundle ──
  const [{ data: orgRow }, { data: regs }, { data: notesData }] = await Promise.all([
    (db.from as any)('organisations').select('profile_dashboard').eq('id', orgId.value).maybeSingle(),
    (db.from as any)('registrations').select('id, total_amount, paid_amount, status').eq('person_id', route.params.id),
    (db.from as any)('person_notes').select('*').eq('person_id', route.params.id).order('created_at', { ascending: false }),
  ])
  dashConfig.value = orgRow?.profile_dashboard ?? null
  notes.value = notesData ?? []

  const regList = regs ?? []
  const regIds = regList.map((r: any) => r.id)
  let txns: any[] = []
  if (regIds.length) {
    const { data } = await (db.from as any)('transactions').select('registration_id, xero_invoice_id').in('registration_id', regIds)
    txns = data ?? []
  }
  const invByReg: Record<string, string> = {}
  for (const t of txns) if (t.xero_invoice_id && !invByReg[t.registration_id]) invByReg[t.registration_id] = t.xero_invoice_id
  financials.value = regList.map((r: any) => ({
    invoice: invByReg[r.id] || `REG-${String(r.id).slice(0, 8)}`,
    amount: `$${Number(r.total_amount || 0).toFixed(2)}`,
    status: Number(r.total_amount || 0) > 0 && Number(r.paid_amount || 0) >= Number(r.total_amount || 0) ? 'PAID' : 'PENDING',
  }))
  outstandingBalance.value = regList.reduce((s: number, r: any) => s + Math.max(0, Number(r.total_amount || 0) - Number(r.paid_amount || 0)), 0)

  const eventIds = (invites ?? []).map((i: any) => i.event_id).filter(Boolean)
  if (eventIds.length) {
    const { data: comms } = await (db.from as any)('communications')
      .select('subject, status, sent_at, created_at, event_id').in('event_id', eventIds)
      .order('created_at', { ascending: false }).limit(12)
    communications.value = (comms ?? []).map((c: any) => ({
      date: formatDate(new Date(c.sent_at || c.created_at)), subject: c.subject, status: c.status,
    }))
  } else communications.value = []

  snapshot.value = canonForm()
  loading.value = false
}

async function reloadNotes() {
  const { data } = await (db.from as any)('person_notes').select('*').eq('person_id', route.params.id).order('created_at', { ascending: false })
  notes.value = data ?? []
}
async function createNote({ body, links }: { body: string; links: any[] }) {
  const { error } = await (db.from as any)('person_notes').insert({
    org_id: orgId.value, person_id: route.params.id, body, links: links ?? [],
    author_id: user.value?.id ?? null,
    author_name: (user.value?.user_metadata as any)?.full_name || user.value?.email || null,
  })
  if (!error) { toast.add({ severity: 'success', summary: 'Note added', life: 2000 }); reloadNotes() }
  else toast.add({ severity: 'error', summary: 'Could not add note', detail: error.message, life: 4000 })
}
async function removeNote(id: string) {
  await (db.from as any)('person_notes').delete().eq('id', id)
  reloadNotes()
}

function cancelEdit() {
  Object.assign(form, JSON.parse(snapshot.value, (k, v) => (k === 'dob' && v ? new Date(v) : v)))
  // revive Date objects for custom date fields
  for (const f of customFields.value) {
    if (f.field_type === 'date' && form.custom[f.id]) form.custom[f.id] = new Date(form.custom[f.id])
  }
  // stay in the live form view
}

async function save() {
  if (!(form.first_name || '').trim() || !(form.last_name || '').trim()) return
  saving.value = true

  // serialise custom fields
  const custom: Record<string, any> = {}
  for (const f of customFields.value) {
    const v = form.custom[f.id]
    if (v === null || v === undefined || v === '') continue
    custom[f.id] = f.field_type === 'date' ? toIsoDate(v instanceof Date ? v : new Date(v)) : v
  }

  const payload = {
    first_name: (form.first_name || '').trim(),
    last_name: (form.last_name || '').trim(),
    email: (form.email || '').trim() || null,
    phone: (form.phone || '').trim() || null,
    phone2: (form.phone2 || '').trim() || null,
    dob: toIsoDate(form.dob),
    gender: form.gender || null,
    membership_type: (form.membership_type || '').trim() || null,
    person_types: form.person_types.length ? form.person_types : null,
    person_type: form.person_types[0] || null, // keep primary/legacy in sync
    comms_topics: form.comms_topics.length ? form.comms_topics : null,
    custom_fields: custom,
    updated_at: new Date().toISOString(),
  }
  const { error } = await (db.from as any)('persons').update(payload).eq('id', route.params.id)

  if (error) {
    toast.add({ severity: 'error', summary: 'Could not save', detail: error.message, life: 4000 })
    saving.value = false
    return
  }

  // Reflect the saved values onto the loaded person so the Dashboard tab + header update live.
  if (person.value) Object.assign(person.value, payload)

  await syncGroups()
  initialGroupIds.value = [...form.group_ids]
  snapshot.value = canonForm()
  toast.add({ severity: 'success', summary: 'Saved', life: 3000 })
  saving.value = false
}

async function syncGroups() {
  const before = new Set(initialGroupIds.value)
  const after = new Set(form.group_ids)
  const toAdd = form.group_ids.filter(id => !before.has(id))
  const toRemove = initialGroupIds.value.filter(id => !after.has(id))
  if (toRemove.length) {
    await (db.from as any)('member_group_memberships')
      .delete().eq('person_id', route.params.id).in('group_id', toRemove)
  }
  // Upsert all current memberships so both new rows and edited roles persist.
  // roles[] is the source of truth; role = roles[0] keeps the legacy anchor.
  if (form.group_ids.length) {
    await (db.from as any)('member_group_memberships')
      .upsert(form.group_ids.map(group_id => {
        const roles = form.group_roles[group_id] || []
        return { group_id, person_id: route.params.id, roles, role: roles[0] || null }
      }), { onConflict: 'group_id,person_id' })
  }
}

async function deletePerson() {
  await (db.from as any)('persons').delete().eq('id', route.params.id)
  toast.add({ severity: 'success', summary: 'Person deleted', life: 2500 })
  navigateTo('/people')
}

onMounted(() => {
  const h = (route.hash || '').replace('#', '')
  if (VALID_TABS.includes(h)) activeTab.value = h
  scopedRoles.loadRoleDefs()
  load()
})
</script>
