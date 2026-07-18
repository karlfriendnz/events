// POST /api/v1/calendar-categories — replace the set of categories a calendar shows
// (delete-then-insert the calendar_categories join). orgId tenant-scopes the calendar;
// returns the calendar's new category ids.
import { setCalendarCategories } from '../../../db/repositories/waitlists'
import { calendarCategoryLinksSchema } from '../../../../shared/contracts/waitlist'

export default defineEventHandler(async (event) => {
  const { orgId, calendarId, categoryIds } = calendarCategoryLinksSchema.parse(await readBody(event))
  const saved = await setCalendarCategories(orgId, calendarId, categoryIds)
  return { categoryIds: saved }
})
