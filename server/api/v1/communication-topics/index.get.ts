// GET /api/v1/communication-topics?orgId= — the platform core topics + the club's
// own topics, in sort order (rich shape: description / isCore / isActive). The editor
// splits them by isCore. Separate from the thin list at
// /api/v1/communications?resource=topics (which the FormDesigner uses).
import { listTopicsForOrg } from '../../../db/repositories/communications'
import { commTopicListSchema } from '../../../../shared/contracts/communication'

export default defineEventHandler(async (event) => {
  const { orgId } = getQuery(event)
  if (!orgId) throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  return commTopicListSchema.parse(await listTopicsForOrg(String(orgId)))
})
