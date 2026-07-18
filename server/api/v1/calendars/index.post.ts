// POST /api/v1/calendars — create a named calendar (optionally seeding its category
// links). Validates in against the create contract, returns the created calendar
// (with its category ids) validated against the read contract.
import { createCalendar } from '../../../db/repositories/waitlists'
import { calendarCreateSchema, calendarSchema } from '../../../../shared/contracts/waitlist'

export default defineEventHandler(async (event) => {
  const input = calendarCreateSchema.parse(await readBody(event))
  return calendarSchema.parse(await createCalendar(input))
})
