<!--
  Super-admin overarching dashboard. NOT club-scoped: lists every organisation
  across the whole hierarchy (Club -> Regional -> Association -> National) with
  member/event counts, and lets the super-admin "Open" any org into the normal
  club-scoped view (via <OrgSwitcher>'s fm_active_org mechanism).
  Visible only to users with app_metadata.role === 'super_admin'.
-->
<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
definePageMeta({ layout: 'admin' })

const db = useDb()
const user = useSupabaseUser()
const toast = useToast()

const isSuper = computed(() => ((user.value as any)?.app_metadata?.role) === 'super_admin')

interface OrgRow {
  id: string; name: string; org_level: string; parent_id: string | null; logo_url: string | null
  brand_id: string | null
  members: number; events: number; depth: number
}

const loading = ref(true)
const orgs = ref<OrgRow[]>([])
const brands = ref<{ id: string; name: string; logo_url: string | null; color: string | null }[]>([])
const brandById = computed<Record<string, { id: string; name: string; logo_url: string | null; color: string | null }>>(
  () => Object.fromEntries(brands.value.map(b => [b.id, b])))

// Roots-first depth-ordered traversal so children render indented under parents.
const orderedOrgs = computed<OrgRow[]>(() => {
  const byParent = new Map<string | null, OrgRow[]>()
  for (const o of orgs.value) {
    const k = o.parent_id && orgs.value.some(x => x.id === o.parent_id) ? o.parent_id : null
    if (!byParent.has(k)) byParent.set(k, [])
    byParent.get(k)!.push(o)
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => orgLevelRank(b.org_level) - orgLevelRank(a.org_level) || a.name.localeCompare(b.name))
  }
  const out: OrgRow[] = []
  const walk = (parent: string | null, depth: number) => {
    for (const o of byParent.get(parent) ?? []) {
      out.push({ ...o, depth })
      walk(o.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
})

// Level tabs across the top of the hierarchy table. "All" shows the indented
// hierarchy; a specific level shows a flat alphabetical list of just that level.
const levelTab = ref<string>('ALL')
const levelTabs = computed(() => {
  const present = (ORG_TYPE_OPTIONS as readonly string[]).filter(l => orgs.value.some(o => o.org_level === l))
  return [{ value: 'ALL', label: 'All', count: orgs.value.length },
    ...present.map(l => ({ value: l, label: orgLevelLabel(l), count: orgs.value.filter(o => o.org_level === l).length }))]
})
const search = ref('')
const displayedOrgs = computed<OrgRow[]>(() => {
  const q = search.value.trim().toLowerCase()
  // A search flattens to alphabetical name matches (the tree can't survive a filter);
  // no search + "All" keeps the indented hierarchy.
  if (q) {
    return orgs.value
      .filter(o => (levelTab.value === 'ALL' || o.org_level === levelTab.value) && o.name.toLowerCase().includes(q))
      .map(o => ({ ...o, depth: 0 }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }
  if (levelTab.value === 'ALL') return orderedOrgs.value
  return orgs.value
    .filter(o => o.org_level === levelTab.value)
    .map(o => ({ ...o, depth: 0 }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

const totals = computed(() => ({
  orgs: orgs.value.length,
  members: orgs.value.reduce((s, o) => s + o.members, 0),
  events: orgs.value.reduce((s, o) => s + o.events, 0),
  byLevel: (ORG_LEVELS as readonly string[]).map(l => ({
    level: l, label: orgLevelLabel(l), count: orgs.value.filter(o => o.org_level === l).length,
  })).filter(x => x.count > 0),
}))

async function load() {
  loading.value = true
  const [{ data: orgData }, { data: personRows }, { data: eventRows }, { data: brandRows }] = await Promise.all([
    (db.from as any)('organisations').select('id, name, org_level, parent_id, logo_url, brand_id').order('name'),
    (db.from as any)('persons').select('org_id'),
    (db.from as any)('events').select('org_id'),
    (db.from as any)('brands').select('id, name, logo_url, color').order('sort_order').order('name'),
  ])
  brands.value = brandRows ?? []
  const memberBy: Record<string, number> = {}
  for (const p of personRows ?? []) memberBy[p.org_id] = (memberBy[p.org_id] ?? 0) + 1
  const eventBy: Record<string, number> = {}
  for (const e of eventRows ?? []) eventBy[e.org_id] = (eventBy[e.org_id] ?? 0) + 1
  orgs.value = (orgData ?? []).map((o: any) => ({
    ...o,
    members: memberBy[o.id] ?? 0,
    events: eventBy[o.id] ?? 0,
    depth: 0,
  }))
  loading.value = false
}

function openOrg(id: string) {
  persistActiveOrg(id) // per-tab (sessionStorage) + last-used — so Open switches THIS tab
  window.location.href = '/dashboard'
}

// ── Assign a club to a brand inline from the table ──
const savingBrand = ref<string | null>(null)
async function setBrand(row: OrgRow, brandId: string | null) {
  if (row.brand_id === brandId) return
  savingBrand.value = row.id
  const { error } = await (db.from as any)('organisations').update({ brand_id: brandId }).eq('id', row.id)
  savingBrand.value = null
  if (error) { toast.add({ severity: 'error', summary: 'Could not update brand', detail: error.message, life: 4000 }); return }
  const o = orgs.value.find(x => x.id === row.id)
  if (o) o.brand_id = brandId
  const brandName = brandId ? (brandById.value[brandId]?.name ?? 'brand') : 'no brand'
  toast.add({ severity: 'success', summary: `${row.name} → ${brandName}`, life: 2500 })
}

// ── Create organisation ──
const orgLevelOptions = (ORG_TYPE_OPTIONS as readonly string[]).map(v => ({ value: v, label: orgLevelLabel(v) }))
const showCreate = ref(false)
const creating = ref(false)
const createError = ref('')
const newOrg = reactive<{ name: string; org_level: 'CLUB' | 'REGIONAL' | 'ASSOCIATION' | 'NATIONAL' | 'RST'; parent_id: string | null; default_sport_name: string; brand_id: string | null }>({
  name: '', org_level: 'CLUB', parent_id: null, default_sport_name: '', brand_id: null,
})
// Parents must sit higher in the hierarchy than the new org.
const newParentOptions = computed(() => orgs.value
  .filter(o => orgLevelRank(o.org_level) > orgLevelRank(newOrg.org_level))
  .map(o => ({ id: o.id, _label: `${o.name} · ${orgLevelLabel(o.org_level)}` }))
  .sort((a, b) => a._label.localeCompare(b._label)))

function openCreate() {
  newOrg.name = ''; newOrg.org_level = 'CLUB'; newOrg.parent_id = null; newOrg.default_sport_name = ''; newOrg.brand_id = null
  createError.value = ''; showCreate.value = true
}
async function createOrg() {
  if (!newOrg.name.trim()) { createError.value = 'Name is required'; return }
  creating.value = true; createError.value = ''
  const payload: any = {
    name: newOrg.name.trim(),
    type: isGoverningBody(newOrg.org_level) ? 'NSO' : (newOrg.org_level === 'CLUB' ? 'CLUB' : 'RST'),
    org_level: newOrg.org_level,
    parent_id: newOrg.parent_id,
    default_sport_name: isGoverningBody(newOrg.org_level) ? (newOrg.default_sport_name.trim() || null) : null,
    brand_id: newOrg.brand_id,
  }
  const { error } = await (db.from as any)('organisations').insert(payload)
  creating.value = false
  if (error) { createError.value = error.message; return }
  showCreate.value = false
  await load()
}
// Clearing parent isn't required, but if the chosen level no longer allows the
// current parent, drop it.
watch(() => newOrg.org_level, () => {
  if (newOrg.parent_id && !newParentOptions.value.some(o => o.id === newOrg.parent_id)) newOrg.parent_id = null
})

onMounted(() => {
  if (!isSuper.value) { navigateTo('/'); return }
  load()
})
</script>

<template>
  <div v-if="isSuper" class="p-3 sm:p-6 md:p-8 space-y-5">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div>
        <h1 class="text-xl font-semibold text-gray-900">All Organisations</h1>
        <p class="text-sm text-gray-500">Super-admin overview across every organisation — not scoped to a single club.</p>
      </div>
      <Button label="New organisation" icon="pi pi-plus" size="small" class="w-full sm:w-auto" style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="openCreate" />
    </div>

    <!-- Summary -->
    <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
      <div class="card p-4">
        <p class="text-xs text-gray-500">Organisations</p>
        <p class="text-2xl font-bold text-primary">{{ totals.orgs }}</p>
        <p class="text-[11px] text-gray-400 mt-0.5">
          <span v-for="(b, i) in totals.byLevel" :key="b.level">{{ i ? ' · ' : '' }}{{ b.count }} {{ b.label }}</span>
        </p>
      </div>
      <div class="card p-4">
        <p class="text-xs text-gray-500">Members (all orgs)</p>
        <p class="text-2xl font-bold text-primary">{{ totals.members }}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs text-gray-500">Events (all orgs)</p>
        <p class="text-2xl font-bold text-primary">{{ totals.events }}</p>
      </div>
    </div>

    <!-- Club types, brands and sport categories now live under Master (/admin/master). -->

    <!-- Hierarchy -->
    <div class="card p-0 overflow-hidden">
      <div class="px-5 pt-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
        <div class="flex items-center gap-1 flex-wrap flex-1">
          <button v-for="t in levelTabs" :key="t.value" type="button"
            class="px-3 py-2 text-sm border-b-2 -mb-px transition-colors"
            :class="levelTab === t.value ? 'border-primary text-primary font-medium' : 'border-transparent text-gray-500 hover:text-gray-800'"
            @click="levelTab = t.value">
            {{ t.label }}
            <span class="ml-1 text-[11px] text-gray-400">{{ t.count }}</span>
          </button>
        </div>
        <IconField class="mb-2">
          <InputIcon class="pi pi-search" />
          <InputText v-model="search" placeholder="Search organisations…" class="w-full sm:w-64" size="small" />
        </IconField>
      </div>
      <div v-if="loading" class="p-3 sm:p-6 text-sm text-gray-400">Loading…</div>
      <div v-else class="overflow-x-auto">
      <DataTable :value="displayedOrgs" dataKey="id" size="small" stripedRows
        :pt="{ table: { class: 'text-sm' } }">
        <Column header="Organisation">
          <template #body="{ data }">
            <span :style="{ paddingLeft: (data.depth * 18) + 'px' }" class="inline-flex items-center gap-2">
              <i v-if="data.depth > 0" class="pi pi-angle-right text-gray-300 text-xs" />
              <button type="button" class="font-medium text-gray-800 hover:text-primary hover:underline text-left" @click="openOrg(data.id)">{{ data.name }}</button>
            </span>
          </template>
        </Column>
        <Column header="Level">
          <template #body="{ data }">
            <span class="px-2 py-0.5 rounded text-[11px] bg-surface-100 text-surface-700">{{ orgLevelLabel(data.org_level) }}</span>
          </template>
        </Column>
        <Column header="Brand" headerStyle="width:14rem">
          <template #body="{ data }">
            <Select :modelValue="data.brand_id" :options="brands" option-label="name" option-value="id"
              placeholder="No brand" show-clear size="small" class="w-48"
              :loading="savingBrand === data.id" :disabled="savingBrand === data.id"
              @update:modelValue="v => setBrand(data, v)">
              <template #value="{ value }">
                <span v-if="value && brandById[value]" class="inline-flex items-center gap-1.5">
                  <img v-if="brandById[value].logo_url" :src="brandById[value].logo_url!" class="w-4 h-4 object-contain" />
                  <span v-else class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: brandById[value].color || '#cbd5e1' }" />
                  {{ brandById[value].name }}
                </span>
                <span v-else class="text-gray-400">No brand</span>
              </template>
              <template #option="{ option }">
                <span class="inline-flex items-center gap-1.5">
                  <img v-if="option.logo_url" :src="option.logo_url" class="w-4 h-4 object-contain" />
                  <span v-else class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: option.color || '#cbd5e1' }" />
                  {{ option.name }}
                </span>
              </template>
            </Select>
          </template>
        </Column>
        <Column header="Members" headerStyle="text-align:right" bodyStyle="text-align:right">
          <template #body="{ data }"><span class="tabular-nums text-gray-700">{{ data.members }}</span></template>
        </Column>
        <Column header="Events" headerStyle="text-align:right" bodyStyle="text-align:right">
          <template #body="{ data }"><span class="tabular-nums text-gray-700">{{ data.events }}</span></template>
        </Column>
        <Column headerStyle="width:6rem" bodyStyle="text-align:right">
          <template #body="{ data }">
            <button type="button" class="text-xs font-medium text-primary hover:underline" @click="openOrg(data.id)">Open →</button>
          </template>
        </Column>
        <template #empty><div class="p-3 sm:p-6 text-sm text-gray-400">No organisations at this level.</div></template>
      </DataTable>
      </div>
    </div>

    <!-- Create organisation -->
    <Dialog v-model:visible="showCreate" modal header="New organisation" :style="{ width: '95vw', maxWidth: '32rem' }">
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Name</label>
          <InputText v-model="newOrg.name" placeholder="e.g. Auckland Cricket" autofocus @keyup.enter="createOrg" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Level</label>
          <Select v-model="newOrg.org_level" :options="orgLevelOptions" option-label="label" option-value="value" class="w-full" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Parent organisation <span class="text-gray-400 font-normal">(optional)</span></label>
          <Select v-model="newOrg.parent_id" :options="newParentOptions" option-label="_label" option-value="id"
            placeholder="None (top level)" show-clear filter class="w-full" :disabled="!newParentOptions.length" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Brand <span class="text-gray-400 font-normal">(optional)</span></label>
          <Select v-model="newOrg.brand_id" :options="brands" option-label="name" option-value="id"
            placeholder="No brand" show-clear class="w-full">
            <template #value="{ value }">
              <span v-if="value && brandById[value]" class="inline-flex items-center gap-1.5">
                <img v-if="brandById[value].logo_url" :src="brandById[value].logo_url!" class="w-4 h-4 object-contain" />
                <span v-else class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: brandById[value].color || '#cbd5e1' }" />
                {{ brandById[value].name }}
              </span>
              <span v-else class="text-gray-400">No brand</span>
            </template>
            <template #option="{ option }">
              <span class="inline-flex items-center gap-1.5">
                <img v-if="option.logo_url" :src="option.logo_url" class="w-4 h-4 object-contain" />
                <span v-else class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: option.color || '#cbd5e1' }" />
                {{ option.name }}
              </span>
            </template>
          </Select>
        </div>
        <div v-if="isGoverningBody(newOrg.org_level)" class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Default sport name <span class="text-gray-400 font-normal">(optional)</span></label>
          <InputText v-model="newOrg.default_sport_name" placeholder="e.g. Cricket" />
          <p class="text-xs text-gray-400">Member clubs see this as the default name when they connect.</p>
        </div>
        <p v-if="createError" class="text-xs text-red-600">{{ createError }}</p>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showCreate = false" />
        <Button label="Create" :loading="creating" style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="createOrg" />
      </template>
    </Dialog>

    <Toast />
  </div>
</template>
