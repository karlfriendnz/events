// DELETE /api/v1/forms/:id
import { deleteForm } from '../../../db/repositories/forms'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteForm(id)
  return { ok: true }
})
