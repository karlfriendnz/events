// DELETE /api/v1/events/:id
import { deleteEvent } from '../../../db/repositories/events'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteEvent(id)
  return { ok: true }
})
