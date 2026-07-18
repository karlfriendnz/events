// DELETE /api/v1/bookable-configurations/:id — remove a configuration + its children.
import { deleteConfiguration } from '../../../db/repositories/bookings'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteConfiguration(id)
  return { ok: true }
})
