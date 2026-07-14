<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">

    <!-- LEFT: the reusable <PeopleSelector>. Everything about CHOOSING people
         (search / filter-to-a-list / browse the class tree) lives there, so any
         other screen that needs to pick people gets the same tool. This component
         only knows what to DO with the choice: make them invitees. -->
    <div class="space-y-3">
      <!-- Both columns run title → controls → panels, at the same heights, so the
           class tree and the first invitee group line up. -->
      <div class="h-8 flex items-center">
        <p class="text-sm font-semibold text-gray-800">Choose Invitees</p>
      </div>
      <PeopleSelector
        :invited-person-ids="invitees.map(i => i.person_id)"
        :added-group-ids="selectedInviteeGroups"
        :busy-person-id="addingPersonId"
        :busy-group-id="addingGroupId"
        added-label="Invited"
        @add-person="addIndividual"
        @add-people="addManyIndividuals"
        @toggle-group="toggleSelectorGroup"
        @toggle-code="toggleWholeCode"
        @reveal-person="flashPerson" />
    </div>

    <!-- RIGHT: who's actually invited -->
    <div class="space-y-3">
      <div class="h-8 flex items-center gap-2">
        <h2 class="text-sm font-semibold text-gray-800 flex-1">Invitees</h2>
        <Button v-if="showInvite && invitees.length" label="Send invitation" icon="pi pi-send" size="small" outlined
          @click="invitationOpen = true" />
      </div>

      <!-- The count sits on the controls row, level with the left column's search
           box, so both panels below start at the same y. Search rides the same
           line as an ICON that slides open — it's a "find someone in this list"
           affordance, not a primary control, so it shouldn't hold a box's worth
           of space until it's wanted. -->
      <div class="h-[34px] flex items-center gap-2">
        <p class="text-sm font-medium text-gray-700 flex-1">{{ invitees.length }} people invited</p>
        <Transition name="search-slide">
          <InputText v-if="pillSearchOpen" ref="pillSearchEl" v-model="inviteePillSearch"
            placeholder="Find person…" size="small" class="w-40"
            @blur="!inviteePillSearch && (pillSearchOpen = false)" />
        </Transition>
        <button v-if="invitees.length" type="button"
          class="w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0"
          :class="pillSearchOpen ? 'text-primary bg-primary/10' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'"
          @click="togglePillSearch">
          <i class="pi pi-search text-xs" />
        </button>
      </div>

      <EventInvitationDialog v-if="showInvite" v-model:visible="invitationOpen" :event-id="eventId" />

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
                :class="bulkSelected.includes(inv.id) ? 'bg-primary text-white'
                  : flashedPersonId === inv.person_id ? 'bg-emerald-100 text-emerald-900 ring-2 ring-emerald-400'
                  : isPillHighlighted(inv) ? 'bg-amber-100 text-amber-900 ring-2 ring-amber-400'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
                @click="toggleBulkSelect(inv.id)">
                <!-- Their RSVP, if they've given one. No icon = hasn't replied yet. -->
                <i v-if="rsvpState(inv)" v-tooltip.top="rsvpState(inv) === 'yes' ? 'Coming' : 'Not coming'"
                  class="pi text-xs"
                  :class="rsvpState(inv) === 'yes'
                    ? (bulkSelected.includes(inv.id) ? 'pi-check-circle text-white' : 'pi-check-circle text-emerald-600')
                    : (bulkSelected.includes(inv.id) ? 'pi-times-circle text-white/70' : 'pi-times-circle text-gray-400')" />
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
                :class="bulkSelected.includes(inv.id) ? 'bg-primary text-white'
                  : flashedPersonId === inv.person_id ? 'bg-emerald-100 text-emerald-900 ring-2 ring-emerald-400'
                  : isPillHighlighted(inv) ? 'bg-amber-100 text-amber-900 ring-2 ring-amber-400'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
                @click="toggleBulkSelect(inv.id)">
                <!-- Their RSVP, if they've given one. No icon = hasn't replied yet. -->
                <i v-if="rsvpState(inv)" v-tooltip.top="rsvpState(inv) === 'yes' ? 'Coming' : 'Not coming'"
                  class="pi text-xs"
                  :class="rsvpState(inv) === 'yes'
                    ? (bulkSelected.includes(inv.id) ? 'pi-check-circle text-white' : 'pi-check-circle text-emerald-600')
                    : (bulkSelected.includes(inv.id) ? 'pi-times-circle text-white/70' : 'pi-times-circle text-gray-400')" />
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

</template>

<script setup lang="ts">
const { orgId } = useOrg()
const { ensureTerms, t } = useTerms()
void ensureTerms()
const props = withDefaults(defineProps<{
  eventId: string
  /** Show the "Send invitation" button. Off in the create wizard, where sending
      belongs on the final step — you pick people first, decide to tell them last. */
  showInvite?: boolean
}>(), { showInvite: true })

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

// "Add all N" from the filter results — one insert, not N round-trips. Anyone
// already invited is skipped rather than erroring on the unique constraint.
async function addManyIndividuals(people: any[]) {
  const fresh = people.filter(p => !isAlreadyInvited(p.id))
  if (!fresh.length) return
  const { error } = await (db.from as any)('invitees').upsert(
    fresh.map(p => ({ event_id: props.eventId, person_id: p.id, status: 'INVITED', role: 'attendee', roles: ['attendee'] })),
    { onConflict: 'event_id,person_id', ignoreDuplicates: true },
  )
  if (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 4000 })
    return
  }
  await loadInvitees()
  // No toast — see addGroupInvitees: the new pills are the confirmation.
}

// ---- Chosen classes ----
// The class TREE (and its search/filter) lives in <PeopleSelector>. What stays
// here is only what an EVENT does with the choice: which classes were added, and
// the roster we exploded out of them. `allMemberGroups` is kept purely to render
// each added group's name + colour on the right.
const selectedInviteeGroups = ref<string[]>([])
const allMemberGroups = ref<any[]>([])
const addingGroupId = ref<string | null>(null)
const addingPersonId = ref<string | null>(null)
const groupMembershipsMap = ref<Record<string, string[]>>({})

// Right-pane display state: which added-group sections are open, and how many
// people each shows before "Show all".
const expandedGroupSections = reactive<Record<string, boolean>>({})
const showAllInGroup = reactive<Record<string, boolean>>({})
const GROUP_PREVIEW = 12

async function loadMemberGroups() {
  const { data } = await (db.from as any)('member_groups')
    .select('id, name, color').eq('org_id', orgId.value)
  allMemberGroups.value = data ?? []
}

// The selector hands back the ids; adding/removing invitees is our job.
async function toggleWholeCode(groupIds: string[], adding: boolean, who: 'all' | 'members' | 'staff' = 'all') {
  for (const id of groupIds) {
    const already = selectedInviteeGroups.value.includes(id)
    // A narrowed add (members/staff only) always runs — the class may already be
    // added "as members" and you're now pulling its coaches in too.
    if (who !== 'all' || adding !== already) await toggleSelectorGroup(id, who)
  }
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

async function toggleSelectorGroup(value: string, who: 'all' | 'members' | 'staff' = 'all') {
  await addGroupInvitees(value, who)
}

async function addGroupInvitees(groupId: string, who: 'all' | 'members' | 'staff' = 'all') {
  addingGroupId.value = groupId

  const children = allMemberGroups.value.filter(g => g.parent_id === groupId)
  // If this group has children, pull memberships from children; otherwise use the group itself
  const groupIds = children.length > 0 ? children.map(g => g.id) : [groupId]

  const { data: allMemberships } = await (db.from as any)('member_group_memberships').select('person_id, roles, role').in('group_id', groupIds)
  // The split Add button's facet: everyone, just the members, or just the staff
  // (a coach is a membership whose role is a staff role — useScopedRoles knows).
  const memberships = (allMemberships ?? []).filter((m: any) => {
    if (who === 'all') return true
    const staff = scoped.isStaff('group', scoped.normalizeRoles('group', m.roles, m.role))
    return who === 'staff' ? staff : !staff
  })
  const personIds = [...new Set(memberships.map((m: any) => m.person_id))] as string[]
  // Best group role per person → their event role (coach in group → coach at event).
  const eventRoleByPerson: Record<string, string> = {}
  for (const m of memberships as any[]) {
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
    // No toast: the people appearing on the right IS the feedback. (Bulk-adding
    // overlapping classes is normal — a toast per add would just be noise.)
  }

  // UNION, don't overwrite: "Add ▸ Staff only" then "Add ▸ Members only" on the
  // same class must end up with both, and the class must appear in the list once.
  groupMembershipsMap.value[groupId] = [
    ...new Set([...(groupMembershipsMap.value[groupId] ?? []), ...personIds]),
  ]
  expandedGroupSections[groupId] = true
  if (!selectedInviteeGroups.value.includes(groupId)) selectedInviteeGroups.value.push(groupId)
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
  // No toast — the section vanishing IS the confirmation (same rule as adding).
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

// ---- "They're already in" flash ----
// Straight from the legacy mailer: re-adding someone already invited doesn't
// error and doesn't silently do nothing — their pill flashes green and fades
// back, so bulk-adding overlapping classes feels safe rather than noisy.
const flashedPersonId = ref<string | null>(null)
let flashTimer: ReturnType<typeof setTimeout> | null = null

function flashPerson(personId: string) {
  if (flashTimer) clearTimeout(flashTimer)
  flashedPersonId.value = personId
  flashTimer = setTimeout(() => (flashedPersonId.value = null), 900)
}

// ---- Invitee pill search (highlight only) ----
// Collapsed to an icon by default; the box slides out when you want it.
const inviteePillSearch = ref('')
const pillSearchOpen = ref(false)
const pillSearchEl = ref<any>(null)

function togglePillSearch() {
  pillSearchOpen.value = !pillSearchOpen.value
  if (pillSearchOpen.value) nextTick(() => (pillSearchEl.value?.$el ?? pillSearchEl.value)?.focus?.())
  else inviteePillSearch.value = ''   // closing clears, or a hidden query would keep filtering
}
function isPillHighlighted(inv: any): boolean {
  const q = inviteePillSearch.value.trim().toLowerCase()
  if (!q) return false
  const name = `${inv.person?.first_name ?? ''} ${inv.person?.last_name ?? ''}`.toLowerCase()
  return name.includes(q)
}

// ---- Invitation email ----
const invitationOpen = ref(false)

// ---- RSVP ----
// "Are you coming?" is answered on /rsvp/:event/:person, which writes the
// invitee's status. Here we only SHOW the answer (on the pill) and hand out the
// links: a personal link per invitee, since the answer is recorded against them.
// Until the invitation email exists, copying the links out is how they're sent.
function rsvpState(inv: any): 'yes' | 'no' | null {
  if (inv.status === 'CONFIRMED') return 'yes'
  if (inv.status === 'DECLINED') return 'no'
  return null   // invited, hasn't replied
}
function rsvpLink(inv: any) {
  return `${window.location.origin}/rsvp/${props.eventId}/${inv.person_id ?? inv.person?.id}`
}
function copyRsvpLinks() {
  const chosen = invitees.value.filter(i => bulkSelected.value.includes(i.id))
  const rows = (chosen.length ? chosen : invitees.value)
    .map(i => `${i.person?.first_name ?? ''} ${i.person?.last_name ?? ''}`.trim() + `\t${rsvpLink(i)}`)
  if (!rows.length) return
  navigator.clipboard?.writeText(rows.join('\n'))
  toast.add({
    severity: 'success',
    summary: `Copied ${rows.length} RSVP link${rows.length === 1 ? '' : 's'}`,
    detail: chosen.length ? 'For the people you selected.' : 'For everyone invited.',
    life: 3000,
  })
}

// ---- Invitee action menu ----
const inviteeActionMenu = ref()
const inviteeActionMenuItems = [
  { label: 'Send Message', icon: 'pi pi-comment', command: () => { /* TODO: emit or handle */ } },
  { label: 'Send Email', icon: 'pi pi-envelope', command: () => { /* TODO: emit or handle */ } },
  { label: 'Copy RSVP links', icon: 'pi pi-link', command: () => copyRsvpLinks() },
  { separator: true },
  { label: 'Delete Selected', icon: 'pi pi-trash', command: () => bulkDelete() },
]

// NOTE: the old "Filter by Demographics" dialog lived here and was a LIE — its
// criteria (gender / age / membership / registration status) were never applied
// to anything; they only lit up a count badge. The real one now lives in
// <PeopleSelector>, where it queries persons and hands back the actual list of
// matching people to add.

onMounted(() => {
  scoped.loadRoleDefs()
  loadMemberGroups()
  loadInvitees()
})
</script>

<style scoped>
/* The invitee search slides out of the icon rather than appearing from nowhere.
   (The neighbouring slide-down Transition has never had CSS — it's inert.) */
.search-slide-enter-active,
.search-slide-leave-active {
  transition: width 0.18s ease, opacity 0.18s ease;
  overflow: hidden;
}
.search-slide-enter-from,
.search-slide-leave-to {
  width: 0;
  opacity: 0;
  padding-left: 0;
  padding-right: 0;
}
</style>
