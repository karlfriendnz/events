// GET /api/v1/events/upcoming?orgId=&now=&limit= — the dashboard Upcoming-events widget:
// events starting at/after `now`, excluding ARCHIVED/CANCELLED, earliest first, limited,
// plus the total matching count.
import { z } from 'zod'
import { upcomingEvents } from '../../../db/repositories/events'
import { fmEventListSchema } from '../../../../shared/contracts/event'

const outSchema = z.object({ events: fmEventListSchema, count: z.number() })

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const orgId = query.orgId
  const now = query.now
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  if (typeof now !== 'string' || !now) {
    throw createError({ statusCode: 400, statusMessage: 'now is required' })
  }
  const limit = query.limit != null ? Number(query.limit) : undefined
  const result = await upcomingEvents(orgId, now, Number.isFinite(limit) ? limit : undefined)
  return outSchema.parse(result)
})
