<!--
  Settings → Locations (migration 237). The club's operational SITES — distinct
  from booking venues. Each location card: name/address/colour + the STAFF
  assigned there (a person can be at several locations, with a role per site)
  + top-level counts (classes, staff) so the club sees its footprint per site.
  Classes attach on /groups/:id (Edit dialog → Location, shown when 2+ sites).
-->
<script setup lang="ts">
import type { ClubLocation, LocationStaff } from '~/composables/useLocations'
import { LOCATION_STAFF_ROLES } from '~/composables/useLocations'

const db = useDb()
const { orgId } = useOrg()
const toast = useToast()
const loc = useLocations()
const { ensureTerms, t } = useTerms()
void ensureTerms()

const loading = ref(true)
const locations = ref<ClubLocation[]>([])
const staff = ref<LocationStaff[]>([])
const sports = ref<{ id: string; label: string }[]>([])
const sportOptions = computed(() => [{ label: 'All sports', value: null as string | null }, ...sports.value.map(sp => ({ label: sp.label, value: sp.id as string | null }))])
function sportLabel(id: string | null) { return id ? (sports.value.find(sp => sp.id === id)?.label ?? 'Sport') : null }
const classCounts = ref<Record<string, number>>({})

const PALETTE = ['#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#06B6D4']

async function load() {
  if (!orgId.value) return
  loading.value = true
  const [locs, ls, { data: groups }, { data: sp }] = await Promise.all([
    loc.loadLocations(),
    loc.loadLocationStaff(),
    (db.from as any)('member_groups').select('id, location_id').eq('org_id', orgId.value).not('location_id', 'is', null),
    (db.from as any)('org_sports').select('id, sport, display_name').eq('org_id', orgId.value).order('sort_order'),
  ])
  sports.value = (sp ?? []).map((x: any) => ({ id: x.id, label: x.display_name || x.sport }))
  locations.value = locs
  staff.value = ls
  const counts: Record<string, number> = {}
  for (const g of (groups ?? [])) counts[g.location_id] = (counts[g.location_id] || 0) + 1
  classCounts.value = counts
  loading.value = false
}

function staffFor(locationId: string) {
  return staff.value.filter(s => s.location_id === locationId)
}
function personName(s: LocationStaff) {
  return `${s.person?.first_name ?? ''} ${s.person?.last_name ?? ''}`.trim() || s.person?.email || '—'
}
function roleLabel(key: string) {
  return LOCATION_STAFF_ROLES.find(r => r.key === key)?.label ?? key
}

async function addLocation() {
  const l = await loc.createLocation({ name: 'New location', color: PALETTE[locations.value.length % PALETTE.length], sort_order: locations.value.length })
  if (l) locations.value.push(l)
}
async function saveLocation(l: ClubLocation) {
  if (!l.name.trim()) return
  await loc.updateLocation(l.id, { name: l.name.trim(), address: l.address, color: l.color })
}
async function removeLocation(l: ClubLocation) {
  const classes = classCounts.value[l.id] ?? 0
  const msg = classes
    ? `Delete "${l.name}"? Its ${classes} ${classes === 1 ? t('group', false, true) : t('group', true, true)} keep running with no location.`
    : `Delete "${l.name}"?`
  if (!window.confirm(msg)) return
  await loc.deleteLocation(l.id)
  locations.value = locations.value.filter(x => x.id !== l.id)
}

// ── Assign staff: person search per location ──
const pick = reactive<Record<string, any>>({})
const pickRole = reactive<Record<string, string>>({})
const pickSport = reactive<Record<string, string | null>>({})
const suggestions = ref<{ id: string; label: string }[]>([])
async function searchPeople(e: { query: string }) {
  const q = (e.query ?? '').trim()
  if (!q) { suggestions.value = []; return }
  const { data } = await (db.from as any)('persons')
    .select('id, first_name, last_name, email')
    .eq('org_id', orgId.value)
    .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
    .limit(10)
  suggestions.value = (data ?? []).map((p: any) => ({ id: p.id, label: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || p.email || '—' }))
}
async function addStaff(l: ClubLocation | null, person: { id: string }) {
  if (!person?.id) return
  const key = l?.id ?? '__all'
  await loc.assignStaff(l?.id ?? null, person.id, pickRole[key] || 'staff', pickSport[key] ?? null)
  pick[key] = null
  staff.value = await loc.loadLocationStaff()
  toast.add({ severity: 'success', summary: 'Access granted', life: 2000 })
}
const clubWideGrants = computed(() => staff.value.filter(g => g.location_id === null))
async function removeStaffRow(s: LocationStaff) {
  await loc.removeStaff(s.id)
  staff.value = staff.value.filter(x => x.id !== s.id)
}

onMounted(load)
watch(orgId, v => { if (v) load() })
</script>

<template>
  <div class="p-3 sm:p-6 min-h-full flex flex-col">
    <div class="flex flex-col md:flex-row gap-4 md:gap-6 flex-1 min-h-0">
      <SettingsNav />
      <div class="flex-1 min-w-0 space-y-5">
        <div>
          <h1 class="text-lg sm:text-2xl font-semibold text-gray-900">Locations</h1>
          <p class="text-sm text-gray-500">The sites your club runs at. Assign staff to one or more locations — {{ t('group', true, true) }} attach to a location on their own page. With a single location, none of this appears elsewhere.</p>
        </div>

        <div v-if="loading" class="text-sm text-gray-400">Loading…</div>

        <template v-else>
          <div v-for="l in locations" :key="l.id" class="card p-0 overflow-hidden">
            <!-- Location header: colour + name + address + counts + delete -->
            <div class="flex flex-col sm:flex-row sm:items-center gap-2 px-4 sm:px-5 py-3 border-b border-gray-100">
              <div class="flex items-center gap-2.5 flex-1 min-w-0">
                <input type="color" :value="l.color || '#94A3B8'" class="w-7 h-7 rounded cursor-pointer border-0 bg-transparent p-0 shrink-0" title="Location colour"
                  @input="(e: Event) => { l.color = (e.target as HTMLInputElement).value; saveLocation(l) }" />
                <input v-model="l.name" @change="saveLocation(l)" placeholder="Location name"
                  class="text-base font-semibold text-gray-900 bg-transparent border border-transparent hover:border-gray-200 focus:border-[#1E2157] focus:bg-white focus:ring-1 focus:ring-[#1E2157] rounded-md px-1.5 -mx-1.5 py-0.5 outline-none transition-colors min-w-0 flex-1 sm:flex-none sm:w-64" />
                <input v-model="l.address" @change="saveLocation(l)" placeholder="Address (optional)"
                  class="hidden sm:block text-sm text-gray-500 bg-transparent border border-transparent hover:border-gray-200 focus:border-[#1E2157] focus:bg-white focus:ring-1 focus:ring-[#1E2157] rounded-md px-1.5 py-0.5 outline-none transition-colors flex-1 min-w-0" />
              </div>
              <div class="flex items-center gap-3 shrink-0">
                <span class="text-xs text-gray-400">{{ classCounts[l.id] ?? 0 }} {{ (classCounts[l.id] ?? 0) === 1 ? t('group', false, true) : t('group', true, true) }} · {{ staffFor(l.id).length }} staff</span>
                <button type="button" class="text-gray-300 hover:text-red-500" title="Delete this location" @click="removeLocation(l)"><i class="pi pi-times-circle text-sm" /></button>
              </div>
            </div>
            <!-- Staff at this location -->
            <div class="px-4 sm:px-5 py-3 space-y-1.5">
              <div v-for="s in staffFor(l.id)" :key="s.id" class="flex items-center gap-2.5">
                <span class="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-[9px] font-bold inline-flex items-center justify-center shrink-0">{{ personName(s).split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() }}</span>
                <NuxtLink :to="`/people/${s.person_id}`" class="text-sm text-primary hover:underline truncate">{{ personName(s) }}</NuxtLink>
                <span class="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{{ roleLabel(s.role_key) }}</span>
                <span class="text-[11px] px-2 py-0.5 rounded-full font-medium" :class="s.sport_id ? 'bg-sky-50 text-sky-700' : 'bg-gray-100 text-gray-500'">{{ sportLabel(s.sport_id) ?? 'All sports' }}</span>
                <button type="button" class="ml-auto text-gray-300 hover:text-red-500" :title="`Remove ${personName(s)} from ${l.name}`" @click="removeStaffRow(s)"><i class="pi pi-times-circle text-sm" /></button>
              </div>
              <p v-if="!staffFor(l.id).length" class="text-sm text-gray-400">No staff assigned to this location yet.</p>
              <div class="flex flex-wrap items-center gap-2 pt-1">
                <AutoComplete :model-value="pick[l.id]" @update:model-value="(v: any) => pick[l.id] = v"
                  :suggestions="suggestions" optionLabel="label" placeholder="Add a staff member…"
                  class="flex-1 min-w-0 max-w-xs" @complete="searchPeople"
                  :pt="{ pcInputText: { root: { class: '!py-1.5 !px-2.5 !text-sm w-full' } } }"
                  @item-select="(e: any) => addStaff(l, e.value)" />
                <Select :model-value="pickRole[l.id] || 'staff'" @update:model-value="(v: string) => pickRole[l.id] = v"
                  :options="LOCATION_STAFF_ROLES" optionLabel="label" optionValue="key" size="small" class="w-40" />
                <Select v-if="sports.length > 1" :model-value="pickSport[l.id] ?? null" @update:model-value="(v: string | null) => pickSport[l.id] = v"
                  :options="sportOptions" optionLabel="label" optionValue="value" size="small" class="w-40" />
              </div>
            </div>
          </div>

          <div v-if="locations.length > 1" class="card p-0 overflow-hidden">
            <div class="px-4 sm:px-5 py-3 border-b border-gray-100">
              <h3 class="text-sm font-semibold text-gray-800">Club-wide access <span class="text-xs font-normal text-gray-400">— every location</span></h3>
              <p class="text-xs text-gray-400 mt-0.5">Grants that apply at all locations — optionally limited to one sport (e.g. "gymnastics everywhere").</p>
            </div>
            <div class="px-4 sm:px-5 py-3 space-y-1.5">
              <div v-for="s2 in clubWideGrants" :key="s2.id" class="flex items-center gap-2.5">
                <span class="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-[9px] font-bold inline-flex items-center justify-center shrink-0">{{ personName(s2).split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() }}</span>
                <NuxtLink :to="`/people/${s2.person_id}`" class="text-sm text-primary hover:underline truncate">{{ personName(s2) }}</NuxtLink>
                <span class="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{{ roleLabel(s2.role_key) }}</span>
                <span class="text-[11px] px-2 py-0.5 rounded-full font-medium" :class="s2.sport_id ? 'bg-sky-50 text-sky-700' : 'bg-gray-100 text-gray-500'">{{ sportLabel(s2.sport_id) ?? 'All sports' }}</span>
                <button type="button" class="ml-auto text-gray-300 hover:text-red-500" title="Remove this grant" @click="removeStaffRow(s2)"><i class="pi pi-times-circle text-sm" /></button>
              </div>
              <p v-if="!clubWideGrants.length" class="text-sm text-gray-400">No club-wide grants.</p>
              <div class="flex flex-wrap items-center gap-2 pt-1">
                <AutoComplete :model-value="pick['__all']" @update:model-value="(v: any) => pick['__all'] = v"
                  :suggestions="suggestions" optionLabel="label" placeholder="Add a staff member…"
                  class="flex-1 min-w-0 max-w-xs" @complete="searchPeople"
                  :pt="{ pcInputText: { root: { class: '!py-1.5 !px-2.5 !text-sm w-full' } } }"
                  @item-select="(e: any) => addStaff(null, e.value)" />
                <Select :model-value="pickRole['__all'] || 'staff'" @update:model-value="(v: string) => pickRole['__all'] = v"
                  :options="LOCATION_STAFF_ROLES" optionLabel="label" optionValue="key" size="small" class="w-40" />
                <Select v-if="sports.length" :model-value="pickSport['__all'] ?? null" @update:model-value="(v: string | null) => pickSport['__all'] = v"
                  :options="sportOptions" optionLabel="label" optionValue="value" size="small" class="w-40" />
              </div>
            </div>
          </div>

          <p v-if="!locations.length" class="text-sm text-gray-400">No locations yet — single-site clubs don't need any.</p>
          <button type="button" class="text-sm text-primary hover:underline" @click="addLocation">+ Add location</button>
        </template>
      </div>
    </div>
    <Toast />
  </div>
</template>
