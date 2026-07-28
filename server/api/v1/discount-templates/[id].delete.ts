// DELETE /api/v1/discount-templates/:id — drop a saved template. Deleting the
// template never touches discounts already built from it: applying a template COPIES
// its rule onto the event, it doesn't link back here.
import { removeDiscountTemplate } from '../../../db/repositories/finances'

export default defineEventHandler(async (event) => {
  await removeDiscountTemplate(getRouterParam(event, 'id')!)
  return { ok: true }
})
