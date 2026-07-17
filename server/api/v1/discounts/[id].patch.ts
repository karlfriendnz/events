// PATCH /api/v1/discounts/:id — partial update.
import { updateDiscount } from '../../../db/repositories/finances'
import { discountPatchSchema, discountSchema } from '../../../../shared/contracts/finance'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = discountPatchSchema.parse(await readBody(event))
  const updated = await updateDiscount(id, patch)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return discountSchema.parse(updated)
})
