// POST /api/v1/activities — create. Validates the body against the create contract
// (parse-on-input), returns the created row validated against the read contract
// (parse-on-output). The write mirror of index.get.
import { createActivity } from '../../../db/repositories/bookings'
import { activityCreateSchema, activitySchema } from '../../../../shared/contracts/booking'

export default defineEventHandler(async (event) => {
  const input = activityCreateSchema.parse(await readBody(event))
  return activitySchema.parse(await createActivity(input))
})
