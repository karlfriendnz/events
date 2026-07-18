// DELETE /api/v1/finances/addons/:id
import { deleteAddon } from '../../../../db/repositories/finances'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteAddon(id)
  return { ok: true }
})
