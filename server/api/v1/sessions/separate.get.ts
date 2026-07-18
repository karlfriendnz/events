// GET /api/v1/sessions/separate?orgId= — org-wide "separate sessions" (sessions flagged
// show_as_separate_event, top-level, dated), each carrying a small slice of its parent
// event. The events calendar renders these as their own items.
import { separateSessionsForOrg } from '../../../db/repositories/events'
import { separateSessionListSchema } from '../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const { orgId } = getQuery(event)
  if (!orgId || typeof orgId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'orgId required' })
  }
  return separateSessionListSchema.parse(await separateSessionsForOrg(orgId))
})
