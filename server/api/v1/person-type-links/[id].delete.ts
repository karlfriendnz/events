// DELETE /api/v1/person-type-links/:id — remove one inheritance link.
import { unlinkPersonType } from '../../../db/repositories/personTypes'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await unlinkPersonType(id)
  return { ok: true }
})
