// DELETE /api/v1/fee-components/:id — remove a fee line.
import { deleteFeeComponent } from '../../../db/repositories/events'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteFeeComponent(id)
  return { ok: true }
})
