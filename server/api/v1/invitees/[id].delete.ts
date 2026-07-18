// DELETE /api/v1/invitees/:id — remove an invitee.
import { deleteInvitee } from '../../../db/repositories/events'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteInvitee(id)
  return { ok: true }
})
