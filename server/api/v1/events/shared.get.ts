// GET /api/v1/events/shared?orgId= — events SHARED to this club, owned by another org,
// so the club's calendar can merge them in as read-only items. TWO sources, unioned:
//   1. per-event invites the club ACCEPTED (event_org_invitees)
//   2. every published event on a CALENDAR the club accepted (calendar_org_invitees)
// Deduped by event id — an event shared both ways appears once (the per-event row wins,
// it carries the discipline scope).
//   3. every event still living in the OLD FriendlyManager platform, for a club
//      whose events module is embedded there. They ride in on this feed because
//      the calendar already knows how to show an event it does not own — the
//      club sees one calendar, not "new events" and "old events" side by side.
import { listAcceptedSharedEvents, listAcceptedSharedCalendarEvents } from '../../../db/repositories/events'
import { sharedEventListSchema } from '../../../../shared/contracts/event'
import { legacyClub, legacy, legacyEventToFm } from '../../../utils/legacy'

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

  // Events still owned by the old platform. Best-effort: if the old system is
  // down or misconfigured, the club's own calendar must still render — losing
  // the legacy events is a gap, losing the whole calendar is an outage.
  const club = legacyClub()
  if (club && club.orgId === orgId) {
    try {
      const now = new Date()
      const from = new Date(now.getFullYear() - 1, 0, 1).toISOString().slice(0, 10)
      const to = new Date(now.getFullYear() + 2, 0, 1).toISOString().slice(0, 10)
      const rows = await legacy.events(club, from, to)
      const label = 'Friendly Manager'
      for (const row of rows) {
        const mapped = legacyEventToFm(row, orgId, label)
        byId.set(mapped.id, mapped as any)
      }
    } catch (e: any) {
      console.warn('[legacy] could not load events for the calendar:', e?.message || e)
    }
  }

  return sharedEventListSchema.parse([...byId.values()])
})
