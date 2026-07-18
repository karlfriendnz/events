// GET /api/v1/memberships/group-billing?groupId=... — one group's billing links
// (the terms it runs in + a per-term fee, and the membership plans it offers).
import { loadGroupBilling } from '../../../db/repositories/memberships'
import { groupBillingSchema } from '../../../../shared/contracts/membership'

export default defineEventHandler(async (event) => {
  const groupId = getQuery(event).groupId
  if (typeof groupId !== 'string' || !groupId) {
    throw createError({ statusCode: 400, statusMessage: 'groupId is required' })
  }
  return groupBillingSchema.parse(await loadGroupBilling(groupId))
})
