// GET /api/v1/events/:id — one event, or 404. Output validated against the shared
// contract before it leaves.
import { getEvent } from '../../../db/repositories/events'
import { fmEventSchema } from '../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const found = await getEvent(id)
  if (!found) throw createError({ statusCode: 404, statusMessage: 'event not found' })
  return fmEventSchema.parse(found)
})
