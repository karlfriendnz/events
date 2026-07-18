// GET /api/v1/bookables/:id/configurations — a parent venue's slot configurations,
// each with its slot children folded in.
import { listConfigurations } from '../../../../db/repositories/bookings'
import { bookableConfigurationFullListSchema } from '../../../../../shared/contracts/booking'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  return bookableConfigurationFullListSchema.parse(await listConfigurations(id))
})
