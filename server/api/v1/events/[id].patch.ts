// PATCH /api/v1/events/:id — partial update. Coexists with the [id]/ dir
// (sessions/invitees/registrations) — different route, no conflict.
import { updateEvent } from '../../../db/repositories/events'
import { fmEventPatchSchema, fmEventSchema } from '../../../../shared/contracts/event'
import { isLegacyId, legacyUpdateEvent } from '../../../utils/legacyBridge'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = fmEventPatchSchema.parse(await readBody(event))
  // An event that lives in the OLD platform is edited THERE. Without this, editing
  // one from our screens hit our own table, found no row and 404'd — so the fields
  // were visible and the pencil did nothing.
  if (isLegacyId(id)) {
    const row = await legacyUpdateEvent(id, patch as any)
    if (!row) throw createError({ statusCode: 404, statusMessage: 'not found' })
    return fmEventSchema.parse(row)
  }
  const updated = await updateEvent(id, patch)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return fmEventSchema.parse(updated)
})
