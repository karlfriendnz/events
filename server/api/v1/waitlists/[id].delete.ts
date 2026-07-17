// DELETE /api/v1/waitlists/:id
import { deleteWaitlist } from '../../../db/repositories/waitlists'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteWaitlist(id)
  return { ok: true }
})
