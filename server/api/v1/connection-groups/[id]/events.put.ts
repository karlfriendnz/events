// PUT /api/v1/connection-groups/:id/events — replace the event links of a saved set.
import { setConnectionGroupEvents } from '../../../../db/repositories/events'
import { z } from 'zod'

const bodySchema = z.object({ eventIds: z.array(z.string()) })

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const { eventIds } = bodySchema.parse(await readBody(event))
  await setConnectionGroupEvents(id, eventIds)
  return { ok: true }
})
