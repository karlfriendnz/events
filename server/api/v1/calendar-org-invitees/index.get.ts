// GET /api/v1/calendar-org-invitees?calendarId=… — the clubs a calendar is shared with
//                                                  (host view).
// GET /api/v1/calendar-org-invitees?orgId=…       — the shared-calendar invitations aimed
//                                                    at a club (club view, calendar + sharer
//                                                    names joined).
import { listCalendarOrgInvitees, listCalendarOrgInvitesForClub } from '../../../db/repositories/events'
import { calendarOrgInviteeListSchema, calendarOrgInviteForClubListSchema } from '../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const calendarId = q.calendarId as string | undefined
  const orgId = q.orgId as string | undefined
  if (orgId) return calendarOrgInviteForClubListSchema.parse(await listCalendarOrgInvitesForClub(orgId))
  if (calendarId) return calendarOrgInviteeListSchema.parse(await listCalendarOrgInvitees(calendarId))
  throw createError({ statusCode: 400, statusMessage: 'calendarId or orgId required' })
})
