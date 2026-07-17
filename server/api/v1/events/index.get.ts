// GET /api/v1/events?orgId=...&limit=&offset= — every event an org has, newest
// first. The client only ever talks to routes like this, never to the database.
// Output is validated against the shared contract before it leaves, so the
// client's types are guaranteed.
import { listEvents } from '../../../db/repositories/events'
import { fmEventListSchema } from '../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const orgId = query.orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const limit = query.limit != null ? Number(query.limit) : undefined
  const offset = query.offset != null ? Number(query.offset) : undefined
  const events = await listEvents(orgId, {
    limit: Number.isFinite(limit) ? limit : undefined,
    offset: Number.isFinite(offset) ? offset : undefined,
  })
  // Parse-on-output: the route can never ship a shape the client didn't agree to.
  return fmEventListSchema.parse(events)
})
