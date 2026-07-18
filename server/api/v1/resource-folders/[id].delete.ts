// DELETE /api/v1/resource-folders/:id — children cascade; own targets are cleaned.
import { deleteFolder } from '../../../db/repositories/resources'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteFolder(id)
  return { ok: true }
})
