// POST /api/v1/sessions/:id/fees — replace ALL fee lines on one session
// (delete-then-insert). Session fees are keyed by session_id, never event_id. Body =
// { items: FeeComponentCreate[] }. Output validated.
import { replaceSessionFeeComponents } from '../../../../db/repositories/events'
import { feeComponentCreateSchema, feeComponentListSchema } from '../../../../../shared/contracts/event'
import { z } from 'zod'

const bodySchema = z.object({ items: z.array(feeComponentCreateSchema) })

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const { items } = bodySchema.parse(await readBody(event))
  return feeComponentListSchema.parse(await replaceSessionFeeComponents(id, items))
})
