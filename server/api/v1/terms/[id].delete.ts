// DELETE /api/v1/terms/:id
import { deleteTerm } from '../../../db/repositories/memberships'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteTerm(id)
  return { ok: true }
})
