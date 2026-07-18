// PATCH /api/v1/categories/:id — update an event category.
import { updateCategory } from '../../../db/repositories/events'
import { eventCategoryPatchSchema, eventCategorySchema } from '../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = eventCategoryPatchSchema.parse(await readBody(event))
  const row = await updateCategory(id, patch)
  if (!row) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return eventCategorySchema.parse(row)
})
