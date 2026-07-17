// PATCH /api/v1/bookables/:id — partial update.
import { updateBookable } from '../../../db/repositories/bookings'
import { bookablePatchSchema, bookableSchema } from '../../../../shared/contracts/booking'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = bookablePatchSchema.parse(await readBody(event))
  const updated = await updateBookable(id, patch)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return bookableSchema.parse(updated)
})
