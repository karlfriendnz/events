// DELETE /api/v1/sessions/:id
import { deleteSession } from '../../../db/repositories/events'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteSession(id)
  return { ok: true }
})
