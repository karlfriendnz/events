// DELETE /api/v1/circles/members/:id — remove one person from a circle.
import { removeCircleMember } from '../../../../db/repositories/circles'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await removeCircleMember(id)
  return { ok: true }
})
