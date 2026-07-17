// GET /api/v1/events/:id/invitees — the invited people on one event. Output
// validated against the shared contract before it leaves.
import { listInvitees } from '../../../../db/repositories/events'
import { inviteeListSchema } from '../../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  return inviteeListSchema.parse(await listInvitees(id))
})
