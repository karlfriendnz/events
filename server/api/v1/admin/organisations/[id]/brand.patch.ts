// PATCH /api/v1/admin/organisations/:id/brand — connect (or clear) an org's brand.
import { z } from 'zod'
import { setOrgBrand } from '../../../../../db/repositories/admin'

const bodySchema = z.object({ brandId: z.string().nullable() })

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id is required' })
  const { brandId } = bodySchema.parse(await readBody(event))
  await setOrgBrand(id, brandId)
  return { ok: true }
})
