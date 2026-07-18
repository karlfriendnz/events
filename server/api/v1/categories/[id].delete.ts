// DELETE /api/v1/categories/:id — remove an event category.
import { deleteCategory } from '../../../db/repositories/events'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteCategory(id)
  return { ok: true }
})
