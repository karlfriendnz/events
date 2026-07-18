// PATCH /api/v1/calendars/:id — update a calendar's name/colour/icon/pin/settings.
// Category links are managed separately (POST /api/v1/calendar-categories).
import { updateCalendar } from '../../../db/repositories/waitlists'
import { calendarPatchSchema, calendarSchema } from '../../../../shared/contracts/waitlist'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = calendarPatchSchema.parse(await readBody(event))
  const updated = await updateCalendar(id, patch)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return calendarSchema.parse(updated)
})
