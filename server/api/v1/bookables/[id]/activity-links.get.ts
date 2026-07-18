// GET /api/v1/bookables/:id/activity-links — the activity ids linked to this bookable
// (the by-bookable side of activity_bookables). The venue editor's "linked activities"
// list reads this; setActivityBookables (by-activity) would clobber a bookable's other
// links, so the write has its own by-bookable route.
import { listBookableActivityIds } from '../../../../db/repositories/bookings'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  return z.array(z.string()).parse(await listBookableActivityIds(id))
})
