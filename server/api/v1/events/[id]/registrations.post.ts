// POST /api/v1/events/:id/registrations — create a registration against an event.
import { createRegistration } from '../../../../db/repositories/events'
import { registrationCreateSchema, registrationSchema } from '../../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const input = registrationCreateSchema.parse({ ...(await readBody(event)), eventId: id })
  return registrationSchema.parse(await createRegistration(input))
})
