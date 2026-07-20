<!--
  A club's view of an event SHARED to it by a governing body. The event is read-only
  (the club doesn't own it), but the club invites ITS OWN people and manages them across
  tabs — Invitees / Communication / Attendance / Reporting — all scoped to the club via
  :club-org-id, so it only ever sees its own invitees.
-->
<script setup lang="ts">
const route = useRoute()
const { orgId } = useOrg()
const eventsApi = useEventsApi()

const id = route.params.id as string
const event = ref<any>(null)
const loading = ref(true)
const activeTab = ref<'invitees' | 'communication' | 'attendance' | 'reporting'>('invitees')

const TABS = [
  { k: 'invitees', l: 'Invitees', i: 'pi-users' },
  { k: 'communication', l: 'Communication', i: 'pi-envelope' },
  { k: 'attendance', l: 'Attendance', i: 'pi-check-square' },
  { k: 'reporting', l: 'Reporting', i: 'pi-chart-bar' },
] as const

async function load() {
  loading.value = true
  event.value = await eventsApi.get(id).catch(() => null)
  loading.value = false
}
onMounted(load)

useBreadcrumbs([{ label: 'Events', to: '/events' }, { label: () => event.value?.title || 'Shared event' } as any])

const whenLabel = computed(() => {
  const s = event.value?.startAt
  if (!s) return ''
  const d = new Date(s)
  return `${d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
})

// ── Reporting: this club's own invitees, by status ──
const clubInvitees = ref<any[]>([])
const reportLoaded = ref(false)
async function loadReport() {
  if (!orgId.value) return
  clubInvitees.value = await eventsApi.inviteesWithPerson(id, orgId.value).catch(() => [])
  reportLoaded.value = true
}
const reportStats = computed(() => {
  const rows = clubInvitees.value
  const by = (s: string) => rows.filter(r => (r.status || '').toUpperCase() === s).length
  return { total: rows.length, confirmed: by('CONFIRMED'), declined: by('DECLINED'), invited: by('INVITED') }
})
watch(activeTab, t => { if (t === 'reporting' && !reportLoaded.value) loadReport() })
</script>

<template>
  <div class="p-3 sm:p-6 max-w-5xl mx-auto space-y-4">
    <div v-if="loading" class="py-20 flex justify-center"><i class="pi pi-spin pi-spinner text-2xl text-gray-300" /></div>
    <div v-else-if="!event" class="py-20 text-center text-sm text-gray-400">This shared event is no longer available.</div>
    <template v-else>
      <!-- Read-only event hero -->
      <div class="card p-0 overflow-hidden">
        <div class="relative h-40 sm:h-56 bg-gray-100">
          <img v-if="event.bannerUrl" :src="event.bannerUrl" class="absolute inset-0 w-full h-full object-cover" />
          <div v-else class="absolute inset-0" style="background:linear-gradient(100deg,var(--brand-primary),var(--brand-primary-hover))" />
          <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div class="absolute bottom-0 left-0 right-0 p-4 sm:p-5 text-white">
            <span class="inline-flex items-center gap-1 bg-white/20 backdrop-blur text-white text-xs font-semibold px-2 py-0.5 rounded-full mb-1.5">
              <i class="pi pi-share-alt text-[10px]" /> Shared with your club
            </span>
            <h1 class="text-lg sm:text-2xl font-bold leading-tight">{{ event.title }}</h1>
            <p v-if="whenLabel" class="text-sm text-white/90 mt-0.5">{{ whenLabel }}</p>
          </div>
        </div>
        <p v-if="event.description" class="px-4 sm:px-5 py-3 text-sm text-gray-600 whitespace-pre-line">{{ event.description }}</p>
      </div>

      <!-- Tabs (quick-event layout), all scoped to this club -->
      <div class="flex items-center gap-1 border-b border-gray-200 overflow-x-auto no-scrollbar">
        <button v-for="tb in TABS" :key="tb.k"
          class="px-4 py-2 text-sm border-b-2 -mb-px flex items-center gap-1.5 transition-colors whitespace-nowrap"
          :class="activeTab === tb.k ? 'border-primary text-primary font-medium' : 'border-transparent text-gray-500 hover:text-gray-800'"
          @click="activeTab = (tb.k as any)">
          <i :class="`pi ${tb.i} text-xs`" />{{ tb.l }}
        </button>
      </div>

      <div v-show="activeTab === 'invitees'">
        <div class="flex items-center gap-2 mb-3">
          <span class="text-xs text-gray-400">Invite your own people — only your club's invitees show here.</span>
        </div>
        <EventInviteeManager v-if="orgId" :event-id="id" :club-org-id="orgId" />
      </div>

      <div v-show="activeTab === 'communication'">
        <EventCommunication v-if="orgId" :event-id="id" :club-org-id="orgId" />
      </div>

      <div v-show="activeTab === 'attendance'">
        <EventAttendance v-if="orgId" :event-id="id" :club-org-id="orgId" fit />
      </div>

      <div v-show="activeTab === 'reporting'">
        <div v-if="!reportLoaded" class="py-10 flex justify-center"><i class="pi pi-spin pi-spinner text-gray-300 text-xl" /></div>
        <div v-else class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="card p-4"><p class="text-xs text-gray-400 uppercase tracking-wide">Your invitees</p><p class="text-2xl font-bold text-gray-900 mt-1">{{ reportStats.total }}</p></div>
          <div class="card p-4"><p class="text-xs text-gray-400 uppercase tracking-wide">Confirmed</p><p class="text-2xl font-bold text-emerald-600 mt-1">{{ reportStats.confirmed }}</p></div>
          <div class="card p-4"><p class="text-xs text-gray-400 uppercase tracking-wide">Invited</p><p class="text-2xl font-bold text-amber-600 mt-1">{{ reportStats.invited }}</p></div>
          <div class="card p-4"><p class="text-xs text-gray-400 uppercase tracking-wide">Declined</p><p class="text-2xl font-bold text-rose-500 mt-1">{{ reportStats.declined }}</p></div>
        </div>
      </div>
    </template>
    <Toast />
  </div>
</template>
