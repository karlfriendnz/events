<!--
  Super-admin "Master" data — platform-wide catalogues that clubs draw from:
   * Brands     (a brand a club connects to; organisations.brand_id)
   * Club Types (club_types; assigned to clubs on Settings → General). Each type
     is also a SETUP TEMPLATE — "Defaults" configures the modules, people types
     and terminology a new club of that type is seeded with (migration 248).
  All super-admin owned (org_id-less). CRUD here flows to every club.
-->
<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const db = useDb()
const route = useRoute()
const user = useSupabaseUser()
const toast = useToast()
const { uploadFile } = useUpload()
const activeTab = computed(() => String(route.query.tab || 'brands'))
const isSuper = computed(() => ((user.value as any)?.app_metadata?.role) === 'super_admin')

// ── Brands ──
interface Brand { id: string; name: string; logo_url: string | null; icon_url: string | null; color: string | null; sort_order: number }
const brands = ref<Brand[]>([])
const newBrand = ref('')
async function loadBrands() {
  const { data } = await (db.from as any)('brands').select('id, name, logo_url, icon_url, color, sort_order').order('sort_order').order('name')
  brands.value = data ?? []
}
async function addBrand() {
  const name = newBrand.value.trim(); if (!name) return
  await (db.from as any)('brands').insert({ name, sort_order: brands.value.length })
  newBrand.value = ''; await loadBrands()
}
async function patchBrand(b: Brand, patch: Partial<Brand>) {
  await (db.from as any)('brands').update(patch).eq('id', b.id)
}
async function removeBrand(id: string) {
  await (db.from as any)('brands').delete().eq('id', id); await loadBrands()
}
async function onBrandImage(b: Brand, kind: 'logo' | 'icon', e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return
  try {
    const url = await uploadFile(file)
    if (kind === 'logo') b.logo_url = url; else b.icon_url = url
    await patchBrand(b, kind === 'logo' ? { logo_url: url } : { icon_url: url })
    toast.add({ severity: 'success', summary: `${kind === 'logo' ? 'Logo' : 'Icon'} uploaded`, life: 1500 })
  } catch (err: any) { toast.add({ severity: 'error', summary: 'Upload failed', detail: err?.message, life: 4000 }) }
}

// ── Club types ──
interface ClubTypeRow { id: string; name: string; sort_order: number }
const clubTypes = ref<ClubTypeRow[]>([])
const newClubType = ref('')
async function loadClubTypes() {
  const { data } = await (db.from as any)('club_types').select('id, name, sort_order').order('sort_order').order('name')
  clubTypes.value = data ?? []
}
async function addClubType() {
  const name = newClubType.value.trim(); if (!name) return
  await (db.from as any)('club_types').insert({ name, sort_order: clubTypes.value.length })
  newClubType.value = ''; await loadClubTypes()
}
async function renameClubType(t: ClubTypeRow) {
  await (db.from as any)('club_types').update({ name: t.name.trim() }).eq('id', t.id)
}
async function removeClubType(id: string) {
  await (db.from as any)('club_types').delete().eq('id', id); await loadClubTypes()
}

// ── Club-type DEFAULTS (setup template — migration 248) ──
const { MODULE_DEFS } = useOrgModules()
const { TERM_DEFS } = useTerminology()
const { loadDefaults, saveDefaults, loadOverallDefaultId } = useClubTypes()
// The platform-wide "Overall default" template every new club is seeded from.
const overallDefault = ref<ClubTypeRow | null>(null)
async function loadOverall() {
  const id = await loadOverallDefaultId()
  overallDefault.value = id ? { id, name: 'Overall default', sort_order: -1 } : null
}
const STANDARD_TYPES = [
  { key: 'member', label: 'Member', is_access: false },
  { key: 'parent', label: 'Parent', is_access: false },
  { key: 'emergency_contact', label: 'Emergency contact', is_access: false },
  { key: 'committee', label: 'Committee', is_access: true },
  { key: 'manager', label: 'Manager', is_access: true },
  { key: 'admin', label: 'Admin', is_access: true },
]
function slugify(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') }
const termGroups = computed(() => {
  const g: Record<string, typeof TERM_DEFS> = {}
  for (const t of TERM_DEFS) (g[t.group] ||= []).push(t)
  return Object.entries(g).map(([group, defs]) => ({ group, defs }))
})

const defaultsOpen = ref(false)
const defaultsType = ref<ClubTypeRow | null>(null)
const savingDefaults = ref(false)
const modOn = reactive<Record<string, boolean>>({})           // module key → enabled
const dPersonTypes = ref<any[]>([])
const dTerm = reactive<Record<string, { singular?: string; plural?: string }>>({})
const newTypeLabel = ref('')

async function openDefaults(t: ClubTypeRow) {
  defaultsType.value = t
  const d = await loadDefaults(t.id)
  // Modules: null = "all on" → tick every module.
  for (const m of MODULE_DEFS) modOn[m.key] = d.default_modules === null ? true : (m.core || d.default_modules.includes(m.key))
  dPersonTypes.value = (d.default_person_types ?? []).map(p => ({ key: p.key, label: p.label, is_access: !!p.is_access, permissions: p.permissions ?? {}, menu_items: p.menu_items ?? null, landing_path: p.landing_path ?? null }))
  configIdx.value = null
  for (const k of Object.keys(dTerm)) delete dTerm[k]
  Object.assign(dTerm, d.default_terminology ?? {})
  defaultsOpen.value = true
}
function addStandardTypes() {
  const have = new Set(dPersonTypes.value.map(p => p.key))
  for (const s of STANDARD_TYPES) if (!have.has(s.key)) dPersonTypes.value.push({ ...s, permissions: defaultPermissionsFor(s.key), menu_items: null, landing_path: null })
}
function addPersonType() {
  const label = newTypeLabel.value.trim(); if (!label) return
  const key = slugify(label) || 'type_' + dPersonTypes.value.length
  if (!dPersonTypes.value.some(p => p.key === key)) dPersonTypes.value.push({ key, label, is_access: false, permissions: {}, menu_items: null, landing_path: null })
  newTypeLabel.value = ''
}
// Per-type config expand (Permissions / Menu / Landing) inside the Defaults dialog.
const configIdx = ref<number | null>(null)
function toggleConfig(i: number) { configIdx.value = configIdx.value === i ? null : i }
const { CLUB_MENU: MASTER_MENU } = useClubMenu()
function menuOn(p: any, href: string) { return Array.isArray(p.menu_items) ? p.menu_items.includes(href) : false }
function toggleMenu(p: any, href: string, on: boolean) {
  const base = Array.isArray(p.menu_items) ? [...p.menu_items] : []
  p.menu_items = on ? [...new Set([...base, href])] : base.filter((h: string) => h !== href)
}
function setTypeMenuCustom(p: any, on: boolean) { p.menu_items = on ? MASTER_MENU.map(m => m.href) : null }
const MASTER_LANDING = [
  { label: 'Dashboard', value: null as string | null }, { label: 'Classes', value: '/groups' },
  { label: 'Events', value: '/events' }, { label: 'People', value: '/people' },
  { label: 'Memberships', value: '/memberships' }, { label: 'Bookings', value: '/bookables?tab=bookings' },
  { label: 'Attendance', value: '/attendance' }, { label: 'My profile & contacts', value: '/account/profiles' },
]
function removePersonType(i: number) { dPersonTypes.value.splice(i, 1) }
function setTerm(key: string, which: 'singular' | 'plural', v: string) {
  if (!dTerm[key]) dTerm[key] = {}
  dTerm[key][which] = v
}
async function saveDefaultsNow() {
  if (!defaultsType.value) return
  savingDefaults.value = true
  // Modules → explicit array of enabled non-core keys.
  const modules = MODULE_DEFS.filter(m => !m.core && modOn[m.key]).map(m => m.key)
  // Terminology → only non-default values.
  const term: Record<string, { singular?: string; plural?: string }> = {}
  for (const def of TERM_DEFS) {
    const ov = dTerm[def.key] || {}; const out: any = {}
    if (ov.singular?.trim() && ov.singular.trim() !== def.singular) out.singular = ov.singular.trim()
    if (ov.plural?.trim() && ov.plural.trim() !== def.plural) out.plural = ov.plural.trim()
    if (Object.keys(out).length) term[def.key] = out
  }
  const types = dPersonTypes.value.filter(p => p.key && p.label.trim())
    .map(p => ({ key: p.key, label: p.label.trim(), is_access: p.is_access, permissions: p.permissions ?? {}, menu_items: p.menu_items ?? null, landing_path: p.landing_path ?? null }))
  await saveDefaults(defaultsType.value.id, {
    default_modules: modules,
    default_person_types: types.length ? types : null,
    default_terminology: Object.keys(term).length ? term : null,
  })
  savingDefaults.value = false
  defaultsOpen.value = false
  toast.add({ severity: 'success', summary: 'Defaults saved', life: 1800 })
}

onMounted(() => {
  if (!isSuper.value) { navigateTo('/'); return }
  loadBrands(); loadClubTypes(); loadOverall()
})
</script>

<template>
  <div v-if="isSuper" class="p-3 sm:p-6 md:p-8 max-w-4xl mx-auto">
    <div class="mb-4">
      <h1 class="text-xl font-semibold text-gray-900">Master data</h1>
      <p class="text-sm text-gray-500">Platform-wide catalogues every club draws from.</p>
    </div>

    <Tabs :value="activeTab" @update:value="v => navigateTo({ query: { tab: v } })">
      <TabList>
        <Tab value="brands">Brands</Tab>
        <Tab value="club-types">Club Types</Tab>
      </TabList>
      <TabPanels>
        <!-- Brands -->
        <TabPanel value="brands">
          <div class="card p-5">
            <div class="mb-3">
              <h2 class="text-sm font-semibold text-gray-700">Brands</h2>
              <p class="text-xs text-gray-500">A brand a club connects to (white-label / parent brand).</p>
            </div>
            <div class="space-y-2.5">
              <div v-for="b in brands" :key="b.id" class="flex flex-wrap items-center gap-2.5">
                <label v-tooltip.top="'Logo (wordmark)'" class="w-16 h-10 shrink-0 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden cursor-pointer hover:border-gray-300">
                  <img v-if="b.logo_url" :src="b.logo_url" class="w-full h-full object-contain" />
                  <i v-else class="pi pi-image text-gray-300 text-sm" />
                  <input type="file" accept="image/*" class="hidden" @change="e => onBrandImage(b, 'logo', e)" />
                </label>
                <label v-tooltip.top="'Icon (square mark)'" class="w-10 h-10 shrink-0 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden cursor-pointer hover:border-gray-300">
                  <img v-if="b.icon_url" :src="b.icon_url" class="w-full h-full object-cover" />
                  <i v-else class="pi pi-bookmark text-gray-300 text-xs" />
                  <input type="file" accept="image/*" class="hidden" @change="e => onBrandImage(b, 'icon', e)" />
                </label>
                <InputText v-model="b.name" class="flex-1" @blur="patchBrand(b, { name: b.name.trim() })" />
                <input type="color" :value="b.color || '#1E2157'" class="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                  @input="e => { b.color = (e.target as HTMLInputElement).value; patchBrand(b, { color: b.color }) }" />
                <button type="button" class="text-gray-300 hover:text-red-500 w-8 h-8 flex items-center justify-center" @click="removeBrand(b.id)">
                  <i class="pi pi-trash text-xs" />
                </button>
              </div>
              <p v-if="!brands.length" class="text-sm text-gray-400">No brands yet.</p>
              <div class="flex items-center gap-2 border-t border-gray-100 pt-3">
                <InputText v-model="newBrand" placeholder="New brand e.g. Swimming NZ" class="flex-1" @keyup.enter="addBrand" />
                <Button label="Add" style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="addBrand" />
              </div>
            </div>
          </div>
        </TabPanel>

        <!-- Club types -->
        <TabPanel value="club-types">
          <div class="card p-5">
            <div class="mb-3">
              <h2 class="text-sm font-semibold text-gray-700">Club types</h2>
              <p class="text-xs text-gray-500">Clubs pick from these (multi-select) on Settings → General. <span class="text-gray-400">"Defaults" sets the modules, people types and terminology a new club of this type starts with.</span></p>
            </div>
            <div class="space-y-2 max-w-xl">
              <!-- Overall default: the base template every new club is seeded from -->
              <div v-if="overallDefault" class="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/15 px-3 py-2 mb-1">
                <i class="pi pi-star-fill text-primary text-xs" />
                <span class="flex-1 text-sm font-medium text-gray-800">Overall default <span class="text-xs text-gray-400 font-normal">— every new club starts here</span></span>
                <button type="button" class="text-xs text-primary hover:underline shrink-0 px-1" @click="navigateTo(`/admin/club-defaults/${overallDefault!.id}`)">Edit template</button>
              </div>
              <div v-for="t in clubTypes" :key="t.id" class="flex items-center gap-2">
                <InputText v-model="t.name" class="flex-1" @blur="renameClubType(t)" />
                <button type="button" class="text-xs text-primary hover:underline shrink-0 px-1" @click="navigateTo(`/admin/club-defaults/${t.id}`)">Defaults</button>
                <button type="button" class="text-gray-300 hover:text-red-500 w-8 h-8 flex items-center justify-center" @click="removeClubType(t.id)">
                  <i class="pi pi-trash text-xs" />
                </button>
              </div>
              <p v-if="!clubTypes.length" class="text-sm text-gray-400">No club types yet.</p>
              <div class="flex items-center gap-2 border-t border-gray-100 pt-3">
                <InputText v-model="newClubType" placeholder="New club type e.g. Gymnastics" class="flex-1" @keyup.enter="addClubType" />
                <Button label="Add" style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="addClubType" />
              </div>
            </div>
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>

    
  </div>
</template>
