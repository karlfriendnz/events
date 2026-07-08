<!--
  Self-service PORTAL home (/me). For "people" — members who manage themselves +
  their connections. Their own details, the people they look after (family /
  circles), memberships, upcoming things, and quick actions. Admins never land
  here (they get the full management app); the portal.global middleware confines
  members to portal routes.
-->
<script setup lang="ts">
definePageMeta({ layout: 'portal' })
const db = useDb()
const { orgId } = useOrg()
const user = useSupabaseUser()
const { myPersonId, resolveAccessLevel } = useAccessLevel()
const links = usePeopleLinks()

const loading = ref(true)
const me = ref<any>(null)
const iManage = ref<any[]>([])
const memberships = ref<{ name: string; role: string | null }[]>([])
const upcoming = ref<any[]>([])

async function load() {
  if (!orgId.value) return
  loading.value = true
  await resolveAccessLevel()
  const pid = myPersonId.value
  if (!pid) { me.value = null; loading.value = false; return }
  const [{ data: person }, { data: mships }] = await Promise.all([
    (db.from as any)('persons').select('id, first_name, last_name, email, phone, photo_url, membership_type').eq('id', pid).maybeSingle(),
    (db.from as any)('member_group_memberships').select('role, group:member_groups(name)').eq('person_id', pid),
  ])
  me.value = person
  memberships.value = (mships ?? []).map((m: any) => ({ name: m.group?.name ?? '—', role: m.role }))
  // people I look after (family guardianships) — only if allowed
  try {
    const circles = await links.loadCircles()
    const manageIds = links.peopleIManage(circles, pid) ?? []
    if (manageIds.length) {
      const { data: mp } = await (db.from as any)('persons').select('id, first_name, last_name, photo_url').in('id', manageIds)
      iManage.value = mp ?? []
    } else iManage.value = []
  } catch { iManage.value = [] }
  // upcoming events I'm invited to
  const { data: inv } = await (db.from as any)('invitees')
    .select('event:events(id, title, start_at)').eq('person_id', pid)
  const now = new Date().toISOString()
  upcoming.value = (inv ?? []).map((r: any) => r.event).filter((e: any) => e && e.start_at >= now)
    .sort((a: any, b: any) => a.start_at.localeCompare(b.start_at)).slice(0, 5)
  loading.value = false
}
onMounted(load)
watch(orgId, load)

function name(p: any) { return `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim() || (user.value?.email ?? 'You') }
function initials(p: any) { return `${(p?.first_name ?? ' ')[0] ?? ''}${(p?.last_name ?? ' ')[0] ?? ''}`.toUpperCase() || 'ME' }
function fmtDate(iso: string) { try { return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) } catch { return '' } }
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
          <p class="text-sm text-gray-500">Manage your details and the people you look after.</p>
        </div>
      </div>

      <!-- Quick actions -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <NuxtLink to="/account/profiles" class="card p-4 flex flex-col items-center gap-2 text-center hover:shadow-md transition-shadow">
          <span class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><i class="pi pi-user" /></span>
          <span class="text-xs font-medium text-gray-700">My profile</span>
        </NuxtLink>
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
      </div>

      <!-- People I look after -->
      <div v-if="iManage.length" class="card p-4 sm:p-5">
        <p class="text-sm font-semibold text-gray-800 mb-3">People I look after</p>
        <div class="space-y-2">
          <NuxtLink v-for="p in iManage" :key="p.id" to="/account/profiles" class="flex items-center gap-3 hover:bg-gray-50 rounded-lg p-1.5 -m-1.5">
            <span class="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 bg-primary">{{ initials(p) }}</span>
            <span class="text-sm font-medium text-gray-800">{{ name(p) }}</span>
            <i class="pi pi-angle-right text-gray-300 text-xs ml-auto" />
          </NuxtLink>
        </div>
      </div>

      <!-- My classes / memberships -->
      <div v-if="memberships.length" class="card p-4 sm:p-5">
        <p class="text-sm font-semibold text-gray-800 mb-3">My classes</p>
        <div class="space-y-1.5">
          <div v-for="(m, i) in memberships" :key="i" class="flex items-center justify-between text-sm">
            <span class="text-gray-700">{{ m.name }}</span>
            <span v-if="m.role" class="text-xs text-gray-400">{{ m.role }}</span>
          </div>
        </div>
      </div>

      <!-- Upcoming -->
      <div v-if="upcoming.length" class="card p-4 sm:p-5">
        <p class="text-sm font-semibold text-gray-800 mb-3">Coming up</p>
        <div class="space-y-2">
          <NuxtLink v-for="e in upcoming" :key="e.id" :to="`/r/event/${e.id}`" class="flex items-center gap-3 text-sm hover:bg-gray-50 rounded-lg p-1.5 -m-1.5">
            <span class="w-10 text-center shrink-0"><i class="pi pi-calendar text-primary text-xs" /></span>
            <span class="text-gray-700 flex-1 truncate">{{ e.title }}</span>
            <span class="text-xs text-gray-400 shrink-0">{{ fmtDate(e.start_at) }}</span>
          </NuxtLink>
        </div>
      </div>
    </template>
  </div>
</template>
