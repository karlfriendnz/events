// POST /api/v1/bookables/:id/activity-links — set the activities linked to this bookable
// (delete-then-insert scoped to the bookable, so it never touches another bookable's
// links). Body = { activityIds: string[] }.
import { setBookableActivityIds } from '../../../../db/repositories/bookings'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const { activityIds } = z.object({ activityIds: z.array(z.string()) }).parse(await readBody(event))
  await setBookableActivityIds(id, activityIds)
  return { ok: true }
})
