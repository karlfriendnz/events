// DELETE /api/v1/entities/:id
import { deleteEntity } from '../../../db/repositories/circles'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteEntity(id)
  return { ok: true }
})
