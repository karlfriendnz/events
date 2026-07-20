// A small queue of "something was shared with your club" toasts that pop bottom-right
// (event invites today; more share types later). The queue is shared app-wide via
// useState so any poller can push and the one <ShareNotifications> renderer shows them.
export interface ShareNotification {
  id: string
  kind: 'event-invite'
  title: string              // header label, e.g. "New Event Shared"
  headline: string           // the thing shared, e.g. the event title
  message: string            // one-line body
  bannerUrl?: string | null
  fromName?: string | null
  disciplineName?: string | null
  inviteId: string           // event_org_invitees.id — for accept/decline
}

export function useShareNotifications() {
  const queue = useState<ShareNotification[]>('share-notifications', () => [])
  function push(n: ShareNotification) {
    if (queue.value.some(x => x.id === n.id)) return
    queue.value = [...queue.value, n]
  }
  function dismiss(id: string) {
    queue.value = queue.value.filter(n => n.id !== id)
  }
  return { queue, push, dismiss }
}
