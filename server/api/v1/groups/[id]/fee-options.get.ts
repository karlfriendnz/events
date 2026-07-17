// GET /api/v1/groups/:id/fee-options — the fee options of one group, each with its
// line items. Output validated against the shared contract before it leaves.
import { listFeeOptions } from '../../../../db/repositories/groups'
import { groupFeeOptionListSchema } from '../../../../../shared/contracts/group'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const feeOptions = await listFeeOptions(id)
  return groupFeeOptionListSchema.parse(feeOptions)
})
