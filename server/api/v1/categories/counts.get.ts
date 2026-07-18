// GET /api/v1/categories/counts?orgId= — how many events reference each category
// ({ categoryId: count }). Feeds the Settings → Calendars category-list count badge.
import { z } from 'zod'
import { categoryEventCounts } from '../../../db/repositories/events'

const schema = z.record(z.string(), z.number())

export default defineEventHandler(async (event) => {
  const { orgId } = getQuery(event)
  if (!orgId || typeof orgId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'orgId required' })
  }
  return schema.parse(await categoryEventCounts(orgId))
})
