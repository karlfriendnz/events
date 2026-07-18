// GET /api/v1/registrations/:id/sessions — the sessions a registration selected.
import { listRegistrationSessions } from '../../../../db/repositories/events'
import { registrationSessionListSchema } from '../../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  return registrationSessionListSchema.parse(await listRegistrationSessions(id))
})
