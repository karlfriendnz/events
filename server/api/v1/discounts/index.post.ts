// POST /api/v1/discounts — create an event discount.
import { createDiscount } from '../../../db/repositories/finances'
import { discountCreateSchema, discountSchema } from '../../../../shared/contracts/finance'

export default defineEventHandler(async (event) => {
  const input = discountCreateSchema.parse(await readBody(event))
  return discountSchema.parse(await createDiscount(input))
})
