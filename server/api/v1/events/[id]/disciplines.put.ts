// PUT /api/v1/events/:id/disciplines — replace the disciplines linked to an event
// (delete-then-insert). Body: { disciplineIds: string[] }.
import { setEventDisciplines } from '../../../../db/repositories/events'
import { z } from 'zod'

const bodySchema = z.object({ disciplineIds: z.array(z.string()) })

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const { disciplineIds } = bodySchema.parse(await readBody(event))
  await setEventDisciplines(id, disciplineIds)
  return { ok: true }
})
