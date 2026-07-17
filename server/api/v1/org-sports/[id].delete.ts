// DELETE /api/v1/org-sports/:id
import { deleteOrgSport } from '../../../db/repositories/affiliations'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteOrgSport(id)
  return { ok: true }
})
