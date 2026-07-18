// PATCH /api/v1/availability-rules/:id — update ONE availability rule (single-field
// edits: reorder via sortOrder, toggle via isActive, supersede via replacedByRuleId,
// restore via replacedByRuleId=null). Id-stable, unlike the whole-set replace.
import { updateAvailabilityRule } from '../../../db/repositories/bookings'
import { availabilityRulePatchSchema, availabilityRuleSchema } from '../../../../shared/contracts/booking'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = availabilityRulePatchSchema.parse(await readBody(event))
  const updated = await updateAvailabilityRule(id, patch)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return availabilityRuleSchema.parse(updated)
})
