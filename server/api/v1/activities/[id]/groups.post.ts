// POST /api/v1/activities/:id/groups — set linked groups. Body = { groupIds: [] }.
import { setActivityGroups } from '../../../../db/repositories/bookings'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const { groupIds } = z.object({ groupIds: z.array(z.string()) }).parse(await readBody(event))
  await setActivityGroups(id, groupIds)
  return { ok: true }
})
