// GET /api/v1/bookables?orgId=... — every bookable an org owns. The client only
// ever talks to routes like this, never to the database. Output is validated against
// the shared contract before it leaves, so the client's types are guaranteed.
import { listBookables } from '../../../db/repositories/bookings'
import { bookableListSchema } from '../../../../shared/contracts/booking'
import { legacyClub, legacy, legacyVenueToBookable } from '../../../utils/legacy'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const bookables = await listBookables(orgId)

  // For a club whose venues still live in the OLD platform, those ARE its
  // venues — this module's own list is empty. Without them every venue picker
  // (event wizards, sessions, group training times) offers nothing and staff
  // retype an address that already exists next door.
  // Best-effort: if the old system is unreachable, the club's own bookables
  // must still load.
  const club = legacyClub()
  if (club && club.orgId === orgId) {
    try {
      const venues = await legacy.venues(club)
      bookables.push(...venues.map(v => legacyVenueToBookable(v, orgId)) as any)
    } catch (e: any) {
      console.warn('[legacy] could not load venues:', e?.message || e)
    }
  }

  // Parse-on-output: the route can never ship a shape the client didn't agree to.
  return bookableListSchema.parse(bookables)
})
