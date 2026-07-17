// GET /api/v1/waitlists?orgId= — waitlists for an org. Optionally scoped to one
// queue's entries via ?waitlistId=. The client only ever talks to routes like this,
// never to the database. Output is validated against the shared contract before it
// leaves, so the client's types are guaranteed.
import { listWaitlists, listEntries } from '../../../db/repositories/waitlists'
import {
  waitlistListSchema,
  waitlistEntryListSchema,
} from '../../../../shared/contracts/waitlist'

export default defineEventHandler(async (event) => {
  const { orgId, waitlistId } = getQuery(event)
  if (waitlistId) {
    const entries = await listEntries(String(waitlistId))
    return waitlistEntryListSchema.parse(entries)
  }
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const waitlists = await listWaitlists(String(orgId))
  return waitlistListSchema.parse(waitlists)
})
