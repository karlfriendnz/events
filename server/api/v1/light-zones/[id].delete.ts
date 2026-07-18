// DELETE /api/v1/light-zones/:id
import { deleteLightZone } from '../../../db/repositories/bookings'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteLightZone(id)
  return { ok: true }
})
