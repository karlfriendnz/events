// GET /api/v1/events/:id/disciplines — the discipline ids linked to an event.
import { listEventDisciplineIds } from '../../../../db/repositories/events'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  return z.array(z.string()).parse(await listEventDisciplineIds(id))
})
