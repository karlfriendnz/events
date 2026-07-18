// DELETE /api/v1/finances/bank-accounts/:id?orgId= — delete a bank account
// (orgId tenant-scopes the delete).
import { deleteBankAccount } from '../../../../db/repositories/finances'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const { orgId } = getQuery(event)
  if (!orgId) throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  await deleteBankAccount(id, String(orgId))
  return { ok: true }
})
