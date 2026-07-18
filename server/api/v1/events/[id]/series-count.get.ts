// GET /api/v1/events/:id/series-count — how many child occurrences this master has.
import { countSeries } from '../../../../db/repositories/events'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  return z.object({ count: z.number().int() }).parse({ count: await countSeries(id) })
})
