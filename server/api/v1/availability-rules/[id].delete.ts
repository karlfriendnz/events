// DELETE /api/v1/availability-rules/:id — delete ONE availability rule. (Restoring any
// rules it had superseded is done by the editor: read ?replacedBy, then PATCH each back
// to isActive=true / replacedByRuleId=null — kept in the UI so the toast stays accurate.)
import { deleteAvailabilityRule } from '../../../db/repositories/bookings'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteAvailabilityRule(id)
  return { ok: true }
})
