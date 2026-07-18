// POST /api/v1/events/:id/series — regenerate this master's child occurrences. Body =
// { occurrences: [{ startAt, endAt }] }. Clones the master server-side and
// delete-then-inserts one child per occurrence. Returns the new child count.
import { generateSeriesOccurrences } from '../../../../db/repositories/events'
import { z } from 'zod'

const bodySchema = z.object({
  occurrences: z.array(z.object({
    startAt: z.string(),
    endAt: z.string().nullable(),
  })),
})

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const { occurrences } = bodySchema.parse(await readBody(event))
  return z.object({ count: z.number().int() }).parse({
    count: await generateSeriesOccurrences(id, occurrences),
  })
})
