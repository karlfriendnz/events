// GET /api/v1/finances/fee-components?orgId= — every fee component in an org (via
// its event). Read-only. Output validated against the shared contract before it
// leaves, so the client's types are guaranteed.
import { listFeeComponents } from '../../../../db/repositories/finances'
import { feeComponentListSchema } from '../../../../../shared/contracts/finance'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  return feeComponentListSchema.parse(await listFeeComponents(orgId))
})
