// GET /api/v1/events/by-member-group?groupId= — the events linked to one member
// group (its training occurrences, earliest first). Output validated on the way out.
import { listEventsByMemberGroup } from '../../../db/repositories/events'
import { fmEventListSchema } from '../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const groupId = getQuery(event).groupId as string | undefined
  if (!groupId) throw createError({ statusCode: 400, statusMessage: 'groupId required' })
  return fmEventListSchema.parse(await listEventsByMemberGroup(groupId))
})
