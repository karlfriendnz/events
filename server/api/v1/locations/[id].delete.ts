// DELETE /api/v1/locations/:id
import { deleteLocation } from '../../../db/repositories/affiliations'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteLocation(id)
  return { ok: true }
})
