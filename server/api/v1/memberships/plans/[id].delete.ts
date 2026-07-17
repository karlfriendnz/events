// DELETE /api/v1/memberships/plans/:id
import { deletePlan } from '../../../../db/repositories/memberships'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deletePlan(id)
  return { ok: true }
})
