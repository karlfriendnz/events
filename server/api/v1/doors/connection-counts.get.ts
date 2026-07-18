// GET /api/v1/doors/connection-counts?orgId= — per-door & per-zone connected-venue
// counts ({ doors: {id:n}, zones: {id:n} }). Feeds the Access catalogue's "N connected
// venues" badges (the reverse of the per-bookable door/zone link reads).
import { z } from 'zod'
import { accessConnectionCounts } from '../../../db/repositories/bookings'

const schema = z.object({
  doors: z.record(z.string(), z.number()),
  zones: z.record(z.string(), z.number()),
})

export default defineEventHandler(async (event) => {
  const { orgId } = getQuery(event)
  if (!orgId || typeof orgId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'orgId required' })
  }
  return schema.parse(await accessConnectionCounts(orgId))
})
