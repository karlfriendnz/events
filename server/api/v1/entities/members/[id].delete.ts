// DELETE /api/v1/entities/members/:id — detach one person from an entity.
import { removeEntityMember } from '../../../../db/repositories/circles'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await removeEntityMember(id)
  return { ok: true }
})
