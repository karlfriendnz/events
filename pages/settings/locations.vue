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

const { orgId } = useOrg()
const toast = useToast()
const loc = useLocations()
const orgsApi = useOrganisationsApi()
const groupsApi = useGroupsApi()
const peopleApi = usePeopleApi()
const affApi = useAffiliationsApi()
const { ensureTerms, t } = useTerms()
void ensureTerms()

const loading = ref(true)
const orgLevel = ref<string | null>(null)
const locations = ref<ClubLocation[]>([])
const staff = ref<LocationStaff[]>([])
const sports = ref<{ id: string; label: string }[]>([])
// Roles come from the club's own staff-role catalogue (code_role_defs org-wide
// defaults — Manager, Coach + any custom roles), managed with their permission
// matrix at /groups/codes/default-roles. No parallel role vocabulary here.
const cr = useCodeRoles()
const roleDefs = ref<{ key: string; label: string }[]>([])
const roleOptions = computed(() => roleDefs.value.map(r => ({ label: r.label, value: r.key })))
function roleLabel2(key: string) {
  return roleDefs.value.find(r => r.key === key)?.label
    ?? LOCATION_STAFF_ROLES.find(r => r.key === key)?.label
    ?? key
}
async function setStaffRole(s2: LocationStaff, roleKey: string) {
  await loc.updateStaff(s2.id, { role_key: roleKey })
  s2.role_key = roleKey
}
const sportOptions = computed(() => [{ label: 'All sports', value: null as string | null }, ...sports.value.map(sp => ({ label: sp.label, value: sp.id as string | null }))])
function sportLabel(id: string | null) { return id ? (sports.value.find(sp => sp.id === id)?.label ?? 'Sport') : null }
const classCounts = ref<Record<string, number>>({})
// People who get access to a site AUTOMATICALLY via their class staff roles —
// shown as an informational count so nobody re-enters coaches here.
const derivedCounts = ref<Record<string, number>>({})
const scoped = useScopedRoles()

function cap(v: string) { return v.charAt(0).toUpperCase() + v.slice(1) }
const PALETTE = ['#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#06B6D4']

async function load() {
  if (!orgId.value) return
  loading.value = true
  const [locs, ls, groups, sp, o] = await Promise.all([
    loc.loadLocations(),
    loc.loadLocationStaff(),
    groupsApi.list(orgId.value),
    affApi.orgSports(orgId.value),
    orgsApi.get(orgId.value),
  ])
  orgLevel.value = o?.orgLevel ?? null
  sports.value = sp.map(x => ({ id: x.id, label: x.displayName || x.sport }))
  const defs = await cr.ensureDefaults()
  roleDefs.value = defs.filter((d: any) => !d.code_lineage_id).map((d: any) => ({ key: d.key, label: d.label }))
  locations.value = locs
  staff.value = ls
  // CROSS-DOMAIN GAP: MemberGroup contract exposes locationIds[] but not the singular
  // member_groups.location_id this count is keyed on. Reading (g as any).locationId so
  // the count restores automatically once the groups projection adds it.
  const counts: Record<string, number> = {}
  for (const g of groups) { const lid = (g as any).locationId; if (lid) counts[lid] = (counts[lid] || 0) + 1 }
  classCounts.value = counts
  // Staff who already have site access through a class staff role. membershipsByOrg
  // carries locationId; CROSS-DOMAIN GAP: it does NOT carry roles/role yet, so the
  // isStaff filter can't run — derivedCounts stays empty until the groups projection
  // adds roles (reading via (m as any) so it restores automatically then).
  const mships = await groupsApi.membershipsByOrg(orgId.value)
  const perLoc: Record<string, Set<string>> = {}
  for (const m of mships) {
    const raw = (m as any).roles
    const roles = ((raw?.length ? raw : [(m as any).role]) as string[]).filter(Boolean)
    if (!m.locationId || !roles.length || !scoped.isStaff('group', roles)) continue
    ;(perLoc[m.locationId] ??= new Set()).add(m.personId)
  }
  derivedCounts.value = Object.fromEntries(Object.entries(perLoc).map(([k, v]) => [k, v.size]))
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
// Type-to-confirm delete: you must type the location's name exactly.
const deleteTarget = ref<ClubLocation | null>(null)
const deleteTyped = ref('')
const deleteMatches = computed(() =>
  deleteTyped.value.trim().toLowerCase() === (deleteTarget.value?.name ?? '').trim().toLowerCase() && !!deleteTarget.value)
function removeLocation(l: ClubLocation) {
  deleteTarget.value = l
  deleteTyped.value = ''
}
async function confirmDeleteLocation() {
  if (!deleteMatches.value || !deleteTarget.value) return
  await loc.deleteLocation(deleteTarget.value.id)
  locations.value = locations.value.filter(x => x.id !== deleteTarget.value!.id)
  deleteTarget.value = null
}

// ── Assign staff: person search per location ──
const pick = reactive<Record<string, any>>({})
const pickRole = reactive<Record<string, string>>({})
const pickSport = reactive<Record<string, string | null>>({})
const suggestions = ref<{ id: string; label: string }[]>([])
async function searchPeople(e: { query: string }) {
  const q = (e.query ?? '').trim()
  if (!q || !orgId.value) { suggestions.value = []; return }
  const people = await peopleApi.list(orgId.value, { q, limit: 10 })
  suggestions.value = people.map(p => ({ id: p.id, label: `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || p.email || '—' }))
}
// Picking a person only STAGES them — the explicit Add button commits, so the
// sport/role can be chosen in any order before anything is written.
async function addStaff(l: ClubLocation | null) {
  const key = l?.id ?? '__all'
  const person = pick[key]
  if (!person?.id) return
  await loc.assignStaff(l?.id ?? null, person.id, pickRole[key] || roleDefs.value[0]?.key || 'staff', pickSport[key] ?? null)
  pick[key] = null
  staff.value = await loc.loadLocationStaff()
  toast.add({ severity: 'success', summary: 'Access granted', life: 2000 })
}
async function setStaffSport(s2: LocationStaff, sportId: string | null) {
  await loc.updateStaff(s2.id, { sport_id: sportId })
  s2.sport_id = sportId
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
          <h1 class="text-lg sm:text-2xl font-semibold text-gray-900">Sports &amp; locations</h1>
          <p class="text-sm text-gray-500">Your sports, who you're affiliated to, and the sites you run at.</p>
        </div>

        <div v-if="loading" class="text-sm text-gray-400">Loading…</div>

        <template v-else>
          <!-- Sports & affiliation (clubs) — governing-body links per sport -->
          <section v-if="orgLevel === 'CLUB'" class="space-y-2">
            <h2 class="text-sm font-bold uppercase tracking-wide text-gray-400">Sports &amp; affiliation</h2>
            <OrgSportsEditor />
          </section>

          <!-- Locations -->
          <section class="space-y-4">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h2 class="text-sm font-bold uppercase tracking-wide text-gray-400">Locations</h2>
                <p class="text-xs text-gray-400 mt-0.5 max-w-2xl">The sites you run at. {{ cap(t('group', false, true)) }} staff get site access automatically — add people here only for access <em>beyond</em> their {{ t('group', true, true) }} (location managers, admin, whole-sport cover).</p>
              </div>
              <Button label="Add location" icon="pi pi-plus" size="small" class="shrink-0"
                style="background:#1E2157;border-color:#1E2157" @click="addLocation" />
            </div>
          <div v-if="locations.length > 1" class="card p-0 overflow-hidden">
            <div class="px-4 sm:px-5 py-3 border-b border-gray-100">
              <h3 class="text-sm font-semibold text-gray-800">Club-wide access <span class="text-xs font-normal text-gray-400">— every location</span></h3>
              <p class="text-xs text-gray-400 mt-0.5">Grants that apply at all locations — optionally limited to one sport (e.g. "gymnastics everywhere").</p>
            </div>
            <div class="px-4 sm:px-5 py-3 space-y-3">
              <div class="rounded-lg border border-gray-200 overflow-x-auto">
                <table class="w-full text-sm">
                  <colgroup><col class="w-72" /><col class="w-44" /><col class="w-44" /><col /><col class="w-12" /></colgroup>
                  <thead>
                    <tr class="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <th class="px-4 py-2.5 font-semibold">Person</th>
                      <th class="px-3 py-2.5 font-semibold">Role</th>
                      <th class="px-3 py-2.5 font-semibold">Sport</th>
                      <th />
                      <th class="px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    <tr v-for="s2 in clubWideGrants" :key="s2.id" class="hover:bg-gray-50">
                      <td class="px-4 py-2">
                        <span class="flex items-center gap-2.5">
                          <span class="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-[9px] font-bold inline-flex items-center justify-center shrink-0">{{ personName(s2).split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() }}</span>
                          <NuxtLink :to="`/people/${s2.person_id}`" class="text-sm text-primary hover:underline truncate">{{ personName(s2) }}</NuxtLink>
                        </span>
                      </td>
                      <td class="px-3 py-2">
                        <Select :model-value="s2.role_key" @update:model-value="(v: string) => setStaffRole(s2, v)"
                          :options="roleOptions" optionLabel="label" optionValue="value" size="small" class="w-full" />
                      </td>
                      <td class="px-3 py-2">
                        <Select v-if="sports.length > 1" :model-value="s2.sport_id" @update:model-value="(v: string | null) => setStaffSport(s2, v)"
                          :options="sportOptions" optionLabel="label" optionValue="value" size="small" class="w-full" />
                        <span v-else class="text-[11px] px-2 py-0.5 rounded-full font-medium" :class="s2.sport_id ? 'bg-sky-50 text-sky-700' : 'bg-gray-100 text-gray-500'">{{ sportLabel(s2.sport_id) ?? 'All sports' }}</span>
                      </td>
                      <td />
                      <td class="px-3 py-2 text-right">
                        <button type="button" class="text-gray-300 hover:text-red-500" title="Remove this grant" @click="removeStaffRow(s2)"><i class="pi pi-times-circle text-sm" /></button>
                      </td>
                    </tr>
                    <!-- Add row — part of the table so it lines up with the columns -->
                    <tr class="bg-gray-50/60">
                      <td class="px-4 py-2">
                        <AutoComplete :model-value="pick['__all']" @update:model-value="(v: any) => pick['__all'] = v"
                          :suggestions="suggestions" optionLabel="label" placeholder="Add a staff member…"
                          class="w-full" @complete="searchPeople"
                          :pt="{ pcInputText: { root: { class: '!py-1.5 !px-2.5 !text-sm w-full' } } }"
                          @item-select="(e: any) => pick['__all'] = e.value" />
                      </td>
                      <td class="px-3 py-2">
                        <Select :model-value="pickRole['__all'] || 'staff'" @update:model-value="(v: string) => pickRole['__all'] = v"
                          :options="roleOptions" optionLabel="label" optionValue="value" size="small" placeholder="Role" class="w-full" />
                      </td>
                      <td class="px-3 py-2">
                        <Select v-if="sports.length > 1" :model-value="pickSport['__all'] ?? null" @update:model-value="(v: string | null) => pickSport['__all'] = v"
                          :options="sportOptions" optionLabel="label" optionValue="value" size="small" class="w-full" />
                      </td>
                      <td />
                      <td class="px-3 py-2 text-right">
                        <Button label="Add" size="small" :disabled="!pick['__all']?.id" style="background:#1E2157;border-color:#1E2157" @click="addStaff(null)" />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

            </div>
          </div>


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
            <div class="px-4 sm:px-5 py-3 space-y-3">
              <div class="rounded-lg border border-gray-200 overflow-x-auto">
                <table class="w-full text-sm">
                  <colgroup><col class="w-72" /><col class="w-44" /><col class="w-44" /><col /><col class="w-12" /></colgroup>
                  <thead>
                    <tr class="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <th class="px-4 py-2.5 font-semibold">Person</th>
                      <th class="px-3 py-2.5 font-semibold">Role</th>
                      <th class="px-3 py-2.5 font-semibold">Sport</th>
                      <th />
                      <th class="px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    <tr v-for="s in staffFor(l.id)" :key="s.id" class="hover:bg-gray-50">
                      <td class="px-4 py-2">
                        <span class="flex items-center gap-2.5">
                          <span class="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-[9px] font-bold inline-flex items-center justify-center shrink-0">{{ personName(s).split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() }}</span>
                          <NuxtLink :to="`/people/${s.person_id}`" class="text-sm text-primary hover:underline truncate">{{ personName(s) }}</NuxtLink>
                        </span>
                      </td>
                      <td class="px-3 py-2">
                        <Select :model-value="s.role_key" @update:model-value="(v: string) => setStaffRole(s, v)"
                          :options="roleOptions" optionLabel="label" optionValue="value" size="small" class="w-full" />
                      </td>
                      <td class="px-3 py-2">
                        <Select v-if="sports.length > 1" :model-value="s.sport_id" @update:model-value="(v: string | null) => setStaffSport(s, v)"
                          :options="sportOptions" optionLabel="label" optionValue="value" size="small" class="w-full" />
                        <span v-else class="text-[11px] px-2 py-0.5 rounded-full font-medium" :class="s.sport_id ? 'bg-sky-50 text-sky-700' : 'bg-gray-100 text-gray-500'">{{ sportLabel(s.sport_id) ?? 'All sports' }}</span>
                      </td>
                      <td />
                      <td class="px-3 py-2 text-right">
                        <button type="button" class="text-gray-300 hover:text-red-500" :title="`Remove ${personName(s)} from ${l.name}`" @click="removeStaffRow(s)"><i class="pi pi-times-circle text-sm" /></button>
                      </td>
                    </tr>
                    <!-- Add row — part of the table so it lines up with the columns -->
                    <tr class="bg-gray-50/60">
                      <td class="px-4 py-2">
                        <AutoComplete :model-value="pick[l.id]" @update:model-value="(v: any) => pick[l.id] = v"
                          :suggestions="suggestions" optionLabel="label" placeholder="Add a staff member…"
                          class="w-full" @complete="searchPeople"
                          :pt="{ pcInputText: { root: { class: '!py-1.5 !px-2.5 !text-sm w-full' } } }"
                          @item-select="(e: any) => pick[l.id] = e.value" />
                      </td>
                      <td class="px-3 py-2">
                        <Select :model-value="pickRole[l.id] || 'staff'" @update:model-value="(v: string) => pickRole[l.id] = v"
                          :options="roleOptions" optionLabel="label" optionValue="value" size="small" placeholder="Role" class="w-full" />
                      </td>
                      <td class="px-3 py-2">
                        <Select v-if="sports.length > 1" :model-value="pickSport[l.id] ?? null" @update:model-value="(v: string | null) => pickSport[l.id] = v"
                          :options="sportOptions" optionLabel="label" optionValue="value" size="small" class="w-full" />
                      </td>
                      <td />
                      <td class="px-3 py-2 text-right">
                        <Button label="Add" size="small" :disabled="!pick[l.id]?.id" style="background:#1E2157;border-color:#1E2157" @click="addStaff(l)" />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p v-if="derivedCounts[l.id]" class="text-xs text-gray-400">
                <i class="pi pi-check-circle text-emerald-500 mr-1" />{{ derivedCounts[l.id] }} {{ t('group', false, true) }} staff already have access here through their {{ t('group', true, true) }} — they don't need a row above.
              </p>
            </div>
          </div>

          <p v-if="!locations.length" class="text-sm text-gray-400">No locations yet — single-site clubs don't need any.</p>
          </section>
        </template>
      </div>
    </div>
    <!-- Type-to-confirm location delete -->
    <Dialog :visible="!!deleteTarget" modal :style="{ width: '95vw', maxWidth: '440px' }"
      :header="`Delete ${deleteTarget?.name ?? ''}`" @update:visible="(v: boolean) => { if (!v) deleteTarget = null }">
      <div class="space-y-3">
        <p class="text-sm text-gray-600">
          This removes the location and all its staff assignments.
          <template v-if="deleteTarget && (classCounts[deleteTarget.id] ?? 0) > 0">
            Its <b class="font-semibold">{{ classCounts[deleteTarget.id] }} {{ (classCounts[deleteTarget.id] ?? 0) === 1 ? t('group', false, true) : t('group', true, true) }}</b> keep running with no location.
          </template>
        </p>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium text-gray-700">Type <b class="font-semibold">{{ deleteTarget?.name }}</b> to confirm</label>
          <InputText v-model="deleteTyped" :placeholder="deleteTarget?.name" class="w-full" autofocus />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" text @click="deleteTarget = null" />
        <Button label="Delete location" severity="danger" :disabled="!deleteMatches" @click="confirmDeleteLocation" />
      </template>
    </Dialog>
    <Toast />
  </div>
</template>
