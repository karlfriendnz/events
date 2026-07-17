// GET /api/v1/xero-connection?orgId= — an org's Xero connection, or null when the
// org hasn't connected Xero. A per-org singleton, so this returns the object (not a
// list). Secrets (refresh/access tokens) never leave the server — the contract omits
// them. Output is validated against the shared contract before it leaves.
import { getXeroConnection } from '../../../db/repositories/finances'
import { xeroConnectionOrNullSchema } from '../../../../shared/contracts/finance'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const connection = await getXeroConnection(orgId)
  return xeroConnectionOrNullSchema.parse(connection)
})
