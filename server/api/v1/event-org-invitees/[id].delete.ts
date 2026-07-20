// DELETE /api/v1/event-org-invitees/:id — un-invite a club.
import { deleteEventOrgInvitee } from '../../../db/repositories/events'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteEventOrgInvitee(id)
  return { ok: true }
})
