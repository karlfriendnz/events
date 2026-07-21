<!--
  The invited CLUB's inbox for incoming shares (event_org_invitees + calendar_org_invitees).
  A governing body invites a club to a single EVENT (from the event's Invitees → Clubs tab)
  or shares a whole CALENDAR (from Settings → Calendars); this is where the club sees both,
  Accepts / Declines, and — once accepted — chooses what to connect (details/required fields,
  fees, communication-as-template). Accepting a calendar surfaces all its published events on
  the club's own calendar. Self-contained by the active org; renders nothing when there's
  nothing to act on. Shown on /dashboard.
-->
<script setup lang="ts">
const { orgId } = useOrg()
const eventsApi = useEventsApi()

// Both invite kinds live in one list, tagged with `_kind` so the shared accept/decline/
// connect handlers branch on it (ids are unique uuids across both tables).
const invites = ref<any[]>([])
async function load() {
  if (!orgId.value) return
  try {
    const [evts, cals] = await Promise.all([
      eventsApi.orgInvitesForOrg(orgId.value).catch(() => [] as any[]),
      eventsApi.calendarInvitesForOrg(orgId.value).catch(() => [] as any[]),
    ])
    invites.value = [
      ...evts.map(i => ({ ...i, _kind: 'event' })),
      ...cals.map(i => ({ ...i, _kind: 'calendar' })),
    ]
  } catch { invites.value = [] }
}
onMounted(load)
watch(orgId, load)

const isCal = (inv: any) => inv._kind === 'calendar'
const pending = computed(() => invites.value.filter(i => i.status === 'INVITED'))
// A just-accepted invite stays visible ONLY until the club clicks "Done" on its
// connection choices. Accepted invites never reappear on a later dashboard load —
// the dashboard is for things needing action, not a record of past acceptances.
const configuring = ref<string[]>([])
const accepted = computed(() => invites.value.filter(i => i.status === 'ACCEPTED' && configuring.value.includes(i.id)))
const show = computed(() => pending.value.length > 0 || accepted.value.length > 0)

const CONN = [
  { key: 'event_details', label: 'Event details & required fields' },
  { key: 'fees', label: 'Fees' },
  { key: 'communication', label: 'Communication', hint: 'template only' },
]

const busy = ref<string | null>(null)
function whenLabel(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
function whenTime(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
// Descriptions are rich-text HTML — strip tags for the card snippet.
function plain(html: string | null) {
  return (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}
// A calendar has no single title/date — show its name + who shared it.
const titleOf = (inv: any) => isCal(inv) ? (inv.calendarName || 'Shared calendar') : (inv.eventTitle || 'an event')

async function respond(inv: any, patch: any) {
  busy.value = inv.id
  try {
    const res = isCal(inv)
      ? await eventsApi.respondCalendarInvite(inv.id, patch)
      : await eventsApi.respondOrgInvite(inv.id, patch)
    Object.assign(inv, res)
  } finally { busy.value = null }
}
// Accepting connects everything by default; the club tunes it, then clicks Done.
async function accept(inv: any) {
  await respond(inv, { status: 'ACCEPTED', connections: { event_details: true, fees: true, communication: true } })
  if (!configuring.value.includes(inv.id)) configuring.value.push(inv.id)
}
// Done configuring → drop it from view (it stays ACCEPTED in the DB, just hidden here).
const done = (inv: any) => { configuring.value = configuring.value.filter(id => id !== inv.id) }
const decline = (inv: any) => respond(inv, { status: 'DECLINED' })
const toggle = (inv: any, key: string) =>
  respond(inv, { connections: { ...(inv.connections || {}), [key]: !(inv.connections?.[key]) } })
</script>

<template>
  <div v-if="show" class="card p-0 overflow-hidden mb-4">
    <div class="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100">
      <i class="pi pi-envelope text-primary" />
      <span class="font-semibold text-gray-800 text-sm">Invitations</span>
      <span v-if="pending.length" class="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{{ pending.length }} new</span>
    </div>

    <!-- Pending — a rich card per invite (event: banner/title/date/desc · calendar: colour/name). -->
    <div v-if="pending.length" class="grid gap-3 p-4 sm:grid-cols-2">
      <div v-for="inv in pending" :key="inv.id" class="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm flex flex-col">
        <!-- Banner -->
        <div class="relative h-32 shrink-0" :class="isCal(inv) ? '' : 'bg-gray-100'">
          <img v-if="!isCal(inv) && inv.eventBannerUrl" :src="inv.eventBannerUrl" class="absolute inset-0 w-full h-full object-cover" />
          <div v-else class="absolute inset-0" :style="isCal(inv)
            ? `background:linear-gradient(100deg, ${inv.calendarColor || 'var(--brand-primary)'}, ${inv.calendarColor || 'var(--brand-primary-hover)'})`
            : 'background:linear-gradient(100deg,var(--brand-primary),var(--brand-primary-hover))'" />
          <i v-if="isCal(inv)" :class="['pi', inv.calendarIcon || 'pi-calendar', 'absolute right-3 bottom-3 text-white/80 text-3xl']" />
          <span class="absolute top-2 left-2 inline-flex items-center gap-1 bg-black/45 backdrop-blur text-white text-[11px] font-medium px-2 py-0.5 rounded">
            <i :class="['text-[9px]', isCal(inv) ? 'pi pi-calendar' : 'pi pi-share-alt']" /> {{ isCal(inv) ? 'Calendar share' : 'Event invite' }}
          </span>
        </div>
        <!-- Body -->
        <div class="p-3.5 flex flex-col gap-2 flex-1">
          <p class="text-sm font-bold text-gray-900 leading-tight">{{ titleOf(inv) }}</p>
          <!-- Event: date/time + description. Calendar: what accepting does. -->
          <template v-if="!isCal(inv)">
            <div class="flex items-center gap-2 text-xs text-gray-600">
              <i class="pi pi-calendar text-gray-400 text-[11px]" />
              <span>{{ whenLabel(inv.eventStartAt) || 'Date TBC' }}</span>
              <span v-if="whenTime(inv.eventStartAt)" class="text-primary font-semibold ml-auto">{{ whenTime(inv.eventStartAt) }}</span>
            </div>
            <div v-if="plain(inv.eventDescription)" class="flex items-start gap-2 text-xs text-gray-500">
              <i class="pi pi-align-left text-gray-300 text-[11px] mt-0.5 shrink-0" />
              <span class="line-clamp-2">{{ plain(inv.eventDescription) }}</span>
            </div>
            <p v-if="inv.disciplineName" class="inline-flex items-center gap-1 text-xs text-primary font-medium">
              <i class="pi pi-tag text-[10px]" /> For the {{ inv.disciplineName }} discipline
            </p>
          </template>
          <p v-else class="flex items-start gap-2 text-xs text-gray-500">
            <i class="pi pi-calendar-plus text-gray-300 text-[11px] mt-0.5 shrink-0" />
            <span>Its events appear on your calendar once you accept.</span>
          </p>
          <div class="flex items-center gap-2 flex-wrap mt-auto pt-1">
            <span v-if="!isCal(inv) && inv.eventStatus" class="inline-flex items-center bg-emerald-100 text-emerald-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide">{{ inv.eventStatus }}</span>
            <span class="text-[11px] text-gray-400 truncate">by {{ inv.invitedByOrgName || 'a governing body' }}</span>
          </div>
          <div class="flex items-center gap-2 pt-1">
            <Button label="Decline" severity="secondary" outlined size="small" class="flex-1" :disabled="busy === inv.id" @click="decline(inv)" />
            <Button label="Accept" icon="pi pi-check" size="small" class="flex-1" :loading="busy === inv.id"
              style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="accept(inv)" />
          </div>
        </div>
      </div>
    </div>

    <!-- Accepted — clearly accepted, then choose what's connected -->
    <div v-for="inv in accepted" :key="inv.id" class="px-4 py-4 border-b border-gray-50 last:border-0">
      <div class="flex items-center justify-between gap-2 mb-3">
        <div class="flex items-center gap-2 min-w-0">
          <span class="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0">
            <i class="pi pi-check text-[10px]" /> Accepted
          </span>
          <p class="text-sm text-gray-800 truncate">
            <span class="font-medium">{{ titleOf(inv) }}</span>
            <span class="text-gray-400"> · {{ inv.invitedByOrgName }}</span>
          </p>
        </div>
        <button class="text-xs text-gray-400 hover:text-rose-500 shrink-0" :disabled="busy === inv.id" @click="decline(inv)">Decline instead</button>
      </div>
      <p v-if="!isCal(inv) && inv.disciplineName" class="inline-flex items-center gap-1 text-xs text-primary font-medium mb-2">
        <i class="pi pi-tag text-[10px]" /> For the {{ inv.disciplineName }} discipline
      </p>
      <p class="text-xs font-medium text-gray-600 mb-2">Choose what to connect from {{ isCal(inv) ? 'this calendar' : 'this event' }}:</p>
      <div class="flex flex-col gap-1.5">
        <label v-for="c in CONN" :key="c.key" class="flex items-center gap-2.5 text-sm text-gray-700 cursor-pointer">
          <ToggleSwitch :model-value="!!inv.connections?.[c.key]" :disabled="busy === inv.id" @update:model-value="toggle(inv, c.key)" />
          <span>{{ c.label }}</span>
          <span v-if="c.hint" class="text-xs text-gray-400">({{ c.hint }})</span>
        </label>
      </div>
      <div class="flex justify-end mt-3">
        <Button label="Done" icon="pi pi-check" size="small" :disabled="busy === inv.id"
          style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="done(inv)" />
      </div>
    </div>
  </div>
</template>
