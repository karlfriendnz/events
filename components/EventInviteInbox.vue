<!--
  The invited CLUB's inbox for event invitations (event_org_invitees). A governing body
  invites a club to an event from the event's Invitees → Clubs tab; this is where the
  club sees it, Accepts / Declines, and — once accepted — chooses what to connect from
  the event (details/required fields, fees, communication-as-template). Self-contained
  by the active org; renders nothing when there's nothing to act on. Shown on /dashboard.
-->
<script setup lang="ts">
const { orgId } = useOrg()
const eventsApi = useEventsApi()

const invites = ref<any[]>([])
async function load() {
  if (!orgId.value) return
  try { invites.value = await eventsApi.orgInvitesForOrg(orgId.value) } catch { invites.value = [] }
}
onMounted(load)
watch(orgId, load)

const pending = computed(() => invites.value.filter(i => i.status === 'INVITED'))
// Accepted invites still needing a connection decision surface too, so the club can tune them.
const accepted = computed(() => invites.value.filter(i => i.status === 'ACCEPTED'))
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

async function respond(inv: any, patch: any) {
  busy.value = inv.id
  try { Object.assign(inv, await eventsApi.respondOrgInvite(inv.id, patch)) }
  finally { busy.value = null }
}
// Accepting connects everything by default; the club tunes it below.
const accept = (inv: any) => respond(inv, { status: 'ACCEPTED', connections: { event_details: true, fees: true, communication: true } })
const decline = (inv: any) => respond(inv, { status: 'DECLINED' })
const toggle = (inv: any, key: string) =>
  respond(inv, { connections: { ...(inv.connections || {}), [key]: !(inv.connections?.[key]) } })
</script>

<template>
  <div v-if="show" class="card p-0 overflow-hidden mb-4">
    <div class="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100">
      <i class="pi pi-envelope text-primary" />
      <span class="font-semibold text-gray-800 text-sm">Event invitations</span>
      <span v-if="pending.length" class="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{{ pending.length }} new</span>
    </div>

    <!-- Pending — accept or decline. This is the primary action. -->
    <div v-for="inv in pending" :key="inv.id" class="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-4 border-b border-gray-50 bg-amber-50/40">
      <div class="flex-1 min-w-0">
        <p class="text-sm text-gray-900">
          <span class="font-semibold">{{ inv.invitedByOrgName || 'A governing body' }}</span> has invited your club to
          <span class="font-semibold">{{ inv.eventTitle || 'an event' }}</span>
        </p>
        <p class="text-xs text-gray-500 mt-0.5">{{ inv.eventStartAt ? whenLabel(inv.eventStartAt) + ' · ' : '' }}Accept to choose what you connect.</p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <Button label="Decline" severity="secondary" outlined size="small" :disabled="busy === inv.id" @click="decline(inv)" />
        <Button label="Accept invitation" icon="pi pi-check" size="small" :loading="busy === inv.id"
          style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="accept(inv)" />
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
            <span class="font-medium">{{ inv.eventTitle || 'Event' }}</span>
            <span class="text-gray-400"> · {{ inv.invitedByOrgName }}</span>
          </p>
        </div>
        <button class="text-xs text-gray-400 hover:text-rose-500 shrink-0" :disabled="busy === inv.id" @click="decline(inv)">Decline instead</button>
      </div>
      <p class="text-xs font-medium text-gray-600 mb-2">Choose what to connect from this event:</p>
      <div class="flex flex-col gap-1.5">
        <label v-for="c in CONN" :key="c.key" class="flex items-center gap-2.5 text-sm text-gray-700 cursor-pointer">
          <ToggleSwitch :model-value="!!inv.connections?.[c.key]" :disabled="busy === inv.id" @update:model-value="toggle(inv, c.key)" />
          <span>{{ c.label }}</span>
          <span v-if="c.hint" class="text-xs text-gray-400">({{ c.hint }})</span>
        </label>
      </div>
    </div>
  </div>
</template>
