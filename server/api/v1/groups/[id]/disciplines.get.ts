// GET /api/v1/groups/:id/disciplines — the discipline ids linked to a member group.
import { listGroupDisciplineIds } from '../../../../db/repositories/groups'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  return z.array(z.string()).parse(await listGroupDisciplineIds(id))
})
