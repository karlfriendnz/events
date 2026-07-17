// DELETE /api/v1/discounts/:id
import { deleteDiscount } from '../../../db/repositories/finances'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteDiscount(id)
  return { ok: true }
})
