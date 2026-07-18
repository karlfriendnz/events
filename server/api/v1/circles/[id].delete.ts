// DELETE /api/v1/circles/:id — delete a circle (unlinks everyone in it first).
import { deleteCircle } from '../../../db/repositories/circles'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteCircle(id)
  return { ok: true }
})
