// DELETE /api/v1/connection-groups/:id — remove a saved invitee set (+ its event links).
import { deleteConnectionGroup } from '../../../db/repositories/events'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteConnectionGroup(id)
  return { ok: true }
})
