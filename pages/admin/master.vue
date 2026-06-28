<!--
  Super-admin "Master" data — platform-wide catalogues that clubs draw from:
   * Brands           (a brand a club connects to; organisations.brand_id)
   * Club Types       (club_types; assigned to clubs on Settings → General)
   * Sport Categories (sport_categories; grouping for sports)
  All super-admin owned (org_id-less). CRUD here flows to every club.
-->
<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const db = useDb()
const user = useSupabaseUser()
const toast = useToast()
const { uploadFile } = useUpload()
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

// ── Sport categories ──
interface SportCat { id: string; name: string; sort_order: number }
const sportCats = ref<SportCat[]>([])
const newSportCat = ref('')
async function loadSportCats() {
  const { data } = await (db.from as any)('sport_categories').select('id, name, sort_order').order('sort_order').order('name')
  sportCats.value = data ?? []
}
async function addSportCat() {
  const name = newSportCat.value.trim(); if (!name) return
  await (db.from as any)('sport_categories').insert({ name, sort_order: sportCats.value.length })
  newSportCat.value = ''; await loadSportCats()
}
async function renameSportCat(t: SportCat) {
  await (db.from as any)('sport_categories').update({ name: t.name.trim() }).eq('id', t.id)
}
async function removeSportCat(id: string) {
  await (db.from as any)('sport_categories').delete().eq('id', id); await loadSportCats()
}

onMounted(() => {
  if (!isSuper.value) { navigateTo('/'); return }
  loadBrands(); loadClubTypes(); loadSportCats()
})
</script>

<template>
  <div v-if="isSuper" class="p-3 sm:p-6 md:p-8 max-w-4xl mx-auto">
    <div class="mb-4">
      <h1 class="text-xl font-semibold text-gray-900">Master data</h1>
      <p class="text-sm text-gray-500">Platform-wide catalogues every club draws from.</p>
    </div>

    <Tabs value="brands">
      <TabList>
        <Tab value="brands">Brands</Tab>
        <Tab value="club-types">Club Types</Tab>
        <Tab value="sport-categories">Sport Categories</Tab>
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
              <p class="text-xs text-gray-500">Clubs pick from these (multi-select) on Settings → General.</p>
            </div>
            <div class="space-y-2 max-w-md">
              <div v-for="t in clubTypes" :key="t.id" class="flex items-center gap-2">
                <InputText v-model="t.name" class="flex-1" @blur="renameClubType(t)" />
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

        <!-- Sport categories -->
        <TabPanel value="sport-categories">
          <div class="card p-5">
            <div class="mb-3">
              <h2 class="text-sm font-semibold text-gray-700">Sport categories</h2>
              <p class="text-xs text-gray-500">Platform-wide grouping for sports.</p>
            </div>
            <div class="space-y-2 max-w-md">
              <div v-for="t in sportCats" :key="t.id" class="flex items-center gap-2">
                <InputText v-model="t.name" class="flex-1" @blur="renameSportCat(t)" />
                <button type="button" class="text-gray-300 hover:text-red-500 w-8 h-8 flex items-center justify-center" @click="removeSportCat(t.id)">
                  <i class="pi pi-trash text-xs" />
                </button>
              </div>
              <p v-if="!sportCats.length" class="text-sm text-gray-400">No sport categories yet.</p>
              <div class="flex items-center gap-2 border-t border-gray-100 pt-3">
                <InputText v-model="newSportCat" placeholder="New category e.g. Water sports" class="flex-1" @keyup.enter="addSportCat" />
                <Button label="Add" style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="addSportCat" />
              </div>
            </div>
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>
  </div>
</template>
