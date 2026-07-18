<!--
  Self-service PORTAL home (/me). For "people" — members who manage themselves +
  their connections. Renders the club-configured member dashboard (the same
  <ProfileDashboard> widgets an admin sees on a profile's Dashboard tab) against
  the logged-in member's own data, plus quick actions. Admins never land here.
-->
<script setup lang="ts">
definePageMeta({ layout: 'portal' })
// The member-portal build of the profile Dashboard bundle — every read below is
// another domain's, all now on the seam: persons (people), member_group_memberships +
// group (groups), registrations (finances), invitees + events (events),
// person_notes (circles), organisations.profile_dashboard (settings) +
// person_target_types.profile_dashboard (person-types).
// Every read/write below is on the seam.
const { orgId } = useOrg()
const user = useSupabaseUser()
const { myPersonId, resolveAccessLevel } = useAccessLevel()
const { CORE_FIELDS } = usePersonFields()
const { resolveFields, fieldAppliesTo } = useOrgFieldPolicy()
const peopleApi = usePeopleApi()
const groupsApi = useGroupsApi()
const eventsApi = useEventsApi()
const circlesApi = useCirclesApi()
const orgsApi = useOrganisationsApi()
const personTypesApi = usePersonTypesApi()
const financesApi = useFinancesApi()

// Map a seam PersonNote (camelCase) to the snake shape <ProfileDashboard> reads.
function toNoteRow(n: any) {
  return {
    id: n.id, org_id: n.orgId, person_id: n.personId, body: n.body, tags: n.tags,
    channel: n.channel, author_id: n.authorId, author_name: n.authorName, links: n.links,
    visibility: n.visibility, visible_to: n.visibleTo, is_important: n.isImportant,
    due_date: n.dueDate, created_at: n.createdAt,
  }
}

const loading = ref(true)
const me = ref<any>(null)
const memberships = ref<any[]>([])
const financials = ref<any[]>([])
const communications = ref<any[]>([])
const notes = ref<any[]>([])
const activity = ref<any[]>([])
const customFields = ref<any[]>([])
const dashConfig = ref<any>(null)

const fieldCatalogue = computed(() => [
  ...CORE_FIELDS,
  ...customFields.value.map((f: any) => ({ key: f.id, label: f.label, source: 'custom', field_type: f.field_type })),
])
const dashBundle = computed(() => ({
  person: me.value || {},
  memberships: memberships.value,
  financials: financials.value,
  communications: communications.value,
  parents: [],
  activity: activity.value,
  activityFeed: [],
  notes: notes.value,
}))

async function load() {
  if (!orgId.value) return
  loading.value = true
  await resolveAccessLevel()
  const pid = myPersonId.value
  if (!pid) { me.value = null; loading.value = false; return }
  // Seam reads: person, this person's memberships, their event invitees, their notes,
  // the club-default profile dashboard, the field catalogue + their registrations.
  const [personDomain, mships, groupList, inv, notesDomain, orgMeta, defs, regs] = await Promise.all([
    peopleApi.get(pid).catch(() => null),
    groupsApi.membershipsForPerson(orgId.value as string, pid),
    groupsApi.list(orgId.value as string),
    eventsApi.inviteesForPerson(pid),
    circlesApi.notes(pid),
    orgsApi.getDashboardMeta(orgId.value as string).catch(() => null),
    resolveFields(orgId.value),
    // The financials widget sums (total − paid) across this person's registrations.
    financesApi.registrationsForPerson(pid).catch(() => []),
  ])
  const person = personDomain ? {
    id: personDomain.id, first_name: personDomain.firstName, last_name: personDomain.lastName,
    email: personDomain.email, phone: personDomain.phone, photo_url: personDomain.photoUrl,
    membership_type: personDomain.membershipType, person_type: personDomain.personType,
    person_types: personDomain.personTypes, dob: personDomain.dob, gender: personDomain.gender,
    custom_fields: personDomain.customFields,
  } : null
  me.value = person
  const groupById: Record<string, any> = Object.fromEntries(groupList.map(g => [g.id, g]))
  memberships.value = mships.map((m: any) => {
    const g = groupById[m.groupId]
    return { id: m.groupId, group: g?.name || 'Class', color: g?.color, role: m.role || '', expiry: '' }
  })
  financials.value = regs.map((r) => ({ id: r.id, amount: r.totalAmount, paid: r.paidAmount, status: r.status, outstanding: (Number(r.totalAmount) || 0) - (Number(r.paidAmount) || 0) }))
  communications.value = inv.map((r: any) => ({ id: r.eventId, title: r.eventTitle, date: r.eventStartAt, status: r.status }))
  activity.value = inv.map((r: any) => ({ id: r.eventId, title: r.eventTitle, date: r.eventStartAt }))
  notes.value = notesDomain.map(toNoteRow)
  // custom fields that apply to this member + the profile-dashboard layout for their type
  const ptypes = (person?.person_types?.length ? person.person_types : [person?.person_type]).filter(Boolean)
  customFields.value = (defs ?? []).filter((f: any) => ptypes.some((t: string) => fieldAppliesTo(f, t)))
  let cfg = orgMeta?.profileDashboard ?? null
  if (ptypes[0]) {
    const types = await personTypesApi.listTypes(orgId.value).catch(() => [])
    const tt = types.find((t: any) => t.key === ptypes[0])
    cfg = tt?.profileDashboard ?? cfg
  }
  dashConfig.value = cfg
  loading.value = false
}
onMounted(load)
watch(orgId, load)

function initials(p: any) { return `${(p?.first_name ?? ' ')[0] ?? ''}${(p?.last_name ?? ' ')[0] ?? ''}`.toUpperCase() || 'ME' }

// notes create/delete (live)
async function createNote(payload: any) {
  const pid = myPersonId.value; if (!pid) return
  const body = typeof payload === 'string' ? payload : payload?.body
  if (!body?.trim()) return
  const created = await peopleApi.addNote({ orgId: orgId.value as string, personId: pid, body: body.trim(), links: payload?.links ?? [] })
  if (created) notes.value = [toNoteRow(created), ...notes.value]
}
async function removeNote(id: string) {
  await peopleApi.removeNote(id)
  notes.value = notes.value.filter(n => n.id !== id)
}
</script>

<template>
  <div class="space-y-5">
    <div v-if="loading" class="card p-16 text-center text-gray-400"><i class="pi pi-spin pi-spinner text-2xl" /></div>
    <p v-else-if="!me" class="card p-8 text-center text-sm text-gray-500">We couldn't find your member profile. Please contact your club.</p>

    <template v-else>
      <!-- Welcome -->
      <div class="flex items-center gap-3">
        <img v-if="me.photo_url" :src="me.photo_url" class="w-14 h-14 rounded-full object-cover shrink-0" />
        <span v-else class="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-semibold shrink-0 bg-primary">{{ initials(me) }}</span>
        <div>
          <h1 class="text-lg sm:text-2xl font-semibold text-gray-900">Hi {{ me.first_name || 'there' }}</h1>
          <p class="text-sm text-gray-500">Your details, classes and quick actions.</p>
        </div>
      </div>

      <!-- Quick actions -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <NuxtLink to="/account/profiles" class="card p-4 flex flex-col items-center gap-2 text-center hover:shadow-md transition-shadow">
          <span class="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center"><i class="pi pi-users" /></span>
          <span class="text-xs font-medium text-gray-700">My people</span>
        </NuxtLink>
        <NuxtLink to="/book" class="card p-4 flex flex-col items-center gap-2 text-center hover:shadow-md transition-shadow">
          <span class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center"><i class="pi pi-search" /></span>
          <span class="text-xs font-medium text-gray-700">Find a class</span>
        </NuxtLink>
        <NuxtLink to="/book" class="card p-4 flex flex-col items-center gap-2 text-center hover:shadow-md transition-shadow">
          <span class="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center"><i class="pi pi-calendar-plus" /></span>
          <span class="text-xs font-medium text-gray-700">Book</span>
        </NuxtLink>
        <NuxtLink to="/account/profiles" class="card p-4 flex flex-col items-center gap-2 text-center hover:shadow-md transition-shadow">
          <span class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><i class="pi pi-user" /></span>
          <span class="text-xs font-medium text-gray-700">My profile</span>
        </NuxtLink>
      </div>

      <!-- The club-configured member dashboard (same widgets as the profile Dashboard tab) -->
      <ProfileDashboard
        :model-value="dashConfig"
        :data="dashBundle"
        :fields="fieldCatalogue"
        live-notes
        @add-note="createNote"
        @delete-note="removeNote" />
    </template>
  </div>
</template>
