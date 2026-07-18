// POST /api/v1/events/:id/fees — replace ALL fee lines on an event (delete-then-insert).
// Body: { items: FeeComponentCreate[] }. Returns the new set.
import { replaceEventFeeComponents } from '../../../../db/repositories/events'
import { feeComponentCreateSchema, feeComponentListSchema } from '../../../../../shared/contracts/event'
import { z } from 'zod'

const bodySchema = z.object({ items: z.array(feeComponentCreateSchema) })

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const { items } = bodySchema.parse(await readBody(event))
  return feeComponentListSchema.parse(await replaceEventFeeComponents(id, items))
})
