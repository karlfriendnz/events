// DELETE /api/v1/brands/:id — remove a brand.
import { deleteBrand } from '../../../db/repositories/admin'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id is required' })
  await deleteBrand(id)
  return { ok: true }
})
