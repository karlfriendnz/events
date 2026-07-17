// DELETE /api/v1/disciplines/:id
import { deleteDiscipline } from '../../../db/repositories/disciplines'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteDiscipline(id)
  return { ok: true }
})
