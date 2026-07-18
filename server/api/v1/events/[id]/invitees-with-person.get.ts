// GET /api/v1/events/:id/invitees-with-person — the invitees of one event joined to
// their persons row (name/email/dob), the shape the Invitees + Attendance tabs render.
// Oldest invite first. Output validated.
import { inviteesForEvent } from '../../../../db/repositories/events'
import { inviteeWithPersonListSchema } from '../../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  return inviteeWithPersonListSchema.parse(await inviteesForEvent(id))
})
