// PATCH /api/v1/events/:id — partial update. Coexists with the [id]/ dir
// (sessions/invitees/registrations) — different route, no conflict.
import { updateEvent } from '../../../db/repositories/events'
import { fmEventPatchSchema, fmEventSchema } from '../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = fmEventPatchSchema.parse(await readBody(event))
  const updated = await updateEvent(id, patch)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return fmEventSchema.parse(updated)
})
