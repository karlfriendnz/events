// DELETE /api/v1/groups/:id
import { deleteGroup } from '../../../db/repositories/groups'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteGroup(id)
  return { ok: true }
})
