// GET /api/v1/waitlists/enrolled-counts?personIds=a,b — how many groups each person is
// currently a member of (waitlist screen). Returns { [personId]: number }.
import { enrolledGroupCounts } from '../../../db/repositories/groups'

export default defineEventHandler(async (event) => {
  const personIds = String(getQuery(event).personIds ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return await enrolledGroupCounts(personIds)
})
