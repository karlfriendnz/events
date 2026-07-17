// DELETE /api/v1/group-codes/:id
import { deleteCode } from '../../../db/repositories/groups'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteCode(id)
  return { ok: true }
})
