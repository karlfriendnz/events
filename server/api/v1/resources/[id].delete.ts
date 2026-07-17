// DELETE /api/v1/resources/:id
import { deleteResource } from '../../../db/repositories/resources'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteResource(id)
  return { ok: true }
})
