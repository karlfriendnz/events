// GET /api/v1/bookables/:id/children — the direct children of a bookable (parent_id =
// id). The calendar's mutual-exclusion tree walk + the venue page's child/item lists.
import { listBookableChildren } from '../../../../db/repositories/bookings'
import { bookableListSchema } from '../../../../../shared/contracts/booking'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  return bookableListSchema.parse(await listBookableChildren(id))
})
