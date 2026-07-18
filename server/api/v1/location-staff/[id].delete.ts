// DELETE /api/v1/location-staff/:id — remove a staff grant.
import { deleteLocationStaff } from '../../../db/repositories/affiliations'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteLocationStaff(id)
  return { ok: true }
})
