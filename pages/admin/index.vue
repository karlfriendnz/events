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

const api = useAdminApi()
const orgsApi = useOrganisationsApi()
const user = useSupabaseUser()
const toast = useToast()

const isSuper = computed(() => ((user.value as any)?.app_metadata?.role) === 'super_admin')

interface OrgRow {
  id: string; name: string; org_level: string; parent_id: string | null; logo_url: string | null
  brand_id: string | null; club_type_ids: string[] | null; is_template: boolean
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
  // The seam gives orgs (camelCase) with member/event counts already merged, plus
  // the brand + club-type catalogues. Map to the snake_case shapes the template reads.
  const [orgRows, brandRows, clubTypeRows] = await Promise.all([
    api.orgsWithCounts(),
    api.brands(),
    api.clubTypes(),
  ])
  brands.value = brandRows.map(b => ({ id: b.id, name: b.name, logo_url: b.logoUrl, color: b.color }))
  clubTypes.value = clubTypeRows.map(t => ({ id: t.id, name: t.name }))
  orgs.value = orgRows.map(o => ({
    id: o.id,
    name: o.name,
    org_level: o.orgLevel,
    parent_id: o.parentId,
    logo_url: o.logoUrl,
    brand_id: o.brandId,
    club_type_ids: o.clubTypeIds,
    is_template: o.isTemplate,
    members: o.members,
    events: o.events,
    depth: 0,
  }))
  loading.value = false
}

function openOrg(id: string) {
  persistActiveOrg(id) // per-tab (sessionStorage) + last-used — so Open switches THIS tab
  window.location.href = '/dashboard'
}

// ── Assign a club to a brand inline from the table ──
const clubTypes = ref<{ id: string; name: string }[]>([])
const savingLevel = ref<string | null>(null)
const savingType = ref<string | null>(null)
const orgLevelSelectOptions = (ORG_TYPE_OPTIONS as readonly string[]).map(v => ({ value: v, label: orgLevelLabel(v) }))
async function setOrgLevel(row: OrgRow, level: string) {
  if (row.org_level === level) return
  savingLevel.value = row.id
  await api.setOrgLevel(row.id, level, level === 'CLUB' ? 'CLUB' : level === 'RST' ? 'RST' : 'NSO')
  savingLevel.value = null
  const o = orgs.value.find(x => x.id === row.id); if (o) o.org_level = level
}
async function setClubTypes(row: OrgRow, ids: string[]) {
  savingType.value = row.id
  await api.setOrgClubTypes(row.id, ids ?? [])
  savingType.value = null
  const o = orgs.value.find(x => x.id === row.id); if (o) o.club_type_ids = ids
}
const savingBrand = ref<string | null>(null)
async function setBrand(row: OrgRow, brandId: string | null) {
  if (row.brand_id === brandId) return
  savingBrand.value = row.id
  try {
    await api.setOrgBrand(row.id, brandId)
  } catch (e: any) {
    savingBrand.value = null
    toast.add({ severity: 'error', summary: 'Could not update brand', detail: e?.data?.message || e?.message, life: 4000 }); return
  }
  savingBrand.value = null
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
const { applyClubTypeDefaults } = useClubTypes()
const { cloneOrgConfig, setOrgTemplate } = useAdminApi()
// Orgs marked as reusable setup templates — offered as a "start from" option on create.
const templateOrgs = computed(() => orgs.value.filter(o => o.is_template))
const newOrg = reactive<{ name: string; org_level: 'CLUB' | 'REGIONAL' | 'ASSOCIATION' | 'NATIONAL' | 'RST'; parent_id: string | null; default_sport_name: string; brand_id: string | null; club_type_ids: string[]; from_template_id: string | null; is_template: boolean }>({
  name: '', org_level: 'CLUB', parent_id: null, default_sport_name: '', brand_id: null, club_type_ids: [], from_template_id: null, is_template: false,
})
// Parents must sit higher in the hierarchy than the new org.
const newParentOptions = computed(() => orgs.value
  .filter(o => orgLevelRank(o.org_level) > orgLevelRank(newOrg.org_level))
  .map(o => ({ id: o.id, _label: `${o.name} · ${orgLevelLabel(o.org_level)}` }))
  .sort((a, b) => a._label.localeCompare(b._label)))

// editId set = the dialog is EDITING that org; null = creating a new one.
const editId = ref<string | null>(null)
function openCreate() {
  editId.value = null
  newOrg.name = ''; newOrg.org_level = 'CLUB'; newOrg.parent_id = null; newOrg.default_sport_name = ''; newOrg.brand_id = null; newOrg.club_type_ids = []
  newOrg.from_template_id = null; newOrg.is_template = false
  createError.value = ''; showCreate.value = true
}
function openEdit(row: OrgRow) {
  editId.value = row.id
  newOrg.name = row.name
  newOrg.org_level = (row.org_level as any) ?? 'CLUB'
  newOrg.parent_id = row.parent_id ?? null
  newOrg.default_sport_name = (row as any).default_sport_name ?? ''
  newOrg.brand_id = row.brand_id ?? null
  newOrg.club_type_ids = row.club_type_ids ?? []
  newOrg.from_template_id = null; newOrg.is_template = row.is_template
  createError.value = ''; showCreate.value = true
}
async function createOrg() {
  if (!newOrg.name.trim()) { createError.value = 'Name is required'; return }
  creating.value = true; createError.value = ''
  const isClub = newOrg.org_level === 'CLUB'
  const typeIds = isClub ? newOrg.club_type_ids : []
  const type = isGoverningBody(newOrg.org_level) ? 'NSO' : (isClub ? 'CLUB' : 'RST')
  const defaultSportName = isGoverningBody(newOrg.org_level) ? (newOrg.default_sport_name.trim() || null) : null

  // ── EDIT an existing org ──
  if (editId.value) {
    try {
      await orgsApi.update(editId.value, { name: newOrg.name.trim(), type, orgLevel: newOrg.org_level, defaultSportName, brandId: newOrg.brand_id, clubTypeIds: typeIds } as any)
      // parentId can't move via the patch (it's omitted on purpose) — use the dedicated route.
      await orgsApi.setParent(editId.value, newOrg.parent_id).catch(() => {})
      await setOrgTemplate(editId.value, newOrg.is_template).catch(() => {})
    } catch (e: any) { creating.value = false; createError.value = e?.data?.message || e?.message || 'Could not save organisation'; return }
    creating.value = false; showCreate.value = false
    await load(); return
  }

  // ── CREATE a new org ──
  let createdId: string | null = null
  try {
    createdId = await api.createOrg({
      name: newOrg.name.trim(),
      type,
      orgLevel: newOrg.org_level,
      parentId: newOrg.parent_id,
      defaultSportName,
      brandId: newOrg.brand_id,
      clubTypeIds: typeIds,
    })
  } catch (e: any) { creating.value = false; createError.value = e?.data?.message || e?.message || 'Could not create organisation'; return }
  // Seed the new club: from a TEMPLATE org (full config/structure clone) when chosen,
  // else from its club types' defaults (modules / people types / terminology).
  if (createdId && newOrg.from_template_id) {
    try { await cloneOrgConfig(newOrg.from_template_id, createdId) } catch (e) { /* non-fatal — org still created */ }
  } else if (createdId && typeIds.length) {
    try { await applyClubTypeDefaults(createdId, typeIds) } catch (e) { /* non-fatal — org still created */ }
  }
  creating.value = false
  showCreate.value = false
  await load()
}
// ── Delete an organisation (super-admin, type-to-confirm) ──
// Safe: FK'd child data is ON DELETE CASCADE; child ORGS' parent_id is ON DELETE
// SET NULL (they become top-level, never wiped). Non-FK org_id rows are harmless
// orphans once the org is gone.
const deleteTarget = ref<OrgRow | null>(null)
const deleteConfirm = ref('')
const deleting = ref(false)
const deleteError = ref('')
const canDelete = computed(() => !!deleteTarget.value && deleteConfirm.value.trim() === deleteTarget.value.name.trim())
function openDelete(row: OrgRow) {
  deleteTarget.value = row; deleteConfirm.value = ''; deleteError.value = ''
}
async function deleteOrg() {
  if (!deleteTarget.value || !canDelete.value) return
  deleting.value = true; deleteError.value = ''
  const name = deleteTarget.value.name
  try {
    await orgsApi.remove(deleteTarget.value.id)
  } catch (e: any) { deleting.value = false; deleteError.value = e?.data?.message || e?.message || 'Could not delete'; return }
  deleting.value = false
  toast.add({ severity: 'success', summary: 'Organisation deleted', detail: name, life: 2500 })
  deleteTarget.value = null
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
      <div class="flex items-center gap-2 w-full sm:w-auto">
        <Button label="Help docs" icon="pi pi-question-circle" size="small" severity="secondary" outlined class="flex-1 sm:flex-none" @click="navigateTo('/admin/help')" />
        <Button label="New organisation" icon="pi pi-plus" size="small" class="flex-1 sm:flex-none" style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="openCreate" />
      </div>
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
        <Column header="Level" headerStyle="width:11rem">
          <template #body="{ data }">
            <Select :modelValue="data.org_level" :options="orgLevelSelectOptions" option-label="label" option-value="value"
              size="small" class="w-36" :loading="savingLevel === data.id" :disabled="savingLevel === data.id"
              @update:modelValue="v => setOrgLevel(data, v)" />
          </template>
        </Column>
        <Column header="Club type" headerStyle="width:15rem">
          <template #body="{ data }">
            <MultiSelect v-if="data.org_level === 'CLUB'" :modelValue="data.club_type_ids || []" :options="clubTypes"
              option-label="name" option-value="id" filter placeholder="Add type(s)" size="small" class="w-52"
              :maxSelectedLabels="2" :loading="savingType === data.id"
              @update:modelValue="v => setClubTypes(data, v)" />
            <span v-else class="text-gray-300 text-xs">—</span>
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
        <Column headerStyle="width:10rem" bodyStyle="text-align:right">
          <template #body="{ data }">
            <div class="inline-flex items-center gap-3">
              <button type="button" class="text-xs font-medium text-primary hover:underline" @click="openOrg(data.id)">Open →</button>
              <NuxtLink :to="`/admin/organisations/${data.id}`" class="text-gray-400 hover:text-primary" v-tooltip.left="'Details & seed data'">
                <i class="pi pi-database text-xs" />
              </NuxtLink>
              <button type="button" class="text-gray-400 hover:text-primary" v-tooltip.left="'Edit organisation'" @click="openEdit(data)">
                <i class="pi pi-pencil text-xs" />
              </button>
              <button type="button" class="text-gray-300 hover:text-red-500" v-tooltip.left="'Delete organisation'" @click="openDelete(data)">
                <i class="pi pi-trash text-xs" />
              </button>
            </div>
          </template>
        </Column>
        <template #empty><div class="p-3 sm:p-6 text-sm text-gray-400">No organisations at this level.</div></template>
      </DataTable>
      </div>
    </div>

    <!-- Create / edit organisation -->
    <Dialog v-model:visible="showCreate" modal :header="editId ? 'Edit organisation' : 'New organisation'" :style="{ width: '95vw', maxWidth: '32rem' }">
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
        <div v-if="newOrg.org_level === 'CLUB'" class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Club type <span class="text-gray-400 font-normal">(optional)</span></label>
          <MultiSelect v-model="newOrg.club_type_ids" :options="clubTypes" option-label="name" option-value="id"
            placeholder="No type" display="chip" filter class="w-full" />
          <p v-if="newOrg.club_type_ids.length" class="text-xs text-gray-400">The club will be seeded with this type's default modules, people types and terminology.</p>
        </div>
        <!-- Start from a template org (clone its full config) — create mode, CLUB level -->
        <div v-if="!editId && newOrg.org_level === 'CLUB' && templateOrgs.length" class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Start from a template <span class="text-gray-400 font-normal">(optional)</span></label>
          <Select v-model="newOrg.from_template_id" :options="templateOrgs" option-label="name" option-value="id"
            placeholder="Don't use a template" showClear filter class="w-full" />
          <p v-if="newOrg.from_template_id" class="text-xs text-gray-400">Clones this template's full setup — modules, people types &amp; fields, dashboards, categories, codes, roles. No people or events are copied. Takes precedence over the club type above.</p>
        </div>
        <!-- Mark this org as a reusable template — edit mode -->
        <div v-if="editId" class="flex items-center justify-between gap-3 pt-1">
          <div>
            <label class="text-sm font-medium">Reusable setup template</label>
            <p class="text-xs text-gray-400">New clubs can be created as a clone of this org's config.</p>
          </div>
          <ToggleSwitch v-model="newOrg.is_template" />
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
        <Button :label="editId ? 'Save' : 'Create'" :loading="creating" style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="createOrg" />
      </template>
    </Dialog>

    <!-- Delete organisation — type-to-confirm -->
    <Dialog :visible="!!deleteTarget" modal header="Delete organisation" :style="{ width: '95vw', maxWidth: '30rem' }"
      @update:visible="v => { if (!v) deleteTarget = null }">
      <div v-if="deleteTarget" class="flex flex-col gap-3">
        <div class="flex items-start gap-2.5 rounded-lg bg-red-50 border border-red-100 p-3">
          <i class="pi pi-exclamation-triangle text-red-500 mt-0.5" />
          <p class="text-sm text-red-700">This permanently deletes <span class="font-semibold">{{ deleteTarget.name }}</span> and all of its data (members, groups, events, bookings, etc.). Any child organisations become top-level. This cannot be undone.</p>
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Type <span class="font-semibold">{{ deleteTarget.name }}</span> to confirm</label>
          <InputText v-model="deleteConfirm" :placeholder="deleteTarget.name" autofocus @keyup.enter="canDelete && deleteOrg()" />
        </div>
        <p v-if="deleteError" class="text-xs text-red-600">{{ deleteError }}</p>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="deleteTarget = null" />
        <Button label="Delete organisation" severity="danger" :loading="deleting" :disabled="!canDelete" @click="deleteOrg" />
      </template>
    </Dialog>

    <Toast />
  </div>
</template>
