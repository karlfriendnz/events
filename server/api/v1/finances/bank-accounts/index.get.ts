// GET /api/v1/finances/bank-accounts?orgId= — the org's bank accounts, in sort order.
import { listBankAccounts } from '../../../../db/repositories/finances'
import { bankAccountListSchema } from '../../../../../shared/contracts/finance'

export default defineEventHandler(async (event) => {
  const { orgId } = getQuery(event)
  if (!orgId) throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  return bankAccountListSchema.parse(await listBankAccounts(String(orgId)))
})
