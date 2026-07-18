// GET /api/v1/connection-groups/:id/events — the event ids linked to a saved set.
import { listConnectionGroupEventIds } from '../../../../db/repositories/events'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  return z.array(z.string()).parse(await listConnectionGroupEventIds(id))
})
