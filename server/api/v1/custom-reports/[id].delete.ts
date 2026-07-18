// DELETE /api/v1/custom-reports/:id
import { deleteCustomReport } from '../../../db/repositories/finances'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteCustomReport(id)
  return { ok: true }
})
