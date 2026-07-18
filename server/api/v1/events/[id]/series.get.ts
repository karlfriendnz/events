// GET /api/v1/events/:id/series — the whole recurring series as lightweight rows: the
// master (id = :id) plus every child (recurrence_parent_id = :id), id + start + status.
// The archive flow (this/following/all) filters these client-side. Output validated.
import { listSeries } from '../../../../db/repositories/events'
import { seriesEventListSchema } from '../../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  return seriesEventListSchema.parse(await listSeries(id))
})
