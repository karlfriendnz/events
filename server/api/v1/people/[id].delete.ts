// DELETE /api/v1/people/:id
import { deletePerson } from '../../../db/repositories/people'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deletePerson(id)
  return { ok: true }
})
