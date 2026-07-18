// DELETE /api/v1/events/:id/series — delete every child occurrence of this master
// (leaves the master intact).
import { deleteSeriesChildren } from '../../../../db/repositories/events'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteSeriesChildren(id)
  return { ok: true }
})
