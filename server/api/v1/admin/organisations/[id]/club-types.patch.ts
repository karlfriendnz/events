// PATCH /api/v1/admin/organisations/:id/club-types — assign a club's club types.
import { z } from 'zod'
import { setOrgClubTypes } from '../../../../../db/repositories/admin'

const bodySchema = z.object({ clubTypeIds: z.array(z.string()) })

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id is required' })
  const { clubTypeIds } = bodySchema.parse(await readBody(event))
  await setOrgClubTypes(id, clubTypeIds)
  return { ok: true }
})
