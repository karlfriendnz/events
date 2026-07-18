// GET /api/v1/finances/registration-transactions?regIds=csv — transaction refs (Xero
// invoice id) for a set of registrations, for the profile Financials rows. Empty/absent
// regIds → []. Output validated.
import { listTransactionsForRegistrations } from '../../../db/repositories/finances'
import { registrationTransactionListSchema } from '../../../../shared/contracts/finance'

export default defineEventHandler(async (event) => {
  const regIds = getQuery(event).regIds
  const list = typeof regIds === 'string' && regIds.length ? regIds.split(',') : []
  return registrationTransactionListSchema.parse(await listTransactionsForRegistrations(list))
})
