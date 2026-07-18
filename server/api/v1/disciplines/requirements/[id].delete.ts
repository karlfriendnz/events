// DELETE /api/v1/disciplines/requirements/:id — delete a single requirement row.
import { deleteRequirement } from '../../../../db/repositories/disciplines'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteRequirement(id)
  return { ok: true }
})
