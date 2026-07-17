// DELETE /api/v1/person-types/:id
import { deletePersonType } from '../../../db/repositories/personTypes'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deletePersonType(id)
  return { ok: true }
})
