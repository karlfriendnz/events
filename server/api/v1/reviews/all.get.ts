// GET /api/v1/reviews/all?orgId= — every open comment in the org, across pages.
//
// The panel is page-scoped by design (you review the screen in front of you),
// which means the total backlog has never been visible anywhere. Without this
// you can only know what's outstanding on the page you happen to be standing
// on — and a task queued from another screen is invisible until you go there.
import { listOpenComments } from '../../../db/repositories/reviews'
import { pageCommentListSchema } from '../../../../shared/contracts/review'

export default defineEventHandler(async (event) => {
  const orgId = (getQuery(event) as { orgId?: string }).orgId
  if (!orgId) throw createError({ statusCode: 400, statusMessage: 'orgId required' })
  return pageCommentListSchema.parse(await listOpenComments(orgId))
})
