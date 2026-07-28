// GET /api/v1/discount-templates?orgId= — a club's saved discount templates, newest
// first. They sit beside the built-in presets in the discount picker.
import { listDiscountTemplates } from '../../../db/repositories/finances'
import { discountTemplateListSchema } from '../../../../shared/contracts/finance'

export default defineEventHandler(async (event) => {
  const { orgId } = getQuery(event)
  if (!orgId) throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  return discountTemplateListSchema.parse(await listDiscountTemplates(String(orgId)))
})
