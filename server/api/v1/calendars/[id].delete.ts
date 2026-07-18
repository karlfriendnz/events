// DELETE /api/v1/calendars/:id?orgId= — delete a calendar (and its category links).
// orgId tenant-scopes the delete.
import { deleteCalendar } from '../../../db/repositories/waitlists'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const { orgId } = getQuery(event)
  if (!orgId) throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  await deleteCalendar(String(orgId), id)
  return { ok: true }
})
