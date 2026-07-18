// PATCH /api/v1/communication-topics/:id — update one of the club's own topics.
// orgId in the body tenant-scopes the WHERE (a core topic can never be hit).
import { updateTopic } from '../../../db/repositories/communications'
import { commTopicPatchSchema, commTopicSchema } from '../../../../shared/contracts/communication'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = commTopicPatchSchema.parse(await readBody(event))
  const updated = await updateTopic(id, patch)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return commTopicSchema.parse(updated)
})
