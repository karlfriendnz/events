// GET /api/v1/memberships/plans?orgId=... — every membership plan an org has, each
// hydrated with its duration options. The client only ever talks to routes like
// this, never to the database. Output is validated against the shared contract
// before it leaves, so the client's types are guaranteed.
import { listPlans } from '../../../db/repositories/memberships'
import { membershipPlanWithOptionsListSchema } from '../../../../shared/contracts/membership'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const plans = await listPlans(orgId)
  // Parse-on-output: the route can never ship a shape the client didn't agree to.
  return membershipPlanWithOptionsListSchema.parse(plans)
})
