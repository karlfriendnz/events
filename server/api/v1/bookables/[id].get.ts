// GET /api/v1/bookables/:id — one bookable.
import { getBookable } from '../../../db/repositories/bookings'
import { bookableSchema } from '../../../../shared/contracts/booking'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const b = await getBookable(id)
  if (!b) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return bookableSchema.parse(b)
})
