// GET /api/v1/event-org-invitees?eventId=…  — the clubs invited to an event (host view).
// GET /api/v1/event-org-invitees?orgId=…    — the invitations aimed at a club (club view,
//                                              with event + inviting-body names joined).
import { listEventOrgInvitees, listEventOrgInvitesForClub } from '../../../db/repositories/events'
import { eventOrgInviteeListSchema, eventOrgInviteForClubListSchema } from '../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const eventId = q.eventId as string | undefined
  const orgId = q.orgId as string | undefined
  if (orgId) return eventOrgInviteForClubListSchema.parse(await listEventOrgInvitesForClub(orgId))
  if (eventId) return eventOrgInviteeListSchema.parse(await listEventOrgInvitees(eventId))
  throw createError({ statusCode: 400, statusMessage: 'eventId or orgId required' })
})
