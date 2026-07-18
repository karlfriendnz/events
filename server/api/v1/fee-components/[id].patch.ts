// PATCH /api/v1/fee-components/:id — update a fee line.
import { updateFeeComponent } from '../../../db/repositories/events'
import { feeComponentPatchSchema, feeComponentSchema } from '../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = feeComponentPatchSchema.parse(await readBody(event))
  const row = await updateFeeComponent(id, patch)
  if (!row) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return feeComponentSchema.parse(row)
})
