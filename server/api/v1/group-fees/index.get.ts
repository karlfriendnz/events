// GET /api/v1/group-fees?orgId= — every group's fee options across an org, each
// with its line items (Fees overview + Classes board). Output validated against
// the shared contract before it leaves.
import { listFeeOptionsByOrg } from '../../../db/repositories/groups'
import { groupFeeOptionListSchema } from '../../../../shared/contracts/group'

export default defineEventHandler(async (event) => {
  const orgId = String(getQuery(event).orgId ?? '')
  if (!orgId) throw createError({ statusCode: 400, statusMessage: 'orgId required' })
  const feeOptions = await listFeeOptionsByOrg(orgId)
  return groupFeeOptionListSchema.parse(feeOptions)
})
