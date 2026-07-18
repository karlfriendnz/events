// PATCH /api/v1/finances/bank-accounts/:id — update a bank account (orgId in the body
// tenant-scopes the WHERE; setting isDefault clears the org's other defaults).
import { updateBankAccount } from '../../../../db/repositories/finances'
import { bankAccountPatchSchema, bankAccountSchema } from '../../../../../shared/contracts/finance'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = bankAccountPatchSchema.parse(await readBody(event))
  const updated = await updateBankAccount(id, patch)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return bankAccountSchema.parse(updated)
})
