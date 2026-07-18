// GET /api/v1/availability-rules?bookableIds=csv&activeOnly=1  — availability rules across
// a SET of bookables (the sub-venue scheduler loads child ids + their masters at once).
// GET /api/v1/availability-rules?replacedBy=<ruleId> — the rules a given rule superseded
// (auto-restored when it's deleted). One of the two query forms is required.
import { listAvailabilityRulesForBookables, listAvailabilityRulesReplacedBy } from '../../../db/repositories/bookings'
import { availabilityRuleListSchema } from '../../../../shared/contracts/booking'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  if (typeof query.replacedBy === 'string' && query.replacedBy) {
    return availabilityRuleListSchema.parse(await listAvailabilityRulesReplacedBy(query.replacedBy))
  }
  const bookableIds = typeof query.bookableIds === 'string' && query.bookableIds
    ? query.bookableIds.split(',').filter(Boolean)
    : []
  if (!bookableIds.length) return availabilityRuleListSchema.parse([])
  const activeOnly = query.activeOnly === '1' || query.activeOnly === 'true'
  return availabilityRuleListSchema.parse(await listAvailabilityRulesForBookables(bookableIds, { activeOnly }))
})
