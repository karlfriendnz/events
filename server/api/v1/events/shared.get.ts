// GET /api/v1/events/shared?orgId= — events SHARED to this club (accepted
// event_org_invitees), owned by another org. The club's calendar merges these in as
// read-only items so an accepted national/governing-body event actually shows up.
import { listAcceptedSharedEvents } from '../../../db/repositories/events'
import { sharedEventListSchema } from '../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  return sharedEventListSchema.parse(await listAcceptedSharedEvents(orgId))
})
