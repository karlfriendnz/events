// POST /api/v1/discount-templates — save a discount as a reusable template.
import { createDiscountTemplate } from '../../../db/repositories/finances'
import { discountTemplateCreateSchema, discountTemplateSchema } from '../../../../shared/contracts/finance'

export default defineEventHandler(async (event) => {
  const input = discountTemplateCreateSchema.parse(await readBody(event))
  return discountTemplateSchema.parse(await createDiscountTemplate(input))
})
