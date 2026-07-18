// POST /api/v1/communication-topics — create one of the club's own topics (never
// core). Validates in against the create contract, returns the created topic.
import { createTopic } from '../../../db/repositories/communications'
import { commTopicCreateSchema, commTopicSchema } from '../../../../shared/contracts/communication'

export default defineEventHandler(async (event) => {
  const input = commTopicCreateSchema.parse(await readBody(event))
  return commTopicSchema.parse(await createTopic(input))
})
