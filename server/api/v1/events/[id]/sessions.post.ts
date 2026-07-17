// POST /api/v1/events/:id/sessions — create a session under this event. Sits
// beside sessions.get.ts (the list route), so create lives where the read lives;
// eventId comes from the route param, the rest from the body.
import { createSession } from '../../../../db/repositories/events'
import { sessionCreateSchema, sessionSchema } from '../../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  if (!eventId) throw createError({ statusCode: 400, statusMessage: 'event id required' })
  const body = (await readBody(event)) ?? {}
  const input = sessionCreateSchema.parse({ ...body, eventId })
  return sessionSchema.parse(await createSession(input))
})
