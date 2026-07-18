// DELETE /api/v1/doors/:id
import { deleteDoor } from '../../../db/repositories/bookings'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteDoor(id)
  return { ok: true }
})
