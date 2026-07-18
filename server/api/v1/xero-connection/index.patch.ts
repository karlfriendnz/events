// PATCH /api/v1/xero-connection — update the org's Xero mapping (bank/tax/sales
// accounts + the fee-account shortlist). Body carries orgId; tokens are never
// touched here. Returns the updated connection (secrets omitted by the contract).
import { updateXeroConnectionMapping } from '../../../db/repositories/finances'
import { xeroConnectionMappingPatchSchema, xeroConnectionSchema } from '../../../../shared/contracts/finance'

export default defineEventHandler(async (event) => {
  const patch = xeroConnectionMappingPatchSchema.parse(await readBody(event))
  const updated = await updateXeroConnectionMapping(patch)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'no Xero connection for this org' })
  return xeroConnectionSchema.parse(updated)
})
