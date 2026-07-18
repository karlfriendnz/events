// PATCH /api/v1/admin/organisations/:id/level — change an org's level (+ its type,
// kept consistent). A privileged admin op, not a general org patch.
import { z } from 'zod'
import { setOrgLevel } from '../../../../../db/repositories/admin'

const bodySchema = z.object({ orgLevel: z.string().min(1), type: z.string().min(1) })

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id is required' })
  const { orgLevel, type } = bodySchema.parse(await readBody(event))
  await setOrgLevel(id, orgLevel, type)
  return { ok: true }
})
