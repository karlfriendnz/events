// PATCH /api/v1/organisations/:id/profile-dashboard — save (or clear with null) the
// club-default member-profile dashboard layout. A focused write, not a general org edit.
import { setProfileDashboard } from '../../../../db/repositories/organisations'
import { z } from 'zod'

const bodySchema = z.object({ profileDashboard: z.array(z.any()).nullable() })

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const { profileDashboard } = bodySchema.parse(await readBody(event))
  await setProfileDashboard(id, profileDashboard)
  return { ok: true }
})
