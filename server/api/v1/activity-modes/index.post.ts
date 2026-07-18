// POST /api/v1/activity-modes — create a mode.
import { createActivityMode } from '../../../db/repositories/bookings'
import { activityModeCreateSchema, activityModeSchema } from '../../../../shared/contracts/booking'

export default defineEventHandler(async (event) => {
  const input = activityModeCreateSchema.parse(await readBody(event))
  return activityModeSchema.parse(await createActivityMode(input))
})
