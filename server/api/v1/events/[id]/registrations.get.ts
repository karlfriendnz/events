// GET /api/v1/events/:id/registrations — the registrations against one event.
// Output validated against the shared contract before it leaves.
import { listRegistrations } from '../../../../db/repositories/events'
import { registrationListSchema } from '../../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  return registrationListSchema.parse(await listRegistrations(id))
})
