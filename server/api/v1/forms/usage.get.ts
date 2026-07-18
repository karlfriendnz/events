// GET /api/v1/forms/usage?orgId= — per-form usage tallies (fields / in-use / targets)
// for the Forms list, keyed by form id. Output validated against the shared contract.
import { usageCounts } from '../../../db/repositories/forms'
import { formUsageMapSchema } from '../../../../shared/contracts/form'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const usage = await usageCounts(orgId)
  return formUsageMapSchema.parse(usage)
})
