// PATCH /api/v1/waitlists/:id — partial update.
import { updateWaitlist } from '../../../db/repositories/waitlists'
import { waitlistPatchSchema, waitlistSchema } from '../../../../shared/contracts/waitlist'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = waitlistPatchSchema.parse(await readBody(event))
  const updated = await updateWaitlist(id, patch)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return waitlistSchema.parse(updated)
})
