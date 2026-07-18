// POST /api/v1/categories — create an event category.
import { createCategory } from '../../../db/repositories/events'
import { eventCategoryCreateSchema, eventCategorySchema } from '../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const input = eventCategoryCreateSchema.parse(await readBody(event))
  return eventCategorySchema.parse(await createCategory(input))
})
