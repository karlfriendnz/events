<!--
  Club-type SETUP TEMPLATE editor (full page — replaces the cramped modal). Edits
  one club type's defaults: modules, person types (each with its Permissions, Menu
  and Landing), and terminology. The 'Overall default' template (is_overall_default)
  is edited here too. Seeds a new club created with this type; existing clubs aren't
  changed. Super-admin only (admin layout).
-->
<script setup lang="ts">
definePageMeta({ layout: 'admin' })
const api = useAdminApi()
const route = useRoute()
const toast = useToast()
const typeId = computed(() => String(route.params.id))

const { MODULE_DEFS } = useOrgModules()
const { TERM_DEFS } = useTerminology()
const { CLUB_MENU: MENU } = useClubMenu()
const { loadDefaults, saveDefaults } = useClubTypes()

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
const LANDING = [
  { label: 'Dashboard', value: null as string | null }, { label: 'Classes', value: '/groups' },
  { label: 'Events', value: '/events' }, { label: 'People', value: '/people' },
  { label: 'Memberships', value: '/memberships' }, { label: 'Bookings', value: '/bookables?tab=bookings' },
  { label: 'Attendance', value: '/attendance' }, { label: 'My profile & contacts', value: '/account/profiles' },
]

const typeName = ref('')
const isOverall = ref(false)
const loading = ref(true)
const saving = ref(false)
const modOn = reactive<Record<string, boolean>>({})
const dPersonTypes = ref<any[]>([])
const dTerm = reactive<Record<string, { singular?: string; plural?: string }>>({})
const newTypeLabel = ref('')
const configIdx = ref<number | null>(null)

useBreadcrumbs([{ label: 'Master', to: '/admin/master' }, { label: () => typeName.value || 'Defaults' } as any])

onMounted(load)
async function load() {
  loading.value = true
  const row = await api.getClubType(typeId.value).catch(() => null)
  typeName.value = row?.name ?? 'Club type'
  isOverall.value = !!row?.isOverallDefault
  const d = await loadDefaults(typeId.value)
  for (const m of MODULE_DEFS) modOn[m.key] = d.default_modules === null ? true : (m.core || d.default_modules.includes(m.key))
  dPersonTypes.value = (d.default_person_types ?? []).map((p: any) => ({ key: p.key, label: p.label, is_access: !!p.is_access, permissions: p.permissions ?? {}, menu_items: p.menu_items ?? null, landing_path: p.landing_path ?? null }))
  for (const k of Object.keys(dTerm)) delete dTerm[k]
  Object.assign(dTerm, d.default_terminology ?? {})
  loading.value = false
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
function removePersonType(i: number) { dPersonTypes.value.splice(i, 1); if (configIdx.value === i) configIdx.value = null }
function toggleConfig(i: number) { configIdx.value = configIdx.value === i ? null : i }
function menuOn(p: any, href: string) { return Array.isArray(p.menu_items) ? p.menu_items.includes(href) : false }
function toggleMenu(p: any, href: string, on: boolean) {
  const base = Array.isArray(p.menu_items) ? [...p.menu_items] : []
  p.menu_items = on ? [...new Set([...base, href])] : base.filter((h: string) => h !== href)
}
function setTypeMenuCustom(p: any, on: boolean) { p.menu_items = on ? MENU.map(m => m.href) : null }
function setTerm(key: string, which: 'singular' | 'plural', v: string) { (dTerm[key] ||= {})[which] = v }
// Edit this type's starting dashboard in the real builder (master mode). Save the
// template first, then switch to the SANDBOX club so the preview never shows a real
// club — the dashboard restores the current club on the way back.
async function editDashboard(p: any) {
  await save()
  const sandboxId = await api.sandboxOrgId()
  if (sandboxId && import.meta.client) { sessionStorage.setItem('fm_tpl_return_org', readActiveOrg() || ''); persistActiveOrg(sandboxId) }
  window.location.href = `/dashboard?editTemplate=${p.key}&clubType=${typeId.value}`
}

async function save() {
  saving.value = true
  const modules = MODULE_DEFS.filter(m => !m.core && modOn[m.key]).map(m => m.key)
  const term: Record<string, { singular?: string; plural?: string }> = {}
  for (const def of TERM_DEFS) {
    const ov = dTerm[def.key] || {}; const out: any = {}
    if (ov.singular?.trim() && ov.singular.trim() !== def.singular) out.singular = ov.singular.trim()
    if (ov.plural?.trim() && ov.plural.trim() !== def.plural) out.plural = ov.plural.trim()
    if (Object.keys(out).length) term[def.key] = out
  }
  const types = dPersonTypes.value.filter(p => p.key && p.label.trim())
    .map(p => ({ key: p.key, label: p.label.trim(), is_access: p.is_access, permissions: p.permissions ?? {}, menu_items: p.menu_items ?? null, landing_path: p.landing_path ?? null }))
  await saveDefaults(typeId.value, {
    default_modules: modules,
    default_person_types: types.length ? types : null,
    default_terminology: Object.keys(term).length ? term : null,
  })
  saving.value = false
  toast.add({ severity: 'success', summary: 'Template saved', life: 1800 })
}
</script>

<template>
  <div class="p-3 sm:p-6 max-w-5xl mx-auto">
    <div class="flex items-center justify-between gap-3 mb-1">
      <div>
        <NuxtLink to="/admin/master" class="text-sm text-gray-500 hover:text-primary inline-flex items-center gap-1"><i class="pi pi-arrow-left text-xs" /> Master</NuxtLink>
        <h1 class="text-lg sm:text-2xl font-semibold text-gray-900 mt-1 flex items-center gap-2">
          <i v-if="isOverall" class="pi pi-star-fill text-primary text-base" />{{ typeName }}<span class="text-sm text-gray-400 font-normal">— setup template</span>
        </h1>
      </div>
      <Button label="Save template" :loading="saving" style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="save" />
    </div>
    <p class="text-sm text-gray-500 mb-5">{{ isOverall ? 'Applies to every new club — the base each club type extends.' : 'Seeds a new club created with this type (on top of the overall default). Existing clubs aren\'t changed.' }}</p>

    <div v-if="loading" class="text-sm text-gray-400">Loading…</div>
    <div v-else class="space-y-5">
      <!-- Modules -->
      <div class="card p-5">
        <h3 class="text-sm font-semibold text-gray-800 mb-3">Modules</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1">
          <label v-for="m in MODULE_DEFS" :key="m.key" class="flex items-center gap-2 py-1.5" :class="m.core ? 'opacity-60' : 'cursor-pointer'">
            <ToggleSwitch v-model="modOn[m.key]" :disabled="m.core" />
            <i class="pi text-gray-400 text-sm" :class="m.icon" />
            <span class="text-sm text-gray-700">{{ m.label }}<span v-if="m.core" class="text-gray-400"> · always on</span></span>
          </label>
        </div>
      </div>

      <!-- People types -->
      <div class="card p-5">
        <div class="flex items-center justify-between mb-1">
          <h3 class="text-sm font-semibold text-gray-800">People types</h3>
          <button type="button" class="text-xs text-primary hover:underline" @click="addStandardTypes">+ Add standard set</button>
        </div>
        <p class="text-xs text-gray-400 mb-3">Each type's Permissions, Menu and Landing seed a new club — its starting point.</p>
        <div class="space-y-2">
          <div v-for="(p, i) in dPersonTypes" :key="i" class="rounded-lg border border-gray-100">
            <div class="flex items-center gap-2 px-2.5 py-2">
              <InputText v-model="p.label" class="flex-1" size="small" />
              <label class="flex items-center gap-1.5 text-xs text-gray-500 shrink-0" v-tooltip.top="'Grants access (manages the whole club)'">
                <Checkbox v-model="p.is_access" :binary="true" /> Access
              </label>
              <button type="button" class="text-xs shrink-0 px-2.5 py-1 rounded" :class="configIdx === i ? 'bg-primary/10 text-primary' : 'text-gray-400 hover:text-primary'" @click="toggleConfig(i)">
                <i class="pi text-[10px] mr-1" :class="configIdx === i ? 'pi-chevron-down' : 'pi-cog'" />Configure
              </button>
              <button type="button" class="text-gray-300 hover:text-red-500 w-7 h-7 flex items-center justify-center shrink-0" @click="removePersonType(i)">
                <i class="pi pi-trash text-xs" />
              </button>
            </div>
            <div v-if="configIdx === i" class="border-t border-gray-100 p-4 space-y-4 bg-gray-50/50">
              <div class="flex items-center gap-3">
                <span class="text-xs font-medium text-gray-500 w-24 shrink-0">Landing page</span>
                <Select v-model="p.landing_path" :options="LANDING" optionLabel="label" optionValue="value" class="w-56" size="small" />
              </div>
              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <span class="text-xs font-medium text-gray-500">Custom menu <span class="text-gray-400">(off = decided by permissions)</span></span>
                  <ToggleSwitch :modelValue="Array.isArray(p.menu_items)" @update:modelValue="v => setTypeMenuCustom(p, v)" />
                </div>
                <div v-if="Array.isArray(p.menu_items)" class="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
                  <label v-for="m in MENU" :key="m.href" class="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                    <input type="checkbox" class="accent-primary w-3.5 h-3.5" :checked="menuOn(p, m.href)" @change="toggleMenu(p, m.href, ($event.target as HTMLInputElement).checked)" />
                    {{ m.label }}
                  </label>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <span class="text-xs font-medium text-gray-500 w-24 shrink-0">Dashboard</span>
                <button type="button" class="text-sm text-primary hover:underline inline-flex items-center gap-1" @click="editDashboard(p)">
                  <i class="pi pi-th-large text-[11px]" />Edit starting dashboard →
                </button>
                <span class="text-xs text-gray-400">saves the template first</span>
              </div>
              <div>
                <span class="text-xs font-medium text-gray-500 block mb-1.5">Permissions</span>
                <PermissionGrid v-model="p.permissions" />
              </div>
            </div>
          </div>
          <p v-if="!dPersonTypes.length" class="text-sm text-gray-400">No people types — the club starts empty.</p>
          <div class="flex items-center gap-2 pt-1">
            <InputText v-model="newTypeLabel" placeholder="Add a type e.g. Player" class="flex-1" size="small" @keyup.enter="addPersonType" />
            <Button label="Add" size="small" severity="secondary" outlined @click="addPersonType" />
          </div>
        </div>
      </div>

      <!-- Terminology -->
      <div class="card p-5">
        <h3 class="text-sm font-semibold text-gray-800 mb-1">Terminology</h3>
        <p class="text-xs text-gray-400 mb-3">Blank = keep the default. Rename what this kind of club calls things.</p>
        <div v-for="grp in termGroups" :key="grp.group" class="mb-3">
          <div class="text-xs font-semibold text-gray-500 mb-1.5">{{ grp.group }}</div>
          <div class="space-y-1.5">
            <div v-for="def in grp.defs" :key="def.key" class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
              <span class="text-sm text-gray-600 w-full sm:w-32 shrink-0">{{ def.singular }}</span>
              <InputText :modelValue="dTerm[def.key]?.singular" @update:modelValue="v => setTerm(def.key, 'singular', v)" :placeholder="def.singular" class="flex-1" size="small" />
              <InputText :modelValue="dTerm[def.key]?.plural" @update:modelValue="v => setTerm(def.key, 'plural', v)" :placeholder="def.plural" class="flex-1" size="small" />
            </div>
          </div>
        </div>
      </div>

      <div class="flex justify-end">
        <Button label="Save template" :loading="saving" style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="save" />
      </div>
    </div>
  </div>
</template>
