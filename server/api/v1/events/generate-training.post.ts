// POST /api/v1/events/generate-training — materialise a set of groups' weekly training
// schedules into recurrence master + child events, pre-inviting each group's members.
// The whole recurrence + write happens server-side; the client passes a compact input
// (orgId, groupIds, window, and its staff-filtered membersByGroup). Idempotent per
// schedule. Body validated against the shared contract; result parses-on-output.
import { generateTrainingEvents } from '../../../db/repositories/events'
import { generateTrainingInputSchema, generateTrainingResultSchema } from '../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const input = generateTrainingInputSchema.parse(await readBody(event))
  return generateTrainingResultSchema.parse(await generateTrainingEvents(input))
})
