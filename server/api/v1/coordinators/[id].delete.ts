// DELETE /api/v1/coordinators/:id — remove a coordinator from its event.
import { removeEventCoordinator } from '../../../db/repositories/events'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await removeEventCoordinator(id)
  return { ok: true }
})
