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
      <!-- Governing body: scope invites to ONE of the event's own disciplines. The
           chosen scope applies to every club added after it. -->
      <div v-if="isGoverning && eventDisciplineOptions.length > 1"
        class="flex items-center gap-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
        <i class="pi pi-tag text-gray-400 text-xs shrink-0" />
        <span class="text-xs font-medium text-gray-600 shrink-0">Scope invites to</span>
        <Select v-model="inviteDiscipline" :options="eventDisciplineOptions" option-label="label" option-value="value"
          class="flex-1 min-w-0" />
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
        @reveal-person="flashPerson"
        :show-clubs="isGoverning"
        :added-org-ids="orgInvitees.map(o => o.orgId)"
        @add-org="addOrg"
        @reveal-org="flashOrg" />
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
        <p class="text-sm font-medium text-gray-700 flex-1">{{ invitees.length }} {{ invitees.length === 1 ? 'person' : 'people' }} invited</p>
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
        <!-- Picking people for a bulk action is a MODE you turn on, because the
             plain click on a name now opens that person's profile. Both behaviours
             wanted the same click; this is what separates them. -->
        <button v-if="invitees.length" type="button"
          class="h-7 px-2.5 rounded-lg text-xs font-semibold transition-colors shrink-0"
          :class="selectMode ? 'text-primary bg-primary/10' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'"
          @click="toggleSelectMode">
          {{ selectMode ? 'Done' : 'Select' }}
        </button>
      </div>

      <EventInvitationDialog v-if="showInvite" v-model:visible="invitationOpen" :event-id="eventId" />

      <!-- Action bar (slides in with select mode, not with the first selection —
           it is what tells you the chips have stopped being links). -->
      <Transition name="slide-down">
        <div v-if="selectMode" class="bg-primary rounded-xl px-4 py-3 flex items-center gap-3">
          <span class="text-sm font-medium text-white">
            {{ bulkSelected.length ? `${bulkSelected.length} selected` : 'Tap people to select them' }}
          </span>
          <div class="flex-1" />
          <Button label="Action" icon="pi pi-chevron-down" icon-pos="right" size="small"
            class="!bg-white !text-primary !border-white font-semibold"
            :disabled="!bulkSelected.length"
            @click="e => inviteeActionMenu.toggle(e)" />
          <Menu ref="inviteeActionMenu" :model="inviteeActionMenuItems" :popup="true" />
          <button class="text-white/60 hover:text-white text-xs underline ml-1" @click="toggleSelectMode">Done</button>
        </div>
      </Transition>

      <!-- Invited clubs (governing org) — a club invitee is neither a person nor a
           group, so it gets its own chip row independent of the people list. -->
      <div v-if="isGoverning && orgInvitees.length" class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div class="flex items-center gap-2.5 px-4 py-3">
          <i class="pi pi-building text-gray-400 text-xs shrink-0" />
          <span class="font-semibold text-gray-800 text-sm">Invited clubs</span>
          <span class="bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-full">{{ orgInvitees.length }}</span>
        </div>
        <div class="px-4 pb-3 flex flex-wrap gap-2">
          <span v-for="o in orgInvitees" :key="o.id"
            class="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-sm transition-colors"
            :class="flashedOrgId === o.orgId ? 'bg-emerald-100 text-emerald-900 ring-2 ring-emerald-400' : 'bg-gray-100 text-gray-700'">
            <i class="pi pi-building text-xs text-gray-400" />
            {{ o.orgName ?? o.orgId }}
            <span v-if="o.disciplineName" class="inline-flex items-center gap-0.5 text-xs text-primary">· {{ o.disciplineName }}</span>
            <button class="text-gray-400 hover:text-red-500" @click="removeOrg(o.id)"><i class="pi pi-times-circle text-sm" /></button>
          </span>
        </div>
      </div>

      <!-- Loading / empty state -->
      <div v-if="inviteesLoading" class="py-12 flex justify-center"><i class="pi pi-spin pi-spinner text-gray-400 text-xl" /></div>
      <div v-else-if="!invitees.length && !selectedInviteeGroups.length && !(isGoverning && orgInvitees.length)" class="bg-white rounded-xl border border-gray-200 py-14 text-center text-sm text-gray-400">
        <i class="pi pi-users text-3xl mb-3 block text-gray-300" />
        Use the selector on the left to add {{ t('group', true, true) }} of people
      </div>

      <!-- Group sections, nested under their TERM when the event spans more than one.
           The same class runs again next term under the same name, so a flat list
           showed "Under 8s" twice with nothing to tell them apart. -->
      <template v-else>
        <template v-for="sec in invitedByTerm" :key="sec.termId ?? '__none'">
          <button v-if="showTermSections" type="button"
            class="w-full flex items-center gap-2 px-1 py-1.5 text-left"
            @click="collapsedTerms[sec.termId ?? '__none'] = !collapsedTerms[sec.termId ?? '__none']">
            <i :class="`pi text-xs text-gray-400 ${collapsedTerms[sec.termId ?? '__none'] ? 'pi-chevron-down' : 'pi-chevron-up'}`" />
            <span class="text-sm font-semibold text-gray-800">{{ sec.name }}</span>
            <span class="text-xs text-gray-400">{{ sec.groupIds.length }} {{ sec.groupIds.length === 1 ? 'class' : 'classes' }}</span>
          </button>

          <template v-if="!showTermSections || !collapsedTerms[sec.termId ?? '__none']">
        <!-- Per-group section -->
        <div v-for="groupId in sec.groupIds" :key="groupId" class="bg-white rounded-xl border border-gray-200 overflow-hidden">
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
                class="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-sm transition-colors select-none"
                :class="[selectMode ? 'cursor-pointer' : '',
                  bulkSelected.includes(inv.id) ? 'bg-primary text-white'
                  : flashedPersonId === inv.person_id ? 'bg-emerald-100 text-emerald-900 ring-2 ring-emerald-400'
                  : isPillHighlighted(inv) ? 'bg-amber-100 text-amber-900 ring-2 ring-amber-400'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200']"
                @click="selectMode && toggleBulkSelect(inv.id)">
                <!-- The chip opens the profile; in select mode it picks the person
                     instead, which is what `disabled` turns off. -->
                <PersonNameLink :person="inv.person" :person-id="inv.person_id" :disabled="selectMode"
                  class="inline-flex items-center gap-1.5 text-inherit no-underline hover:underline">
                  <!-- Their RSVP, if they've given one. No icon = hasn't replied yet. -->
                  <i v-if="rsvpState(inv)" v-tooltip.top="rsvpState(inv) === 'yes' ? 'Coming' : 'Not coming'"
                    class="pi text-xs"
                    :class="rsvpState(inv) === 'yes'
                      ? (bulkSelected.includes(inv.id) ? 'pi-check-circle text-white' : 'pi-check-circle text-emerald-600')
                      : (bulkSelected.includes(inv.id) ? 'pi-times-circle text-white/70' : 'pi-times-circle text-gray-400')" />
                  {{ inv.person?.first_name }} {{ inv.person?.last_name }}
                  <span v-if="inviteeRole(inv) !== 'attendee'" class="text-[10px] px-1.5 py-0.5 rounded-full bg-[#2494D2]/15 text-[#2494D2] font-semibold">{{ eventRoleLabel(inviteeRole(inv)) }}</span>
                  <span v-if="inv.club_org_id && inv.club_org_id !== orgId" class="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600">from {{ clubNameById.get(inv.club_org_id) ?? 'club' }}</span>
                </PersonNameLink>
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
          </template>
        </template>

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
                class="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-sm transition-colors select-none"
                :class="[selectMode ? 'cursor-pointer' : '',
                  bulkSelected.includes(inv.id) ? 'bg-primary text-white'
                  : flashedPersonId === inv.person_id ? 'bg-emerald-100 text-emerald-900 ring-2 ring-emerald-400'
                  : isPillHighlighted(inv) ? 'bg-amber-100 text-amber-900 ring-2 ring-amber-400'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200']"
                @click="selectMode && toggleBulkSelect(inv.id)">
                <!-- The chip opens the profile; in select mode it picks the person
                     instead, which is what `disabled` turns off. -->
                <PersonNameLink :person="inv.person" :person-id="inv.person_id" :disabled="selectMode"
                  class="inline-flex items-center gap-1.5 text-inherit no-underline hover:underline">
                  <!-- Their RSVP, if they've given one. No icon = hasn't replied yet. -->
                  <i v-if="rsvpState(inv)" v-tooltip.top="rsvpState(inv) === 'yes' ? 'Coming' : 'Not coming'"
                    class="pi text-xs"
                    :class="rsvpState(inv) === 'yes'
                      ? (bulkSelected.includes(inv.id) ? 'pi-check-circle text-white' : 'pi-check-circle text-emerald-600')
                      : (bulkSelected.includes(inv.id) ? 'pi-times-circle text-white/70' : 'pi-times-circle text-gray-400')" />
                  {{ inv.person?.first_name }} {{ inv.person?.last_name }}
                  <span v-if="inviteeRole(inv) !== 'attendee'" class="text-[10px] px-1.5 py-0.5 rounded-full bg-[#2494D2]/15 text-[#2494D2] font-semibold">{{ eventRoleLabel(inviteeRole(inv)) }}</span>
                  <span v-if="inv.club_org_id && inv.club_org_id !== orgId" class="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600">from {{ clubNameById.get(inv.club_org_id) ?? 'club' }}</span>
                </PersonNameLink>
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

    <!-- Recurring group add — this occurrence or this + every following one -->
    <Dialog v-model:visible="groupScopeOpen" modal :draggable="false" header="Add to the series?" :style="{ width: '95vw', maxWidth: '440px' }">
      <p class="text-sm text-gray-600 mb-3">This event repeats. Add
        <span class="font-medium text-gray-900">{{ allMemberGroups.find(g => g.id === pendingGroupAdd?.groupId)?.name || 'this class' }}</span>
        to just this occurrence, or this and every following one?</p>
      <div class="space-y-1.5">
        <label v-for="opt in [
          { value: 'this', label: 'This event only', desc: 'Just this occurrence' },
          { value: 'following', label: 'This and following events', desc: 'This occurrence and every later one in the series' },
        ]" :key="opt.value"
          class="flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors"
          :class="groupScope === opt.value ? 'border-primary bg-primary/5' : 'border-gray-200 hover:bg-gray-50'">
          <RadioButton v-model="groupScope" :value="opt.value" :inputId="`grpscope-${opt.value}`" class="mt-0.5" />
          <span class="min-w-0">
            <span class="block text-sm font-medium text-gray-800">{{ opt.label }}</span>
            <span class="block text-xs text-gray-500">{{ opt.desc }}</span>
          </span>
        </label>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text size="small" @click="groupScopeOpen = false" />
        <Button label="Add" icon="pi pi-check" size="small"
          style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="confirmGroupScope" />
      </template>
    </Dialog>

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
  /** When set (a SHARED event), scope invitees to THIS club: new invitees are stamped
      with it and the list shows only this club's invitees. Null = the owner's full list. */
  clubOrgId?: string | null
}>(), { showInvite: true, clubOrgId: null })

const eventsApi = useEventsApi()
const peopleApi = usePeopleApi()
const groupsApi = useGroupsApi()
const toast = useToast()

// Invitees carry only a personId over the seam; names/emails come from the people
// directory, loaded once and joined client-side (the old query joined persons inline).
const personById = ref<Map<string, any>>(new Map())
async function loadPeople() {
  const people = await peopleApi.list(orgId.value)
  personById.value = new Map(people.map(p => [p.id, p]))
}
// Map a seam Invitee (camelCase, no person join) back to the snake_case shape the
// template reads, attaching the joined person.
function toInviteeRow(inv: any) {
  // Prefer the SERVER-joined person (resolves names cross-org, e.g. a club's people on
  // an NSO event); fall back to the same-org map for the optimistic pre-reload window.
  const p = inv.person ?? (inv.personId ? personById.value.get(inv.personId) : null)
  return {
    id: inv.id,
    person_id: inv.personId,
    invited_via_group_id: inv.invitedViaGroupId ?? null,
    status: inv.status,
    roles: inv.roles ?? [],
    role: inv.roles?.[0] ?? null,
    attended: inv.attended,
    responded_at: inv.respondedAt,
    club_org_id: inv.clubOrgId ?? null,
    // legacy_person_id has to survive this narrowing: it is what points a name at the
    // OLD platform's profile while we are embedded in it. Dropping it here made every
    // chip fall back to our own /people/:id, which inside the frame opens the module
    // inside itself.
    person: p ? {
      id: p.id, first_name: p.firstName, last_name: p.lastName, email: p.email,
      legacy_person_id: p.legacyPersonId ?? p.legacy_person_id ?? null,
    } : null,
  }
}
// Resolve club_org_id → club name for the "from {club}" chip on cross-club invitees.
const clubNameById = ref<Map<string, string>>(new Map())
async function ensureClubNames() {
  // Seed from the already-loaded org invitees (they carry the resolved orgName).
  for (const o of orgInvitees.value) if (o.orgId && o.orgName) clubNameById.value.set(o.orgId, o.orgName)
  const missing = [...new Set(invitees.value
    .map(i => i.club_org_id)
    .filter((x: any): x is string => !!x && x !== orgId.value && !clubNameById.value.has(x)))]
  if (missing.length) {
    const orgs = await Promise.all(missing.map(mid => orgsApi.get(mid).catch(() => null)))
    orgs.forEach((o, i) => { if (o?.name) clubNameById.value.set(missing[i], o.name) })
  }
}

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

// Recurrence — so a group add can offer "this occurrence" vs "this + every following".
const eventRow = ref<any>(null)
const isRecurring = computed(() => !!(eventRow.value?.recurrenceRule || eventRow.value?.recurrenceParentId))
async function loadEventRow() { eventRow.value = await eventsApi.get(props.eventId).catch(() => null) }
// Scope dialog state for a recurring group add.
const groupScopeOpen = ref(false)
const groupScope = ref<'this' | 'following'>('following')
const pendingGroupAdd = ref<{ groupId: string; who: 'all' | 'members' | 'staff' } | null>(null)

async function loadInvitees() {
  inviteesLoading.value = true
  // inviteesWithPerson joins persons server-side (cross-org names) + carries clubOrgId.
  const rows = await eventsApi.inviteesWithPerson(props.eventId, props.clubOrgId)
  invitees.value = rows.map(toInviteeRow)
  rebuildGroupsFromInvitees()
  inviteesLoading.value = false
  ensureClubNames()
}

// The "invited via {class}" grouping is now PERSISTED on each invitee row
// (invited_via_group_id), so it survives a reload regardless of current membership.
// Rebuild the local display maps from that stored field.
function rebuildGroupsFromInvitees() {
  const map: Record<string, string[]> = {}
  for (const i of invitees.value) {
    const g = i.invited_via_group_id
    if (!g) continue
    ;(map[g] ??= []).push(i.person_id)
  }
  groupMembershipsMap.value = map
  selectedInviteeGroups.value = Object.keys(map)
}

async function removeInvitee(inviteeId: string) {
  await eventsApi.removeInvitee(inviteeId)
  toast.add({ severity: 'success', summary: 'Invitee removed', life: 3000 })
  loadInvitees()
}

function isAlreadyInvited(personId: string) {
  return invitees.value.some(i => i.person_id === personId)
}

async function addIndividual(person: any) {
  if (isAlreadyInvited(person.id)) return
  addingPersonId.value = person.id
  try {
    await eventsApi.addInvitee(props.eventId, { personId: person.id, status: 'INVITED', role: 'attendee', roles: ['attendee'], clubOrgId: props.clubOrgId })
    // Keep the just-added person available for the name-join before reload.
    if (person.id && !personById.value.has(person.id)) {
      personById.value.set(person.id, { id: person.id, firstName: person.first_name, lastName: person.last_name, email: person.email ?? null })
    }
    await loadInvitees()
    toast.add({ severity: 'success', summary: `${person.first_name} ${person.last_name} added`, life: 3000 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e?.data?.message ?? e?.message, life: 4000 })
  }
  addingPersonId.value = null
}

// "Add all N" from the filter results. Anyone already invited is skipped (the old
// upsert ignored duplicates; here we filter first, then add each fresh one).
async function addManyIndividuals(people: any[]) {
  const fresh = people.filter(p => !isAlreadyInvited(p.id))
  if (!fresh.length) return
  try {
    for (const p of fresh) {
      await eventsApi.addInvitee(props.eventId, { personId: p.id, status: 'INVITED', role: 'attendee', roles: ['attendee'], clubOrgId: props.clubOrgId })
      if (p.id && !personById.value.has(p.id)) {
        personById.value.set(p.id, { id: p.id, firstName: p.first_name, lastName: p.last_name, email: p.email ?? null })
      }
    }
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e?.data?.message ?? e?.message, life: 4000 })
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
  const groups = await groupsApi.list(orgId.value)
  // termId comes along so the invited list can be grouped by term — see invitedByTerm.
  allMemberGroups.value = groups.map(g => ({ id: g.id, name: g.name, color: g.color, parent_id: g.parentId, code_id: g.codeId, term_id: g.termId }))
}

// ── Invited classes, grouped by TERM ────────────────────────────────────────
// A class belongs to a term, and the same class runs again next term under the same
// name — so a flat list showed "Under 8s" twice with nothing to tell them apart.
// Nesting them under their term is the only thing that makes the list readable.
const gc = useGroupCodes()
const codesById = ref<Record<string, any>>({})
const termNames = ref<Record<string, string>>({})
async function loadTermContext() {
  const [codes, terms] = await Promise.all([
    gc.loadCodes().catch(() => [] as any[]),
    useTermsMemberships().loadTerms(orgId.value).catch(() => [] as any[]),
  ])
  codesById.value = Object.fromEntries((codes as any[]).map(c => [c.id, c]))
  termNames.value = Object.fromEntries((terms as any[]).map(t => [t.id, t.name]))
}

/** A class's term: its own, else inherited from its code chain. */
function termOfGroup(groupId: string): string | null {
  const g = allMemberGroups.value.find(x => x.id === groupId)
  if (!g) return null
  return gc.effectiveTermId(g, codesById.value) ?? g.term_id ?? null
}

/**
 * The invited classes as term sections. Terms in their own order, then anything with
 * no term — an event can invite a class that isn't term-bound, and it must not vanish.
 */
const invitedByTerm = computed(() => {
  const withPeople = selectedInviteeGroups.value.filter(g => groupInvitees(g).length > 0)
  const buckets = new Map<string, { termId: string | null; name: string; groupIds: string[] }>()
  for (const gid of withPeople) {
    const tid = termOfGroup(gid)
    const key = tid ?? '__none'
    if (!buckets.has(key)) buckets.set(key, { termId: tid, name: tid ? (termNames.value[tid] || 'Term') : 'No term', groupIds: [] })
    buckets.get(key)!.groupIds.push(gid)
  }
  // Named terms first, in the order the club lists them; "No term" last.
  const order = Object.keys(termNames.value)
  return [...buckets.values()].sort((a, b) => {
    if (!a.termId) return 1
    if (!b.termId) return -1
    return order.indexOf(a.termId) - order.indexOf(b.termId)
  })
})
/** One term section on its own is just noise — only nest when there's more than one. */
const showTermSections = computed(() => invitedByTerm.value.length > 1)
const collapsedTerms = reactive<Record<string, boolean>>({})

// The selector hands back the ids; adding/removing invitees is our job.
async function toggleWholeCode(groupIds: string[], adding: boolean, who: 'all' | 'members' | 'staff' = 'all') {
  for (const id of groupIds) {
    const already = selectedInviteeGroups.value.includes(id)
    // A narrowed add (members/staff only) always runs — the class may already be
    // added "as members" and you're now pulling its coaches in too.
    // Whole-code adds don't prompt per group — on a repeating event they default to
    // every following occurrence (a per-group dialog on a code fan-out would be N popups).
    if (who !== 'all' || adding !== already) await toggleSelectorGroup(id, who, isRecurring.value ? 'following' : undefined)
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

async function toggleSelectorGroup(value: string, who: 'all' | 'members' | 'staff' = 'all', scope?: 'this' | 'following') {
  await addGroupInvitees(value, who, scope)
}

async function addGroupInvitees(groupId: string, who: 'all' | 'members' | 'staff' = 'all', scope?: 'this' | 'following') {
  // A recurring event asks: add to just this occurrence, or this + every following one?
  if (isRecurring.value && !scope) {
    pendingGroupAdd.value = { groupId, who }
    groupScope.value = 'following'
    groupScopeOpen.value = true
    return
  }
  addingGroupId.value = groupId

  // <PeopleSelector> emits leaf group ids (group nesting moved to group_codes in
  // migration 206, so member_groups.parent_id is retired) — read the group directly.
  const groupIds = [groupId]

  // One memberships read per group (the seam is per-group), flattened + normalised
  // back to the { person_id, roles, role } shape this function expects.
  const perGroup = await Promise.all(groupIds.map(gid => groupsApi.memberships(gid)))
  const allMemberships = perGroup.flat().map((m: any) => ({ person_id: m.personId, roles: m.roles, role: m.role }))
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
    .map(pid => { const role = eventRoleByPerson[pid] || 'attendee'; return { personId: pid, status: 'INVITED', role, roles: [role], clubOrgId: props.clubOrgId, invitedViaGroupId: groupId } })

  if (toInsert.length) {
    try {
      for (const inv of toInsert) await eventsApi.addInvitee(props.eventId, inv)
    } catch (e: any) {
      toast.add({ severity: 'error', summary: 'Error', detail: e?.data?.message ?? e?.message, life: 4000 })
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
  // Chosen "this and following": add the same people to every later occurrence too.
  if (scope === 'following') { await addGroupToFollowing(groupId, personIds, eventRoleByPerson); await loadInvitees() }
  addingGroupId.value = null
}

// Add a group's people to every occurrence at or after this one (excluding this one,
// which the caller already handled). Best-effort per event — dups just no-op.
async function addGroupToFollowing(groupId: string, personIds: string[], eventRoleByPerson: Record<string, string>) {
  const master = eventRow.value?.recurrenceParentId || props.eventId
  const rows = await eventsApi.series(master).catch(() => [] as any[])
  const cur = eventRow.value?.startAt || null
  const ids = rows
    .filter((r: any) => r.id !== props.eventId && (!cur || !r.startAt || r.startAt >= cur))
    .map((r: any) => r.id)
  for (const eid of ids) {
    for (const pid of personIds) {
      const role = eventRoleByPerson[pid] || 'attendee'
      try { await eventsApi.addInvitee(eid, { personId: pid, status: 'INVITED', role, roles: [role], clubOrgId: props.clubOrgId, invitedViaGroupId: groupId }) } catch { /* dup/no-op */ }
    }
  }
}
async function confirmGroupScope() {
  const pending = pendingGroupAdd.value
  groupScopeOpen.value = false
  if (!pending) return
  await addGroupInvitees(pending.groupId, pending.who, groupScope.value)
  pendingGroupAdd.value = null
}

async function removeGroup(groupId: string) {
  const personIds = groupMembershipsMap.value[groupId] ?? []
  const toDelete = invitees.value.filter(i => personIds.includes(i.person_id)).map(i => i.id)
  if (toDelete.length) {
    for (const id of toDelete) await eventsApi.removeInvitee(id)
    await loadInvitees()
  }
  const idx = selectedInviteeGroups.value.indexOf(groupId)
  if (idx >= 0) selectedInviteeGroups.value.splice(idx, 1)
  delete groupMembershipsMap.value[groupId]
  // No toast — the section vanishing IS the confirmation (same rule as adding).
}

// ---- Bulk selection ----
/**
 * Picking people for a bulk action is a MODE, turned on by the Select button.
 *
 * A plain click on a chip opens that person's profile, so the two behaviours were
 * competing for the same gesture — and selection won every time, which made the
 * names unreachable. Off by default: opening a profile is the common act, running
 * an action over several people is the deliberate one.
 */
const selectMode = ref(false)
const bulkSelected = ref<string[]>([])
const bulkDeleting = ref(false)

/** Leaving the mode drops the selection — a hidden one would act on the next run. */
function toggleSelectMode() {
  selectMode.value = !selectMode.value
  if (!selectMode.value) bulkSelected.value = []
}

function toggleBulkSelect(id: string) {
  const i = bulkSelected.value.indexOf(id)
  i >= 0 ? bulkSelected.value.splice(i, 1) : bulkSelected.value.push(id)
}

async function bulkDelete() {
  if (!bulkSelected.value.length) return
  bulkDeleting.value = true
  try {
    const n = bulkSelected.value.length
    for (const id of bulkSelected.value) await eventsApi.removeInvitee(id)
    toast.add({ severity: 'success', summary: `${n} invitee${n > 1 ? 's' : ''} removed`, life: 3000 })
    bulkSelected.value = []
    loadInvitees()
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e?.data?.message ?? e?.message, life: 4000 })
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

// ---- Invited clubs (governing-org "Clubs" tab) ----
// A body can invite a whole affiliated club to an event. Persisted first-class in
// event_org_invitees (not fanned out to people), independent of the people list.
const orgsApi = useOrganisationsApi()
const isGoverning = ref(false)
const orgInvitees = ref<any[]>([])
// Optionally scope invites to ONE of the EVENT'S OWN linked disciplines. The chosen
// scope applies to every club added after it (a body usually shares one event to many
// clubs for the same discipline). Null = whole event.
const inviteDiscipline = ref<string | null>(null)
const eventDisciplineOptions = ref<{ label: string; value: string | null }[]>([{ label: 'Whole event', value: null }])
async function loadEventDisciplineOptions() {
  if (!isGoverning.value) return
  try {
    const [ids, { flat }] = await Promise.all([
      eventsApi.eventDisciplineIds(props.eventId),
      useReachableDisciplines().load('event'),
    ])
    const nameById = new Map(flat.map(d => [d.id, d.name]))
    const linked = ids.filter(id => nameById.has(id)).map(id => ({ label: nameById.get(id)!, value: id as string | null }))
    eventDisciplineOptions.value = [{ label: 'Whole event', value: null }, ...linked]
    // Scope no longer valid (discipline unlinked) → fall back to whole event.
    if (inviteDiscipline.value && !linked.some(o => o.value === inviteDiscipline.value)) inviteDiscipline.value = null
  } catch { eventDisciplineOptions.value = [{ label: 'Whole event', value: null }] }
}
async function loadOrgInvitees() {
  if (!isGoverning.value) return
  orgInvitees.value = await eventsApi.orgInvitees(props.eventId)
}
async function addOrg(club: { id: string; name: string; sport?: string; bodyName?: string }) {
  if (orgInvitees.value.some(o => o.orgId === club.id)) { flashOrg(club.id); return }
  try {
    await eventsApi.addOrgInvitee({ eventId: props.eventId, orgId: club.id, invitedByOrgId: orgId.value, status: 'INVITED', disciplineId: inviteDiscipline.value })
    await loadOrgInvitees()   // no toast — the club chip appearing IS the feedback
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e?.data?.message ?? e?.message, life: 4000 })
  }
}
async function removeOrg(id: string) {
  await eventsApi.removeOrgInvitee(id)
  await loadOrgInvitees()
}
// Re-adding an already-invited club flashes its chip (mirrors flashPerson).
const flashedOrgId = ref<string | null>(null)
let orgFlashTimer: ReturnType<typeof setTimeout> | null = null
function flashOrg(id: string) {
  if (orgFlashTimer) clearTimeout(orgFlashTimer)
  flashedOrgId.value = id
  orgFlashTimer = setTimeout(() => (flashedOrgId.value = null), 900)
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
  copyText(rows.join('\n'))
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
  // "Send Message" / "Send Email" were dead no-ops (empty TODO commands) — hidden
  // until a real comms send is wired (event comms pipeline is a follow-up).
  { label: 'Copy RSVP links', icon: 'pi pi-link', command: () => copyRsvpLinks() },
  { separator: true },
  { label: 'Delete Selected', icon: 'pi pi-trash', command: () => bulkDelete() },
]

// NOTE: the old "Filter by Demographics" dialog lived here and was a LIE — its
// criteria (gender / age / membership / registration status) were never applied
// to anything; they only lit up a count badge. The real one now lives in
// <PeopleSelector>, where it queries persons and hands back the actual list of
// matching people to add.

onMounted(async () => {
  scoped.loadRoleDefs()
  loadMemberGroups()
  loadTermContext()   // codes + term names, so invited classes can nest under their term
  loadEventRow()
  // People power the name-join on each invitee pill — load them before the invitees.
  await loadPeople()
  loadInvitees()
  // Only a governing body can invite whole affiliated clubs.
  try {
    const o = await orgsApi.get(orgId.value)
    isGoverning.value = isGoverningBody((o as any)?.orgLevel)
    if (isGoverning.value) { loadOrgInvitees(); loadEventDisciplineOptions() }
  } catch { /* non-fatal — clubs tab just stays hidden */ }
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
