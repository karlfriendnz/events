// GET /api/v1/public/event/:id — one public event + its registration detail (sessions,
// event-level fee lines, active discounts, linked form config). The id is the
// capability (a shared registration link). Returns 404 when not found OR closed
// (cancelled/archived), so a closed event is indistinguishable from a nonexistent one.
import { publicEvent } from '../../../../db/repositories/public'
import { publicEventDetailSchema } from '../../../../../shared/contracts/public'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id is required' })
  const detail = await publicEvent(id)
  if (!detail) throw createError({ statusCode: 404, statusMessage: 'This event is not available for registration.' })
  return publicEventDetailSchema.parse(detail)
})
