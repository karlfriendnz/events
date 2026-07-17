// DELETE /api/v1/bookables/:id
import { deleteBookable } from '../../../db/repositories/bookings'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteBookable(id)
  return { ok: true }
})
