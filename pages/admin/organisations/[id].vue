<template>
  <div class="p-3 sm:p-6 md:p-8">
    <!-- header -->
    <div class="flex items-center gap-3 mb-5">
      <button type="button" class="text-gray-400 hover:text-gray-700" @click="navigateTo('/admin')"><i class="pi pi-arrow-left" /></button>
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <h1 class="text-lg sm:text-2xl font-semibold text-gray-900 truncate">{{ org?.name || 'Organisation' }}</h1>
          <span v-if="org" class="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{{ orgLevelLabel(f.orgLevel) }}</span>
        </div>
        <p class="text-xs text-gray-400">{{ id }}</p>
      </div>
      <div class="ml-auto">
        <Button label="Open in app" icon="pi pi-sign-in" size="small" severity="secondary" outlined @click="openInApp" />
      </div>
    </div>

    <!-- tabs -->
    <div class="flex gap-1 border-b border-gray-200 mb-5 overflow-x-auto no-scrollbar">
      <button v-for="t in tabs" :key="t.key" type="button"
        class="px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap"
        :class="tab === t.key ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'"
        @click="tab = t.key">
        <i :class="t.icon" class="mr-1.5 text-xs" />{{ t.label }}
      </button>
    </div>

    <!-- Details -->
    <div v-show="tab === 'details'" class="space-y-5">
      <div v-if="loading" class="text-sm text-gray-400">Loading…</div>
      <template v-else>
        <div class="grid gap-3 sm:grid-cols-3">
          <div class="card p-4"><div class="text-xs text-gray-400">Members</div><div class="text-lg font-bold text-gray-800">{{ counts.members }}</div></div>
          <div class="card p-4"><div class="text-xs text-gray-400">Events</div><div class="text-lg font-bold text-gray-800">{{ counts.events }}</div></div>
          <div class="card p-4"><div class="text-xs text-gray-400">Child orgs</div><div class="text-lg font-bold text-gray-800">{{ childCount }}</div></div>
        </div>

        <AppCard title="Organisation">
          <div class="p-4 sm:p-5 space-y-4">
            <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
              <label class="text-sm text-gray-600 w-full sm:w-32">Name</label>
              <InputText v-model="f.name" class="w-full sm:w-80" />
            </div>
            <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
              <label class="text-sm text-gray-600 w-full sm:w-32">Level</label>
              <div class="flex items-center gap-2">
                <Select v-model="f.orgLevel" :options="levelOptions" optionLabel="label" optionValue="value" class="w-full sm:w-64" />
                <span class="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">type: {{ derivedType }}</span>
              </div>
            </div>
            <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
              <label class="text-sm text-gray-600 w-full sm:w-32">Parent org</label>
              <Select v-model="f.parentId" :options="parentOptions" optionLabel="label" optionValue="value" class="w-full sm:w-80" showClear placeholder="None (top level)" filter />
            </div>
            <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
              <label class="text-sm text-gray-600 w-full sm:w-32">Brand</label>
              <Select v-model="f.brandId" :options="brandOptions" optionLabel="label" optionValue="value" class="w-full sm:w-80" showClear placeholder="No brand">
                <template #option="{ option }">
                  <span class="inline-flex items-center gap-2"><span v-if="option.color" class="w-3 h-3 rounded-full" :style="{ background: option.color }" />{{ option.label }}</span>
                </template>
              </Select>
            </div>
            <div v-if="derivedType === 'CLUB'" class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
              <label class="text-sm text-gray-600 w-full sm:w-32">Club types</label>
              <MultiSelect v-model="f.clubTypeIds" :options="clubTypeOptions" optionLabel="label" optionValue="value" class="w-full sm:w-80" display="chip" placeholder="None" />
            </div>
            <div v-if="derivedType !== 'CLUB'" class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
              <label class="text-sm text-gray-600 w-full sm:w-32">Default sport</label>
              <InputText v-model="f.defaultSportName" class="w-full sm:w-80" placeholder="e.g. Football" />
            </div>

            <div class="pt-2 border-t border-gray-100" />
            <div class="grid gap-4 sm:grid-cols-2">
              <div v-for="fld in scalarFields" :key="fld.key" class="flex flex-col gap-1">
                <label class="text-xs text-gray-500">{{ fld.label }}</label>
                <InputText v-model="(f as any)[fld.key]" class="w-full" :placeholder="fld.placeholder" />
              </div>
            </div>

            <div class="flex items-center gap-3 pt-2">
              <Button label="Save changes" icon="pi pi-check" :loading="saving" :disabled="!dirty"
                style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="save" />
              <button v-if="dirty" type="button" class="text-xs text-gray-400 hover:text-gray-600" @click="revert">Revert</button>
              <span v-if="savedFlash" class="text-sm text-green-700">Saved ✓</span>
            </div>
          </div>
        </AppCard>
      </template>
    </div>

    <!-- Seed -->
    <div v-show="tab === 'seed'">
      <SeedPanel v-if="org" :org-id="id" :org-name="f.name" @deleted="navigateTo('/admin')" @seeded="loadCounts" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
definePageMeta({ layout: 'admin' })
const route = useRoute()
const id = computed(() => String(route.params.id))
const user = useSupabaseUser()
const isSuper = computed(() => (user.value?.app_metadata as any)?.role === 'super_admin')
const toast = useToast()

const orgsApi = useOrganisationsApi()
const adminApi = useAdminApi()

const loading = ref(true)
const org = ref<any>(null)
const counts = reactive({ members: 0, events: 0 })
const childCount = ref(0)
const saving = ref(false)
const savedFlash = ref(false)

const allOrgs = ref<{ id: string; name: string; org_level: string }[]>([])
const brandCat = ref<{ id: string; name: string; color: string | null }[]>([])
const clubTypeCat = ref<{ id: string; name: string }[]>([])

const tab = ref<'details' | 'seed'>('details')
const tabs = [
  { key: 'details', label: 'Details', icon: 'pi pi-info-circle' },
  { key: 'seed', label: 'Seed data', icon: 'pi pi-database' },
]

// ── editable form ────────────────────────────────────────────────
type Form = {
  name: string; orgLevel: string; parentId: string | null; brandId: string | null
  clubTypeIds: string[]; defaultSportName: string
  currency: string; locale: string; country: string; email: string; phone: string; website: string
}
const blank = (): Form => ({ name: '', orgLevel: 'CLUB', parentId: null, brandId: null, clubTypeIds: [], defaultSportName: '', currency: '', locale: '', country: '', email: '', phone: '', website: '' })
const f = reactive<Form>(blank())
const original = ref<Form>(blank())
const dirty = computed(() => JSON.stringify(f) !== JSON.stringify(original.value))
const derivedType = computed(() => isGoverningBody(f.orgLevel as any) ? 'NSO' : f.orgLevel === 'RST' ? 'RST' : 'CLUB')

const scalarFields = [
  { key: 'currency', label: 'Currency', placeholder: 'NZD' },
  { key: 'locale', label: 'Locale', placeholder: 'en-NZ' },
  { key: 'country', label: 'Country', placeholder: '' },
  { key: 'email', label: 'Email', placeholder: '' },
  { key: 'phone', label: 'Phone', placeholder: '' },
  { key: 'website', label: 'Website', placeholder: '' },
]
const levelOptions = (ORG_TYPE_OPTIONS as readonly string[]).map(v => ({ value: v, label: orgLevelLabel(v) }))
const brandOptions = computed(() => brandCat.value.map(b => ({ value: b.id, label: b.name, color: b.color })))
const clubTypeOptions = computed(() => clubTypeCat.value.map(t => ({ value: t.id, label: t.name })))
const parentOptions = computed(() => allOrgs.value
  .filter(o => o.id !== id.value && orgLevelRank(o.org_level) > orgLevelRank(f.orgLevel))
  .map(o => ({ value: o.id, label: `${o.name} · ${orgLevelLabel(o.org_level)}` }))
  .sort((a, b) => a.label.localeCompare(b.label)))

function seedForm(profile: any, row: any) {
  const next: Form = {
    name: org.value?.name ?? profile?.name ?? '',
    orgLevel: org.value?.orgLevel ?? 'CLUB',
    parentId: org.value?.parentId ?? null,
    brandId: row?.brandId ?? null,
    clubTypeIds: row?.clubTypeIds ?? [],
    defaultSportName: profile?.defaultSportName ?? '',
    currency: profile?.currency ?? '', locale: profile?.locale ?? '', country: profile?.country ?? '',
    email: profile?.email ?? '', phone: profile?.phone ?? '', website: profile?.website ?? '',
  }
  Object.assign(f, next)
  original.value = JSON.parse(JSON.stringify(next))
}
function revert() { Object.assign(f, JSON.parse(JSON.stringify(original.value))) }

async function loadCounts() {
  try {
    const all = await adminApi.orgsWithCounts()
    allOrgs.value = all.map((r: any) => ({ id: r.id, name: r.name, org_level: r.orgLevel }))
    const mine = all.find((r: any) => r.id === id.value)
    if (mine) { counts.members = mine.members ?? 0; counts.events = mine.events ?? 0 }
    return mine
  } catch { return null }
}

async function save() {
  saving.value = true
  const o = original.value
  try {
    if (f.orgLevel !== o.orgLevel) await adminApi.setOrgLevel(id.value, f.orgLevel, derivedType.value)
    if (f.brandId !== o.brandId) await adminApi.setOrgBrand(id.value, f.brandId)
    if (JSON.stringify(f.clubTypeIds) !== JSON.stringify(o.clubTypeIds)) await adminApi.setOrgClubTypes(id.value, f.clubTypeIds)
    if (f.parentId !== o.parentId) await orgsApi.setParent(id.value, f.parentId)
    const profilePatch: Record<string, any> = {}
    for (const k of ['name', 'currency', 'locale', 'country', 'email', 'phone', 'website', 'defaultSportName'] as const) {
      if (f[k] !== o[k]) profilePatch[k] = f[k] || null
    }
    if (Object.keys(profilePatch).length) await orgsApi.updateProfile(id.value, profilePatch)
    if (org.value) { org.value.name = f.name; org.value.orgLevel = f.orgLevel; org.value.parentId = f.parentId }
    original.value = JSON.parse(JSON.stringify(f))
    savedFlash.value = true; setTimeout(() => (savedFlash.value = false), 2500)
    toast.add({ severity: 'success', summary: 'Saved', life: 2500 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Save failed', detail: e?.data?.message || e?.message, life: 5000 })
  } finally { saving.value = false }
}

onMounted(async () => {
  if (!isSuper.value) { navigateTo('/'); return }
  try {
    const [o, profile, brands, clubTypes, row] = await Promise.all([
      orgsApi.get(id.value),
      orgsApi.getProfile(id.value).catch(() => null),
      adminApi.brands(),
      adminApi.clubTypes(),
      loadCounts(),
    ])
    org.value = o
    brandCat.value = brands.map((b: any) => ({ id: b.id, name: b.name, color: b.color }))
    clubTypeCat.value = clubTypes.map((t: any) => ({ id: t.id, name: t.name }))
    childCount.value = (await orgsApi.descendants(id.value).catch(() => [])).length
    seedForm(profile, row)
  } finally { loading.value = false }
})

function openInApp() {
  if (import.meta.client) { sessionStorage.setItem('fm_active_org', id.value); localStorage.setItem('fm_active_org', id.value) }
  navigateTo('/dashboard')
}
</script>
