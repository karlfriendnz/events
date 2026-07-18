// PATCH /api/v1/custom-reports/:id — partial update (rename and/or new config).
import { updateCustomReport } from '../../../db/repositories/finances'
import { customReportPatchSchema, customReportSchema } from '../../../../shared/contracts/finance'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = customReportPatchSchema.parse(await readBody(event))
  const updated = await updateCustomReport(id, patch)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return customReportSchema.parse(updated)
})
