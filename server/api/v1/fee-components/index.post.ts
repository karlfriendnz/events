// POST /api/v1/fee-components — create one fee line (on an event or a session).
import { createFeeComponent } from '../../../db/repositories/events'
import { feeComponentCreateSchema, feeComponentSchema } from '../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const input = feeComponentCreateSchema.parse(body)
  return feeComponentSchema.parse(await createFeeComponent(input))
})
