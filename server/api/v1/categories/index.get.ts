// GET /api/v1/categories?orgId= — the event categories for an org, sort order.
import { listCategories } from '../../../db/repositories/events'
import { eventCategoryListSchema } from '../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const { orgId } = getQuery(event)
  if (!orgId || typeof orgId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'orgId required' })
  }
  return eventCategoryListSchema.parse(await listCategories(orgId))
})
