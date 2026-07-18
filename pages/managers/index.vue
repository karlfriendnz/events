<!--
  Governing-body "Club managers" (migration 249). Only meaningful on non-CLUB orgs
  (NSO / Regional / Association / RST). Two tabs:
   • Club report — cross-club aggregate for whoever holds a 'report' grant (or all
     subtree clubs for an admin / super-admin).
   • Managers — assign people at this org authority over the clubs beneath it
     (subtree by default, or specific clubs) + which capabilities.
-->
<script setup lang="ts">
const { orgId } = useOrg()
const toast = useToast()
const user = useSupabaseUser()
const orgsApi = useOrganisationsApi()
const peopleApi = usePeopleApi()
const eventsApi = useEventsApi()
const groupsApi = useGroupsApi()
const { can, load: loadPerms } = useCan()
const { MANAGER_CAPABILITIES, loadAllOrgs, descendantClubs, loadAssignments, saveAssignment, removeAssignment, myManagedClubs } = useOrgManagers()

useBreadcrumbs([{ label: 'Club managers' }])

const isSuper = computed(() => ((user.value as any)?.app_metadata?.role) === 'super_admin')
const org = ref<{ org_level: string; name: string } | null>(null)
const isGoverning = computed(() => !!org.value && org.value.org_level !== 'CLUB')
const canAssign = computed(() => isSuper.value || can('settings', 'update'))

const tab = ref<'report' | 'managers'>('report')

// All descendant clubs of this governing org (for pickers + admin-wide reporting).
const subtreeClubs = ref<{ id: string; name: string }[]>([])

// ── Reporting ──
const loadingReport = ref(false)
const reportRows = ref<{ id: string; name: string; members: number; events: number; groups: number }[]>([])
const reportScopeNote = ref('')
const totals = computed(() => reportRows.value.reduce((a, r) => ({
  members: a.members + r.members, events: a.events + r.events, groups: a.groups + r.groups,
}), { members: 0, events: 0, groups: 0 }))

async function loadReport() {
  if (!orgId.value) return
  loadingReport.value = true
  // Which clubs? Admin/super → the whole subtree; otherwise the user's granted clubs.
  let clubs: { id: string; name: string }[]
  if (canAssign.value) { clubs = subtreeClubs.value; reportScopeNote.value = `All ${clubs.length} clubs beneath ${org.value?.name ?? 'this organisation'}` }
  else {
    const res = await myManagedClubs(orgId.value, 'report')
    clubs = res.clubs; reportScopeNote.value = `${clubs.length} club${clubs.length === 1 ? '' : 's'} you manage`
  }
  const ids = clubs.map(c => c.id)
  if (!ids.length) { reportRows.value = []; loadingReport.value = false; return }
  // Per-club counts via the seam (members / events / classes). One wave per club —
  // a report page run on demand, admin-scoped, so the fan-out is acceptable.
  const counted = await Promise.all(ids.map(async (id) => {
    const [people, events, groups] = await Promise.all([
      peopleApi.list(id),
      eventsApi.list(id),
      groupsApi.list(id),
    ])
    return { id, members: people.length, events: events.length, groups: groups.length }
  }))
  const byId = new Map(counted.map(c => [c.id, c]))
  reportRows.value = clubs
    .map(c => ({ id: c.id, name: c.name, members: byId.get(c.id)?.members ?? 0, events: byId.get(c.id)?.events ?? 0, groups: byId.get(c.id)?.groups ?? 0 }))
    .sort((a, b) => b.members - a.members || a.name.localeCompare(b.name))
  loadingReport.value = false
}

// ── Managers (assignment) ──
import type { ManagerAssignment } from '~/composables/useOrgManagers'
const assignments = ref<ManagerAssignment[]>([])
async function loadManagers() {
  if (!orgId.value) return
  assignments.value = await loadAssignments(orgId.value)
}

const editOpen = ref(false)
const editing = ref<ManagerAssignment | null>(null)
const savingAssign = ref(false)
// Person search (people at THIS governing org)
const personQuery = ref('')
const personResults = ref<{ id: string; name: string }[]>([])
async function searchPersons() {
  const q = personQuery.value.trim()
  if (!orgId.value || q.length < 1) { personResults.value = []; return }
  const people = await peopleApi.list(orgId.value, { q, limit: 8 })
  const taken = new Set(assignments.value.map(a => a.personId))
  personResults.value = people
    .filter(p => !taken.has(p.id))
    .map(p => ({ id: p.id, name: [p.firstName, p.lastName].filter(Boolean).join(' ') || p.email || '—' }))
}
function openNew() {
  editing.value = { personId: '', personName: '', scope: 'subtree', clubIds: [], capabilities: ['report'] }
  personQuery.value = ''; personResults.value = []; editOpen.value = true
}
function openEdit(a: ManagerAssignment) {
  editing.value = JSON.parse(JSON.stringify(a)); editOpen.value = true
}
function pickPerson(p: { id: string; name: string }) {
  if (!editing.value) return
  editing.value.personId = p.id; editing.value.personName = p.name
  personQuery.value = p.name; personResults.value = []
}
function toggleCap(key: string) {
  if (!editing.value) return
  const set = new Set(editing.value.capabilities)
  set.has(key) ? set.delete(key) : set.add(key)
  editing.value.capabilities = [...set]
}
async function saveAssign() {
  if (!editing.value || !editing.value.personId) return
  if (editing.value.scope === 'clubs' && !editing.value.clubIds.length) {
    toast.add({ severity: 'warn', summary: 'Pick at least one club', life: 2500 }); return
  }
  savingAssign.value = true
  await saveAssignment(orgId.value!, editing.value)
  savingAssign.value = false
  editOpen.value = false
  await loadManagers()
  toast.add({ severity: 'success', summary: 'Manager saved', life: 1800 })
}
async function removeManager(a: ManagerAssignment) {
  if (!confirm(`Remove ${a.personName} as a club manager?`)) return
  await removeAssignment(orgId.value!, a.personId)
  await loadManagers()
}
const capLabel = (k: string) => MANAGER_CAPABILITIES.find(c => c.key === k)?.label ?? k

async function boot() {
  if (!orgId.value) return
  await loadPerms()
  const o = await orgsApi.get(orgId.value)
  org.value = o ? { org_level: o.orgLevel, name: o.name } : null
  if (!isGoverning.value) return
  const allOrgs = await loadAllOrgs()
  subtreeClubs.value = descendantClubs(orgId.value, allOrgs).map((o: any) => ({ id: o.id, name: o.name })).sort((a, b) => a.name.localeCompare(b.name))
  await Promise.all([loadReport(), loadManagers()])
}
watch(orgId, boot, { immediate: true })
watch(tab, t => { if (t === 'report') loadReport() })
</script>

<template>
  <div class="p-3 sm:p-6 max-w-5xl mx-auto">
    <div v-if="org && !isGoverning" class="card p-6 text-sm text-gray-500">
      Club managers are set up on a governing organisation (National / Regional / Association). This is a club.
    </div>

    <template v-else>
      <!-- Tabs -->
      <div class="flex items-center gap-4 border-b border-gray-200 mb-4">
        <button type="button" class="px-1 py-2 text-sm border-b-2 -mb-px transition-colors"
          :class="tab === 'report' ? 'border-primary text-primary font-medium' : 'border-transparent text-gray-500 hover:text-gray-800'"
          @click="tab = 'report'">Club report</button>
        <button v-if="canAssign" type="button" class="px-1 py-2 text-sm border-b-2 -mb-px transition-colors"
          :class="tab === 'managers' ? 'border-primary text-primary font-medium' : 'border-transparent text-gray-500 hover:text-gray-800'"
          @click="tab = 'managers'">Managers</button>
      </div>

      <!-- Club report -->
      <div v-if="tab === 'report'" class="card p-0 overflow-hidden">
        <div class="px-4 sm:px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
          <div>
            <h2 class="text-sm font-semibold text-gray-800">Club report</h2>
            <p class="text-xs text-gray-400">{{ reportScopeNote }}</p>
          </div>
          <button type="button" class="text-xs text-primary hover:underline" @click="loadReport">Refresh</button>
        </div>
        <div v-if="loadingReport" class="p-6 text-sm text-gray-400">Loading…</div>
        <div v-else-if="!reportRows.length" class="p-6 text-sm text-gray-400">
          No clubs in scope yet. {{ canAssign ? 'This organisation has no clubs beneath it.' : 'You have not been assigned any clubs.' }}
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm min-w-[520px]">
            <thead>
              <tr class="text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                <th class="text-left font-medium px-4 sm:px-5 py-2">Club</th>
                <th class="text-right font-medium px-4 py-2">Members</th>
                <th class="text-right font-medium px-4 py-2">Classes</th>
                <th class="text-right font-medium px-4 sm:px-5 py-2">Events</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in reportRows" :key="r.id" class="border-b border-gray-50 hover:bg-gray-50">
                <td class="px-4 sm:px-5 py-2.5 font-medium text-gray-800">{{ r.name }}</td>
                <td class="px-4 py-2.5 text-right tabular-nums text-gray-700">{{ r.members }}</td>
                <td class="px-4 py-2.5 text-right tabular-nums text-gray-700">{{ r.groups }}</td>
                <td class="px-4 sm:px-5 py-2.5 text-right tabular-nums text-gray-700">{{ r.events }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="border-t border-gray-200 font-semibold text-gray-900">
                <td class="px-4 sm:px-5 py-2.5">Total · {{ reportRows.length }} clubs</td>
                <td class="px-4 py-2.5 text-right tabular-nums">{{ totals.members }}</td>
                <td class="px-4 py-2.5 text-right tabular-nums">{{ totals.groups }}</td>
                <td class="px-4 sm:px-5 py-2.5 text-right tabular-nums">{{ totals.events }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <!-- Managers -->
      <div v-else-if="tab === 'managers'" class="card p-0 overflow-hidden">
        <div class="px-4 sm:px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
          <div>
            <h2 class="text-sm font-semibold text-gray-800">Club managers</h2>
            <p class="text-xs text-gray-400">People at {{ org?.name }} who can act across the clubs beneath it.</p>
          </div>
          <Button label="Add manager" icon="pi pi-plus" size="small" style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="openNew" />
        </div>
        <div v-if="!assignments.length" class="p-6 text-sm text-gray-400">No club managers yet.</div>
        <div v-else class="divide-y divide-gray-50">
          <div v-for="a in assignments" :key="a.personId" class="px-4 sm:px-5 py-3 flex items-center gap-3">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-800 truncate">{{ a.personName }}</p>
              <p class="text-xs text-gray-500">
                {{ a.scope === 'subtree' ? `All clubs beneath ${org?.name}` : `${a.clubIds.length} club${a.clubIds.length === 1 ? '' : 's'}` }}
                · <span class="text-gray-400">{{ a.capabilities.map(capLabel).join(', ') || 'no capabilities' }}</span>
              </p>
            </div>
            <button type="button" class="text-xs text-primary hover:underline" @click="openEdit(a)">Edit</button>
            <button type="button" class="text-gray-300 hover:text-red-500 w-7 h-7 flex items-center justify-center" @click="removeManager(a)"><i class="pi pi-trash text-xs" /></button>
          </div>
        </div>
      </div>
    </template>

    <!-- Assign dialog -->
    <Dialog v-model:visible="editOpen" modal :header="editing?.personId ? 'Edit manager' : 'Add club manager'" :style="{ width: '95vw', maxWidth: '32rem' }">
      <div v-if="editing" class="flex flex-col gap-4">
        <!-- Person -->
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Person</label>
          <div v-if="editing.personId" class="flex items-center gap-2">
            <span class="text-sm text-gray-800 flex-1">{{ editing.personName }}</span>
            <button type="button" class="text-xs text-primary hover:underline" @click="editing.personId = ''; personQuery = ''">Change</button>
          </div>
          <div v-else class="relative">
            <InputText v-model="personQuery" placeholder="Search people at this organisation…" class="w-full" @input="searchPersons" />
            <div v-if="personResults.length" class="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
              <button v-for="p in personResults" :key="p.id" type="button" class="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" @click="pickPerson(p)">{{ p.name }}</button>
            </div>
          </div>
        </div>

        <!-- Scope -->
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium">Which clubs</label>
          <label class="flex items-center gap-2 text-sm"><input type="radio" value="subtree" v-model="editing.scope" /> All clubs beneath {{ org?.name }}</label>
          <label class="flex items-center gap-2 text-sm"><input type="radio" value="clubs" v-model="editing.scope" /> Specific clubs</label>
          <MultiSelect v-if="editing.scope === 'clubs'" v-model="editing.clubIds" :options="subtreeClubs" option-label="name" option-value="id"
            filter display="chip" placeholder="Choose clubs" class="w-full" />
        </div>

        <!-- Capabilities -->
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium">Can</label>
          <label v-for="c in MANAGER_CAPABILITIES" :key="c.key" class="flex items-start gap-2 text-sm">
            <Checkbox :modelValue="editing.capabilities.includes(c.key)" :binary="true" @update:modelValue="toggleCap(c.key)" />
            <span><span class="text-gray-800">{{ c.label }}</span> <span class="text-gray-400">— {{ c.description }}</span></span>
          </label>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="editOpen = false" />
        <Button label="Save" :loading="savingAssign" :disabled="!editing?.personId" style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="saveAssign" />
      </template>
    </Dialog>
  </div>
</template>
