// POST /api/v1/finances/bank-accounts — create a bank account for an org.
import { createBankAccount } from '../../../../db/repositories/finances'
import { bankAccountCreateSchema, bankAccountSchema } from '../../../../../shared/contracts/finance'

export default defineEventHandler(async (event) => {
  const input = bankAccountCreateSchema.parse(await readBody(event))
  return bankAccountSchema.parse(await createBankAccount(input))
})
