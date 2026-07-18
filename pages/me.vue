<!--
  Self-service PORTAL home (/me). For "people" — members who manage themselves +
  their connections. Renders the club-configured member dashboard (the same
  <ProfileDashboard> widgets an admin sees on a profile's Dashboard tab) against
  the logged-in member's own data, plus quick actions. Admins never land here.
-->
<script setup lang="ts">
definePageMeta({ layout: 'portal' })
// SEAM GAP: this is the member-portal build of the profile Dashboard bundle, and
// every read below is another domain's — persons (people), member_group_memberships
// + group (groups), registrations (finances/events), invitees + events (events D9),
// person_notes (circles D8; writes owned by people.ts), organisations.profile_dashboard
// (settings) + person_target_types.profile_dashboard (person-types D5). It maps 1:1 to
// the dashboard-domain's still-gap-blocked D-series cross-domain seam. Left on useDb as
// a whole until that bundle exists — converting piecemeal would half-wire the page.
const db = useDb()
const { orgId } = useOrg()
const user = useSupabaseUser()
const { myPersonId, resolveAccessLevel } = useAccessLevel()
const { CORE_FIELDS } = usePersonFields()
const { resolveFields, fieldAppliesTo } = useOrgFieldPolicy()

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
  const typeKeyForDash = ref<string | null>(null)
  const [{ data: person }, { data: mships }, { data: regs }, { data: inv }, { data: notesData }, { data: orgRow }, defs] = await Promise.all([
    (db.from as any)('persons').select('id, first_name, last_name, email, phone, photo_url, membership_type, person_type, person_types, dob, gender, custom_fields').eq('id', pid).maybeSingle(),
    (db.from as any)('member_group_memberships').select('role, group:member_groups(id, name, color)').eq('person_id', pid),
    (db.from as any)('registrations').select('id, total_amount, paid_amount, status').eq('person_id', pid),
    (db.from as any)('invitees').select('event_id, status, events(title, start_at, status)').eq('person_id', pid),
    (db.from as any)('person_notes').select('*').eq('person_id', pid).order('created_at', { ascending: false }),
    (db.from as any)('organisations').select('profile_dashboard').eq('id', orgId.value).maybeSingle(),
    resolveFields(orgId.value),
  ])
  me.value = person
  memberships.value = (mships ?? []).map((m: any) => ({ id: m.group?.id, group: m.group?.name || 'Class', color: m.group?.color, role: m.role || '', expiry: '' }))
  financials.value = (regs ?? []).map((r: any) => ({ id: r.id, amount: r.total_amount, paid: r.paid_amount, status: r.status, outstanding: (Number(r.total_amount) || 0) - (Number(r.paid_amount) || 0) }))
  communications.value = (inv ?? []).filter((r: any) => r.events).map((r: any) => ({ id: r.event_id, title: r.events.title, date: r.events.start_at, status: r.status }))
  activity.value = (inv ?? []).filter((r: any) => r.events).map((r: any) => ({ id: r.event_id, title: r.events.title, date: r.events.start_at }))
  notes.value = notesData ?? []
  // custom fields that apply to this member + the profile-dashboard layout for their type
  const ptypes = (person?.person_types?.length ? person.person_types : [person?.person_type]).filter(Boolean)
  customFields.value = (defs ?? []).filter((f: any) => ptypes.some((t: string) => fieldAppliesTo(f, t)))
  let cfg = orgRow?.profile_dashboard ?? null
  if (ptypes[0]) {
    const { data: typeRow } = await (db.from as any)('person_target_types').select('profile_dashboard').eq('org_id', orgId.value).eq('key', ptypes[0]).maybeSingle()
    cfg = typeRow?.profile_dashboard ?? cfg
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
  const { data } = await (db.from as any)('person_notes').insert({ org_id: orgId.value, person_id: pid, body: body.trim(), links: payload?.links ?? [] }).select('*').maybeSingle()
  if (data) notes.value = [data, ...notes.value]
}
async function removeNote(id: string) {
  await (db.from as any)('person_notes').delete().eq('id', id)
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
