// GET /api/v1/memberships/entitlements?membershipGroupId=... — what one membership
// group includes (its entitlement rows). The client only ever talks to routes like
// this, never to the database. Output is validated against the shared contract
// before it leaves, so the client's types are guaranteed.
import { listEntitlements } from '../../../db/repositories/memberships'
import { membershipEntitlementListSchema } from '../../../../shared/contracts/membership'

export default defineEventHandler(async (event) => {
  const membershipGroupId = getQuery(event).membershipGroupId
  if (typeof membershipGroupId !== 'string' || !membershipGroupId) {
    throw createError({ statusCode: 400, statusMessage: 'membershipGroupId is required' })
  }
  const entitlements = await listEntitlements(membershipGroupId)
  // Parse-on-output: the route can never ship a shape the client didn't agree to.
  return membershipEntitlementListSchema.parse(entitlements)
})
