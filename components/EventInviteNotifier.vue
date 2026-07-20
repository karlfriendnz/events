<!--
  Renderless poller: watches for NEW event invitations aimed at the active club and
  pushes each one into the share-notification queue (bottom-right pop). Already-seen
  invites (localStorage) don't re-notify — they still live in the dashboard inbox.
  Mounted once in layouts/default.vue.
-->
<script setup lang="ts">
const { orgId } = useOrg()
const eventsApi = useEventsApi()
const { push } = useShareNotifications()

const SEEN_KEY = 'fm_seen_event_invites'
function seen(): string[] {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]') } catch { return [] }
}
function markSeen(ids: string[]) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-200))) } catch { /* ignore */ }
}

async function poll() {
  if (!orgId.value) return
  let invites: any[] = []
  try { invites = await eventsApi.orgInvitesForOrg(orgId.value) } catch { return }
  const pending = invites.filter(i => i.status === 'INVITED')
  const seenIds = seen()
  for (const inv of pending) {
    if (seenIds.includes(inv.id)) continue
    const from = inv.invitedByOrgName || 'A governing body'
    push({
      id: inv.id,
      kind: 'event-invite',
      title: 'New Event Shared',
      headline: inv.eventTitle || 'an event',
      message: `${from} shared an event with your club.`,
      bannerUrl: inv.eventBannerUrl ?? null,
      fromName: inv.invitedByOrgName ?? null,
      disciplineName: inv.disciplineName ?? null,
      inviteId: inv.id,
    })
  }
  // Mark every current pending invite seen so it pops once; it remains in the
  // dashboard inbox for later action.
  markSeen([...new Set([...seenIds, ...pending.map(i => i.id)])])
}

let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  poll()
  timer = setInterval(poll, 60000)
})
watch(orgId, poll)
onBeforeUnmount(() => { if (timer) clearInterval(timer) })
</script>

<template><span class="hidden" /></template>
