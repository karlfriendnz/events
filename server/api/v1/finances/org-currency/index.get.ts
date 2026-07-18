// GET /api/v1/finances/org-currency?orgId= — the org's ISO currency code (the one
// org setting the finances/reporting screens format money with). Defaults NZD.
import { getOrgCurrency } from '../../../../db/repositories/finances'
import { orgCurrencySchema } from '../../../../../shared/contracts/finance'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  return orgCurrencySchema.parse({ currency: await getOrgCurrency(orgId) })
})
