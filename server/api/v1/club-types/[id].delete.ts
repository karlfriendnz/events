// DELETE /api/v1/club-types/:id — remove a club type.
import { deleteClubType } from '../../../db/repositories/admin'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id is required' })
  await deleteClubType(id)
  return { ok: true }
})
