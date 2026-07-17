// DELETE /api/v1/organisations/:id
import { deleteOrganisation } from '../../../db/repositories/organisations'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteOrganisation(id)
  return { ok: true }
})
