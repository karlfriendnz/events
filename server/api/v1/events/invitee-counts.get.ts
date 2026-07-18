// GET /api/v1/events/invitee-counts?orgId= — per-event invitee totals (total +
// CONFIRMED) across a whole org, for the events reporting page.
import { inviteeCountsByOrg } from '../../../db/repositories/events'
import { z } from 'zod'

const outSchema = z.array(z.object({
  eventId: z.string(),
  total: z.number().int(),
  confirmed: z.number().int(),
}))

export default defineEventHandler(async (event) => {
  const { orgId } = getQuery(event)
  if (!orgId || typeof orgId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'orgId required' })
  }
  return outSchema.parse(await inviteeCountsByOrg(orgId))
})
