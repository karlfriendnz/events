// PATCH /api/v1/brands/:id — update a brand (name / logo / icon / colour / order).
import { updateBrand } from '../../../db/repositories/admin'
import { brandPatchSchema, brandSchema } from '../../../../shared/contracts/admin'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id is required' })
  const patch = brandPatchSchema.parse(await readBody(event))
  const brand = await updateBrand(id, patch)
  if (!brand) throw createError({ statusCode: 404, statusMessage: 'Brand not found' })
  return brandSchema.parse(brand)
})
