<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">

    <!-- LEFT: Group / Individual selector -->
    <div class="space-y-3">
      <p class="text-sm font-semibold text-gray-800">Choose Invitees</p>

      <!-- Mode tabs -->
      <div class="flex p-1 bg-gray-100 rounded-xl gap-1">
        <button type="button"
          class="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors"
          :class="selectorMode === 'groups' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'"
          @click="selectorMode = 'groups'">{{ t('group', true) }}</button>
        <button type="button"
          class="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors"
          :class="selectorMode === 'individuals' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'"
          @click="selectorMode = 'individuals'">Individuals</button>
      </div>

      <!-- GROUPS mode -->
      <template v-if="selectorMode === 'groups'">
        <div class="flex gap-2">
          <IconField class="flex-1">
            <InputIcon class="pi pi-search" />
            <InputText v-model="selectorSearch" :placeholder="`Search ${t('group', true, true)}…`" size="small" class="w-full" />
          </IconField>
          <div class="relative">
            <Button label="Filter" icon="pi pi-filter" size="small" severity="secondary" outlined @click="showDemoFilter = true" />
            <span v-if="demoFilterCount > 0" class="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">{{ demoFilterCount }}</span>
          </div>
        </div>

        <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div v-if="groupsLoading" class="py-8 flex justify-center"><i class="pi pi-spin pi-spinner text-gray-400" /></div>
          <div v-else-if="codeSections.length === 0" class="py-6 text-center text-sm text-gray-400">No {{ t('group', true, true) }} found</div>
          <div v-else>
            <!-- One section per CODE (programme), nested by code hierarchy, with
                 its classes underneath. "Add all" on a code adds every class in
                 it, including its sub-codes. -->
            <template v-for="section in codeSections" :key="section.id">
              <div class="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors"
                :style="{ paddingLeft: `${12 + section.depth * 16}px` }">
                <button class="w-4 h-4 flex items-center justify-center text-gray-400 shrink-0"
                  @click="toggleGroupExpand(section.id)">
                  <i :class="`pi text-xs ${expandedGroups[section.id] === false ? 'pi-chevron-right' : 'pi-chevron-down'}`" />
                </button>
                <span v-if="section.color" class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: section.color }" />
                <span class="flex-1 text-sm font-semibold text-gray-800">{{ section.name }}</span>
                <span class="text-xs text-gray-400 mr-2">{{ groupsUnderCode(section.id).length }} {{ t('group', true, true) }}</span>
                <Button
                  :label="codeFullyAdded(section.id) ? 'Added' : 'Add all'"
                  :icon="codeFullyAdded(section.id) ? 'pi pi-check' : 'pi pi-plus'"
                  size="small"
                  :severity="codeFullyAdded(section.id) ? 'success' : 'secondary'"
                  :disabled="addingGroupId !== null || !groupsUnderCode(section.id).length"
                  outlined
                  @click="toggleWholeCode(section.id)"
                />
              </div>

              <template v-if="expandedGroups[section.id] !== false">
                <div v-for="group in section.groups" :key="group.id"
                  class="flex items-center gap-2 px-3 py-2 border-b border-gray-100 last:border-0 bg-white hover:bg-gray-50 transition-colors"
                  :style="{ paddingLeft: `${32 + section.depth * 16}px` }">
                  <span class="w-2 h-2 rounded-full shrink-0" :style="{ background: group.color ?? '#94a3b8' }" />
                  <span class="flex-1 text-sm text-gray-700">{{ group.name }}</span>
                  <Button
                    :label="selectedInviteeGroups.includes(group.id) ? 'Added' : 'Add'"
                    :icon="addingGroupId === group.id ? 'pi pi-spin pi-spinner' : selectedInviteeGroups.includes(group.id) ? 'pi pi-check' : 'pi pi-plus'"
                    size="small"
                    :severity="selectedInviteeGroups.includes(group.id) ? 'success' : 'secondary'"
                    :disabled="addingGroupId !== null"
                    outlined
                    @click="toggleSelectorGroup(group.id)"
                  />
                </div>
              </template>
            </template>
          </div>
        </div>
      </template>

      <!-- INDIVIDUALS mode -->
      <template v-else>
        <IconField>
          <InputIcon class="pi pi-search" />
          <InputText v-model="personSearch" placeholder="Search by name or email…" size="small" class="w-full" @input="onPersonSearchInput" />
        </IconField>

        <div class="bg-white border border-gray-200 rounded-xl overflow-hidden min-h-[60px]">
          <div v-if="personSearchLoading" class="py-8 flex justify-center"><i class="pi pi-spin pi-spinner text-gray-400" /></div>
          <div v-else-if="!personSearch.trim()" class="py-6 text-center text-sm text-gray-400">Type a name to search</div>
          <div v-else-if="personSearchResults.length === 0" class="py-6 text-center text-sm text-gray-400">No people found</div>
          <div v-else>
            <div v-for="person in personSearchResults" :key="person.id"
              class="flex items-center gap-2.5 px-3 py-2.5 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
              <div class="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span class="text-[10px] font-bold text-primary">{{ person.first_name[0] }}{{ person.last_name[0] }}</span>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-800 truncate">{{ person.first_name }} {{ person.last_name }}</p>
                <p v-if="person.email" class="text-xs text-gray-400 truncate">{{ person.email }}</p>
              </div>
              <Button
                :label="isAlreadyInvited(person.id) ? 'Invited' : addingPersonId === person.id ? '' : 'Add'"
                :icon="addingPersonId === person.id ? 'pi pi-spin pi-spinner' : isAlreadyInvited(person.id) ? 'pi pi-check' : 'pi pi-plus'"
                size="small"
                :severity="isAlreadyInvited(person.id) ? 'success' : 'secondary'"
                :disabled="isAlreadyInvited(person.id) || addingPersonId !== null"
                outlined
                @click="addIndividual(person)"
              />
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- RIGHT: Invitees grouped view -->
    <div class="space-y-3">
      <div class="flex items-center gap-3">
        <div class="flex-1">
          <h2 class="text-sm font-semibold text-gray-800">Invitees</h2>
          <p class="text-xs text-gray-500 mt-0.5">{{ invitees.length }} people invited</p>
        </div>
        <IconField>
          <InputIcon class="pi pi-search" />
          <InputText v-model="inviteePillSearch" placeholder="Find person…" size="small" class="w-44" />
        </IconField>
      </div>

      <!-- Action bar (slides in when people are selected) -->
      <Transition name="slide-down">
        <div v-if="bulkSelected.length" class="bg-primary rounded-xl px-4 py-3 flex items-center gap-3">
          <span class="text-sm font-medium text-white">{{ bulkSelected.length }} selected</span>
          <div class="flex-1" />
          <Button label="Action" icon="pi pi-chevron-down" icon-pos="right" size="small"
            class="!bg-white !text-primary !border-white font-semibold"
            @click="e => inviteeActionMenu.toggle(e)" />
          <Menu ref="inviteeActionMenu" :model="inviteeActionMenuItems" :popup="true" />
          <button class="text-white/60 hover:text-white text-xs underline ml-1" @click="bulkSelected = []">Clear</button>
        </div>
      </Transition>

      <!-- Loading / empty state -->
      <div v-if="inviteesLoading" class="py-12 flex justify-center"><i class="pi pi-spin pi-spinner text-gray-400 text-xl" /></div>
      <div v-else-if="!invitees.length && !selectedInviteeGroups.length" class="bg-white rounded-xl border border-gray-200 py-14 text-center text-sm text-gray-400">
        <i class="pi pi-users text-3xl mb-3 block text-gray-300" />
        Use the selector on the left to add {{ t('group', true, true) }} of people
      </div>

      <!-- Group sections -->
      <template v-else>
        <!-- Per-group section -->
        <div v-for="groupId in selectedInviteeGroups.filter(g => groupInvitees(g).length > 0)" :key="groupId" class="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <!-- Group header -->
          <div class="flex items-center gap-2.5 px-4 py-3">
            <button @click="expandedGroupSections[groupId] = !expandedGroupSections[groupId]" class="text-gray-400 hover:text-gray-700 shrink-0">
              <i :class="`pi text-xs ${expandedGroupSections[groupId] ? 'pi-chevron-up' : 'pi-chevron-down'}`" />
            </button>
            <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: allMemberGroups.find(g => g.id === groupId)?.color ?? '#94a3b8' }" />
            <span class="font-semibold text-gray-800 text-sm">{{ allMemberGroups.find(g => g.id === groupId)?.name ?? groupId }}</span>
            <i class="pi pi-users text-gray-400 text-xs" />
            <span class="bg-[#2494D2] text-white text-xs font-bold px-2 py-0.5 rounded-full">{{ groupInvitees(groupId).length }}</span>
            <div class="flex-1" />
            <Button label="Remove" icon="pi pi-times" size="small" severity="danger" outlined @click="removeGroup(groupId)" />
          </div>
          <!-- People pills -->
          <div v-if="expandedGroupSections[groupId]" class="px-4 pb-3">
            <div class="flex flex-wrap gap-2">
              <span v-for="inv in visibleGroupInvitees(groupId)" :key="inv.id"
                class="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-sm transition-colors cursor-pointer select-none"
                :class="bulkSelected.includes(inv.id) ? 'bg-primary text-white' : isPillHighlighted(inv) ? 'bg-amber-100 text-amber-900 ring-2 ring-amber-400' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
                @click="toggleBulkSelect(inv.id)">
                {{ inv.person?.first_name }} {{ inv.person?.last_name }}
                <span v-if="inviteeRole(inv) !== 'attendee'" class="text-[10px] px-1.5 py-0.5 rounded-full bg-[#2494D2]/15 text-[#2494D2] font-semibold">{{ eventRoleLabel(inviteeRole(inv)) }}</span>
                <button class="transition-colors" :class="bulkSelected.includes(inv.id) ? 'text-white/60 hover:text-white' : 'text-gray-400 hover:text-red-500'" @click.stop="removeInvitee(inv.id)">
                  <i class="pi pi-times-circle text-sm" />
                </button>
              </span>
            </div>
            <button v-if="groupInvitees(groupId).length > GROUP_PREVIEW"
              class="mt-2.5 flex items-center gap-1 text-sm text-primary hover:underline"
              @click="showAllInGroup[groupId] = !showAllInGroup[groupId]">
              <i :class="`pi text-xs ${showAllInGroup[groupId] ? 'pi-chevron-up' : 'pi-chevron-down'}`" />
              {{ showAllInGroup[groupId] ? 'Show less' : `Show all (${groupInvitees(groupId).length})` }}
            </button>
          </div>
        </div>

        <!-- Individually added / unassigned -->
        <div v-if="unassignedInvitees.length" class="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div class="flex items-center gap-2.5 px-4 py-3">
            <button @click="expandedGroupSections['__individual'] = !expandedGroupSections['__individual']" class="text-gray-400 hover:text-gray-700 shrink-0">
              <i :class="`pi text-xs ${expandedGroupSections['__individual'] !== false ? 'pi-chevron-up' : 'pi-chevron-down'}`" />
            </button>
            <i class="pi pi-user text-gray-400 text-xs shrink-0" />
            <span class="font-semibold text-gray-800 text-sm">Individual invitees</span>
            <i class="pi pi-users text-gray-400 text-xs" />
            <span class="bg-gray-400 text-white text-xs font-bold px-2 py-0.5 rounded-full">{{ unassignedInvitees.length }}</span>
          </div>
          <div v-if="expandedGroupSections['__individual'] !== false" class="px-4 pb-3">
            <div class="flex flex-wrap gap-2">
              <span v-for="inv in showAllInGroup['__individual'] ? unassignedInvitees : unassignedInvitees.slice(0, GROUP_PREVIEW)" :key="inv.id"
                class="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-sm transition-colors cursor-pointer select-none"
                :class="bulkSelected.includes(inv.id) ? 'bg-primary text-white' : isPillHighlighted(inv) ? 'bg-amber-100 text-amber-900 ring-2 ring-amber-400' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
                @click="toggleBulkSelect(inv.id)">
                {{ inv.person?.first_name }} {{ inv.person?.last_name }}
                <span v-if="inviteeRole(inv) !== 'attendee'" class="text-[10px] px-1.5 py-0.5 rounded-full bg-[#2494D2]/15 text-[#2494D2] font-semibold">{{ eventRoleLabel(inviteeRole(inv)) }}</span>
                <button class="transition-colors" :class="bulkSelected.includes(inv.id) ? 'text-white/60 hover:text-white' : 'text-gray-400 hover:text-red-500'" @click.stop="removeInvitee(inv.id)">
                  <i class="pi pi-times-circle text-sm" />
                </button>
              </span>
            </div>
            <button v-if="unassignedInvitees.length > GROUP_PREVIEW"
              class="mt-2.5 flex items-center gap-1 text-sm text-primary hover:underline"
              @click="showAllInGroup['__individual'] = !showAllInGroup['__individual']">
              <i :class="`pi text-xs ${showAllInGroup['__individual'] ? 'pi-chevron-up' : 'pi-chevron-down'}`" />
              {{ showAllInGroup['__individual'] ? 'Show less' : `Show all (${unassignedInvitees.length})` }}
            </button>
          </div>
        </div>
      </template>
    </div>

  </div>

  <!-- Demographics Filter Dialog -->
  <Dialog v-model:visible="showDemoFilter" header="Filter by Demographics" modal :style="{ width: '95vw', maxWidth: '480px' }">
    <div class="flex flex-col gap-5 py-2">

      <!-- Gender -->
      <div>
        <p class="text-sm font-semibold text-gray-700 mb-2.5">Gender</p>
        <div class="flex flex-wrap gap-2">
          <button v-for="g in genderOptions" :key="g.value"
            class="px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors"
            :class="demoFilter.genders.includes(g.value)
              ? 'bg-primary border-primary text-white'
              : 'bg-white border-gray-300 text-gray-600 hover:border-primary hover:text-primary'"
            @click="toggleDemoGender(g.value)">
            {{ g.label }}
          </button>
        </div>
      </div>

      <!-- Age range -->
      <div>
        <p class="text-sm font-semibold text-gray-700 mb-2.5">Age Range</p>
        <div class="flex items-center gap-3">
          <div class="flex-1">
            <label class="text-xs text-gray-500 mb-1 block">Min age</label>
            <InputNumber v-model="demoFilter.ageMin" :min="0" :max="120" placeholder="Any" class="w-full" size="small" />
          </div>
          <span class="text-gray-400 mt-4">—</span>
          <div class="flex-1">
            <label class="text-xs text-gray-500 mb-1 block">Max age</label>
            <InputNumber v-model="demoFilter.ageMax" :min="0" :max="120" placeholder="Any" class="w-full" size="small" />
          </div>
        </div>
        <div class="flex gap-2 mt-2 flex-wrap">
          <button v-for="preset in agePresets" :key="preset.label"
            class="px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors"
            :class="demoFilter.ageMin === preset.min && demoFilter.ageMax === preset.max
              ? 'bg-primary border-primary text-white'
              : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'"
            @click="demoFilter.ageMin = preset.min; demoFilter.ageMax = preset.max">
            {{ preset.label }}
          </button>
        </div>
      </div>

      <!-- Membership type -->
      <div>
        <p class="text-sm font-semibold text-gray-700 mb-2.5">Membership Status</p>
        <div class="flex flex-wrap gap-2">
          <button v-for="m in membershipOptions" :key="m.value"
            class="px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors"
            :class="demoFilter.membershipTypes.includes(m.value)
              ? 'bg-primary border-primary text-white'
              : 'bg-white border-gray-300 text-gray-600 hover:border-primary hover:text-primary'"
            @click="toggleDemoMembership(m.value)">
            {{ m.label }}
          </button>
        </div>
      </div>

      <!-- Registration status -->
      <div>
        <p class="text-sm font-semibold text-gray-700 mb-2.5">Registration Status</p>
        <div class="flex flex-wrap gap-2">
          <button v-for="r in registrationOptions" :key="r.value"
            class="px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors"
            :class="demoFilter.registrationStatuses.includes(r.value)
              ? 'bg-primary border-primary text-white'
              : 'bg-white border-gray-300 text-gray-600 hover:border-primary hover:text-primary'"
            @click="toggleDemoRegistration(r.value)">
            {{ r.label }}
          </button>
        </div>
      </div>

      <!-- Active filter summary -->
      <div v-if="demoFilterCount > 0" class="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between">
        <span class="text-sm text-blue-700 font-medium">{{ demoFilterCount }} filter{{ demoFilterCount > 1 ? 's' : '' }} active</span>
        <button class="text-xs text-blue-600 hover:text-blue-800 underline" @click="clearDemoFilter">Clear all</button>
      </div>

    </div>
    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="showDemoFilter = false" />
      <Button label="Apply Filters" icon="pi pi-check" @click="showDemoFilter = false" style="background:var(--brand-primary); border-color:var(--brand-primary)" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
const { orgId } = useOrg()
const { ensureTerms, t } = useTerms()
void ensureTerms()
const props = defineProps<{
  eventId: string
}>()

const db = useDb()
const toast = useToast()

// Scoped per-event roles. A person can be an Attendee / Coach / Manager of an event.
const scoped = useScopedRoles()
const eventRoleOptions = computed(() => scoped.rolesFor('event').map(r => ({ label: r.label, value: r.key })))
const eventRoleLabel = (key: string) => scoped.roleDef('event', key)?.label ?? key
const inviteeRole = (inv: any) => scoped.normalizeRoles('event', inv.roles, inv.role)[0] || 'attendee'
// Map a person's GROUP roles → their event role when invited via a group.
function groupToEventRole(groupRoles: string[]): string {
  if (groupRoles.includes('manager')) return 'manager'
  if (groupRoles.some(r => r === 'coach' || r === 'assistant_coach')) return 'coach'
  return 'attendee'
}

// ---- Invitees ----
const invitees = ref<any[]>([])
const inviteesLoading = ref(false)

async function loadInvitees() {
  inviteesLoading.value = true
  const { data } = await db
    .from('invitees')
    .select('*, person:persons(id, first_name, last_name, email)')
    .eq('event_id', props.eventId)
    .order('invited_at')
  invitees.value = data ?? []
  inviteesLoading.value = false
}

async function removeInvitee(inviteeId: string) {
  await db.from('invitees').delete().eq('id', inviteeId)
  toast.add({ severity: 'success', summary: 'Invitee removed', life: 3000 })
  loadInvitees()
}

// ---- Selector mode ----
const selectorMode = ref<'groups' | 'individuals'>('groups')

// ---- Individual person search ----
const personSearch = ref('')
const personSearchResults = ref<any[]>([])
const personSearchLoading = ref(false)
const addingPersonId = ref<string | null>(null)
let personSearchTimer: ReturnType<typeof setTimeout> | null = null

function onPersonSearchInput() {
  if (personSearchTimer) clearTimeout(personSearchTimer)
  // Search from the first character — a 2-char minimum silently swallowed
  // single-letter searches and looked broken.
  if (!personSearch.value.trim()) { personSearchResults.value = []; return }
  personSearchTimer = setTimeout(searchPersons, 250)
}

async function searchPersons() {
  personSearchLoading.value = true
  const q = personSearch.value.trim()
  const { data } = await db.from('persons')
    .select('id, first_name, last_name, email')
    .eq('org_id', orgId.value)
    .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
    .order('last_name')
    .limit(20)
  personSearchResults.value = data ?? []
  personSearchLoading.value = false
}

function isAlreadyInvited(personId: string) {
  return invitees.value.some(i => i.person_id === personId)
}

async function addIndividual(person: any) {
  if (isAlreadyInvited(person.id)) return
  addingPersonId.value = person.id
  const { error } = await db.from('invitees').insert({ event_id: props.eventId, person_id: person.id, status: 'INVITED', role: 'attendee', roles: ['attendee'] } as any)
  if (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 4000 })
  } else {
    await loadInvitees()
    toast.add({ severity: 'success', summary: `${person.first_name} ${person.last_name} added`, life: 3000 })
  }
  addingPersonId.value = null
}

// ---- Group selector ----
const selectorSearch = ref('')
const selectedInviteeGroups = ref<string[]>([])
const groupsLoading = ref(false)
const allMemberGroups = ref<any[]>([])
const expandedGroups = reactive<Record<string, boolean>>({})
const addingGroupId = ref<string | null>(null)
const groupMembershipsMap = ref<Record<string, string[]>>({})
const showAllInGroup = reactive<Record<string, boolean>>({})
const expandedGroupSections = reactive<Record<string, boolean>>({})
const GROUP_PREVIEW = 10

// Classes hang off a CODE (programme), not off each other — member_groups.parent_id
// was retired in migration 205/206, so the old parent/child nesting here was dead
// and rendered a flat list. Group by code, and nest codes under their parents.
const gc = useGroupCodes()
const allCodes = ref<any[]>([])

async function loadMemberGroups() {
  groupsLoading.value = true
  const [codes, { data: groups }, { data: memberships }] = await Promise.all([
    gc.loadCodes(),
    (db.from as any)('member_groups')
      .select('id, name, color, code_id, sort_order, kind')
      .eq('org_id', orgId.value).order('sort_order'),
    db.from('member_group_memberships').select('group_id'),
  ])
  allCodes.value = codes ?? []
  const countMap: Record<string, number> = {}
  for (const m of memberships ?? []) countMap[m.group_id] = (countMap[m.group_id] ?? 0) + 1
  allMemberGroups.value = (groups ?? [])
    .filter((g: any) => g.kind !== 'membership')   // memberships aren't classes
    .map((g: any) => ({ ...g, _memberCount: countMap[g.id] ?? 0 }))
  groupsLoading.value = false
}

// Sections: one per code (in tree order, children indented), plus an
// "Ungrouped" bucket for classes with no code. Codes with nothing in them —
// after the search filter — are dropped.
interface CodeSection { id: string; name: string; color: string | null; depth: number; groups: any[] }

const codeSections = computed<CodeSection[]>(() => {
  const q = selectorSearch.value.trim().toLowerCase()
  const matches = (g: any) => !q || g.name.toLowerCase().includes(q)

  const byCode: Record<string, any[]> = {}
  for (const g of allMemberGroups.value) {
    if (!matches(g)) continue
    ;(byCode[g.code_id ?? '__none'] ??= []).push(g)
  }

  const byParent: Record<string, any[]> = {}
  for (const c of [...allCodes.value].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name))) {
    (byParent[c.parent_id ?? '__root'] ??= []).push(c)
  }

  const out: CodeSection[] = []
  const walk = (parent: string, depth: number) => {
    for (const c of byParent[parent] ?? []) {
      const groups = byCode[c.id] ?? []
      // Keep a code that has matching classes, or descendants that do.
      const before = out.length
      const self: CodeSection = { id: c.id, name: c.name, color: c.color, depth, groups }
      out.push(self)
      walk(c.id, depth + 1)
      if (!groups.length && out.length === before + 1) out.pop()   // empty branch
    }
  }
  walk('__root', 0)

  if (byCode.__none?.length) {
    out.push({ id: '__none', name: 'Ungrouped', color: null, depth: 0, groups: byCode.__none })
  }
  return out
})

// Every class under a code (including its sub-codes) — what "Add all" adds.
function groupsUnderCode(codeId: string): any[] {
  if (codeId === '__none') {
    return allMemberGroups.value.filter(g => !g.code_id)
  }
  const ids = new Set<string>([codeId])
  let grew = true
  while (grew) {
    grew = false
    for (const c of allCodes.value) {
      if (c.parent_id && ids.has(c.parent_id) && !ids.has(c.id)) { ids.add(c.id); grew = true }
    }
  }
  return allMemberGroups.value.filter(g => g.code_id && ids.has(g.code_id))
}

const codeFullyAdded = (codeId: string) => {
  const gs = groupsUnderCode(codeId)
  return gs.length > 0 && gs.every(g => selectedInviteeGroups.value.includes(g.id))
}

async function toggleWholeCode(codeId: string) {
  const gs = groupsUnderCode(codeId)
  const add = !codeFullyAdded(codeId)
  for (const g of gs) {
    const already = selectedInviteeGroups.value.includes(g.id)
    if (add !== already) await toggleSelectorGroup(g.id)
  }
}

function toggleGroupExpand(id: string) {
  expandedGroups[id] = !expandedGroups[id]
}

function groupInvitees(groupId: string) {
  const personIds = new Set(groupMembershipsMap.value[groupId] ?? [])
  return invitees.value.filter(i => personIds.has(i.person_id))
}

function visibleGroupInvitees(groupId: string) {
  const all = groupInvitees(groupId)
  return showAllInGroup[groupId] ? all : all.slice(0, GROUP_PREVIEW)
}

const unassignedInvitees = computed(() => {
  const assigned = new Set(Object.values(groupMembershipsMap.value).flat())
  return invitees.value.filter(i => !assigned.has(i.person_id))
})

async function toggleSelectorGroup(value: string) {
  const idx = selectedInviteeGroups.value.indexOf(value)
  if (idx >= 0) {
    selectedInviteeGroups.value.splice(idx, 1)
  } else {
    await addGroupInvitees(value)
  }
}

async function addGroupInvitees(groupId: string) {
  addingGroupId.value = groupId

  const children = allMemberGroups.value.filter(g => g.parent_id === groupId)
  // If this group has children, pull memberships from children; otherwise use the group itself
  const groupIds = children.length > 0 ? children.map(g => g.id) : [groupId]

  const { data: memberships } = await (db.from as any)('member_group_memberships').select('person_id, roles, role').in('group_id', groupIds)
  const personIds = [...new Set((memberships ?? []).map((m: any) => m.person_id))] as string[]
  // Best group role per person → their event role (coach in group → coach at event).
  const eventRoleByPerson: Record<string, string> = {}
  for (const m of (memberships ?? []) as any[]) {
    const evRole = groupToEventRole(scoped.normalizeRoles('group', m.roles, m.role))
    // keep the strongest role if a person is in multiple child groups
    const rank = (r: string) => (r === 'manager' ? 2 : r === 'coach' ? 1 : 0)
    if (!eventRoleByPerson[m.person_id] || rank(evRole) > rank(eventRoleByPerson[m.person_id])) eventRoleByPerson[m.person_id] = evRole
  }

  if (!personIds.length) {
    toast.add({ severity: 'info', summary: `No ${t('member', true, true)} found`, detail: `No ${t('member', true, true)} in this ${t('group', false, true)}.`, life: 3000 })
    addingGroupId.value = null
    return
  }

  const existingIds = new Set(invitees.value.map(i => i.person_id))
  const toInsert = personIds
    .filter(pid => !existingIds.has(pid))
    .map(pid => { const role = eventRoleByPerson[pid] || 'attendee'; return { event_id: props.eventId, person_id: pid, status: 'INVITED', role, roles: [role] } })

  if (toInsert.length) {
    const { error } = await db.from('invitees').insert(toInsert)
    if (error) {
      toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 4000 })
      addingGroupId.value = null
      return
    }
    await loadInvitees()
    toast.add({ severity: 'success', summary: `${toInsert.length} invitee${toInsert.length > 1 ? 's' : ''} added`, life: 3000 })
  } else {
    toast.add({ severity: 'info', summary: 'Already invited', detail: `All ${t('member', true, true)} in this ${t('group', false, true)} are already invited.`, life: 3000 })
  }

  groupMembershipsMap.value[groupId] = personIds
  expandedGroupSections[groupId] = true
  selectedInviteeGroups.value.push(groupId)
  addingGroupId.value = null
}

async function removeGroup(groupId: string) {
  const personIds = groupMembershipsMap.value[groupId] ?? []
  const toDelete = invitees.value.filter(i => personIds.includes(i.person_id)).map(i => i.id)
  if (toDelete.length) {
    await db.from('invitees').delete().in('id', toDelete)
    await loadInvitees()
  }
  const idx = selectedInviteeGroups.value.indexOf(groupId)
  if (idx >= 0) selectedInviteeGroups.value.splice(idx, 1)
  delete groupMembershipsMap.value[groupId]
  toast.add({ severity: 'success', summary: `${t('group', false)} removed`, life: 3000 })
}

// ---- Bulk selection ----
const bulkSelected = ref<string[]>([])
const bulkDeleting = ref(false)

function toggleBulkSelect(id: string) {
  const i = bulkSelected.value.indexOf(id)
  i >= 0 ? bulkSelected.value.splice(i, 1) : bulkSelected.value.push(id)
}

async function bulkDelete() {
  if (!bulkSelected.value.length) return
  bulkDeleting.value = true
  const { error } = await db.from('invitees').delete().in('id', bulkSelected.value)
  if (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 4000 })
  } else {
    toast.add({ severity: 'success', summary: `${bulkSelected.value.length} invitee${bulkSelected.value.length > 1 ? 's' : ''} removed`, life: 3000 })
    bulkSelected.value = []
    loadInvitees()
  }
  bulkDeleting.value = false
}

// ---- Invitee pill search (highlight only) ----
const inviteePillSearch = ref('')
function isPillHighlighted(inv: any): boolean {
  const q = inviteePillSearch.value.trim().toLowerCase()
  if (!q) return false
  const name = `${inv.person?.first_name ?? ''} ${inv.person?.last_name ?? ''}`.toLowerCase()
  return name.includes(q)
}

// ---- Invitee action menu ----
const inviteeActionMenu = ref()
const inviteeActionMenuItems = [
  { label: 'Send Message', icon: 'pi pi-comment', command: () => { /* TODO: emit or handle */ } },
  { label: 'Send Email', icon: 'pi pi-envelope', command: () => { /* TODO: emit or handle */ } },
  { separator: true },
  { label: 'Delete Selected', icon: 'pi pi-trash', command: () => bulkDelete() },
]

// ---- Demographics filter ----
const showDemoFilter = ref(false)
const demoFilter = reactive({
  genders: [] as string[],
  ageMin: null as number | null,
  ageMax: null as number | null,
  membershipTypes: [] as string[],
  registrationStatuses: [] as string[],
})

const genderOptions = [
  { label: 'Male', value: 'MALE' },
  { label: 'Female', value: 'FEMALE' },
  { label: 'Non-binary', value: 'NON_BINARY' },
  { label: 'Unspecified', value: 'UNSPECIFIED' },
]
const membershipOptions = [
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Non-Active', value: 'NON_ACTIVE' },
  { label: 'Previous', value: 'PREVIOUS' },
  { label: 'Junior', value: 'JUNIOR' },
  { label: 'Social', value: 'SOCIAL' },
]
const registrationOptions = [
  { label: 'Registered', value: 'registered' },
  { label: 'Unregistered', value: 'unregistered' },
  { label: 'Pending', value: 'pending' },
  { label: 'Expired', value: 'expired' },
]
const agePresets = [
  { label: 'Under 18', min: 0, max: 17 },
  { label: '18–25', min: 18, max: 25 },
  { label: '26–40', min: 26, max: 40 },
  { label: '40+', min: 40, max: 120 },
]

const demoFilterCount = computed(() =>
  demoFilter.genders.length +
  demoFilter.membershipTypes.length +
  demoFilter.registrationStatuses.length +
  (demoFilter.ageMin !== null || demoFilter.ageMax !== null ? 1 : 0)
)

function toggleDemoGender(v: string) {
  const i = demoFilter.genders.indexOf(v)
  i >= 0 ? demoFilter.genders.splice(i, 1) : demoFilter.genders.push(v)
}
function toggleDemoMembership(v: string) {
  const i = demoFilter.membershipTypes.indexOf(v)
  i >= 0 ? demoFilter.membershipTypes.splice(i, 1) : demoFilter.membershipTypes.push(v)
}
function toggleDemoRegistration(v: string) {
  const i = demoFilter.registrationStatuses.indexOf(v)
  i >= 0 ? demoFilter.registrationStatuses.splice(i, 1) : demoFilter.registrationStatuses.push(v)
}
function clearDemoFilter() {
  demoFilter.genders = []
  demoFilter.ageMin = null
  demoFilter.ageMax = null
  demoFilter.membershipTypes = []
  demoFilter.registrationStatuses = []
}

onMounted(() => {
  scoped.loadRoleDefs()
  loadMemberGroups()
  loadInvitees()
})
</script>
