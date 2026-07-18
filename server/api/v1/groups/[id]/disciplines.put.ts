// PUT /api/v1/groups/:id/disciplines — replace the disciplines linked to a member
// group (delete-then-insert). Body: { disciplineIds: string[] }.
import { setGroupDisciplines } from '../../../../db/repositories/groups'
import { z } from 'zod'

const bodySchema = z.object({ disciplineIds: z.array(z.string()) })

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const { disciplineIds } = bodySchema.parse(await readBody(event))
  await setGroupDisciplines(id, disciplineIds)
  return { ok: true }
})
