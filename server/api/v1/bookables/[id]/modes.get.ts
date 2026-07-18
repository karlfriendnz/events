// GET /api/v1/bookables/:id/modes — a bookable's own booking modes.
import { listBookableModes } from '../../../../db/repositories/bookings'
import { bookableModeListSchema } from '../../../../../shared/contracts/booking'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  return bookableModeListSchema.parse(await listBookableModes(id))
})
