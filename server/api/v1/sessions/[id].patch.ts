// PATCH /api/v1/sessions/:id — partial update of one session. A session is
// addressed by its own id here (the create route lives nested under its event,
// matching the read); mutations by session id have no natural event-nested home.
import { updateSession } from '../../../db/repositories/events'
import { sessionPatchSchema, sessionSchema } from '../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = sessionPatchSchema.parse(await readBody(event))
  const updated = await updateSession(id, patch)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return sessionSchema.parse(updated)
})
