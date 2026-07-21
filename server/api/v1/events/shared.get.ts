// GET /api/v1/events/shared?orgId= — events SHARED to this club, owned by another org,
// so the club's calendar can merge them in as read-only items. TWO sources, unioned:
//   1. per-event invites the club ACCEPTED (event_org_invitees)
//   2. every published event on a CALENDAR the club accepted (calendar_org_invitees)
// Deduped by event id — an event shared both ways appears once (the per-event row wins,
// it carries the discipline scope).
import { listAcceptedSharedEvents, listAcceptedSharedCalendarEvents } from '../../../db/repositories/events'
import { sharedEventListSchema } from '../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const [perEvent, perCalendar] = await Promise.all([
    listAcceptedSharedEvents(orgId),
    listAcceptedSharedCalendarEvents(orgId),
  ])
  const byId = new Map(perCalendar.map(e => [e.id, e]))
  for (const e of perEvent) byId.set(e.id, e)   // per-event wins on conflict
  return sharedEventListSchema.parse([...byId.values()])
})
