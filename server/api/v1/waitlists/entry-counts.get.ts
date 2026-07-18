// GET /api/v1/waitlists/entry-counts?orgId= — waiting+contacted counts per waitlist
// for the org (the board's "N waiting" badge). Returns { [waitlistId]: number }.
import { waitlistEntryCounts } from '../../../db/repositories/groups'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId as string | undefined
  if (!orgId) throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  return await waitlistEntryCounts(orgId)
})
