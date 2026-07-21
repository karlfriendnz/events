// DELETE /api/v1/calendar-org-invitees/:id — un-share a calendar from a club.
import { deleteCalendarOrgInvitee } from '../../../db/repositories/events'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteCalendarOrgInvitee(id)
  return { ok: true }
})
