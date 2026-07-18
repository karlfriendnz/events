// PATCH /api/v1/doors/:id
import { updateDoor } from '../../../db/repositories/bookings'
import { doorPatchSchema, doorSchema } from '../../../../shared/contracts/booking'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const updated = await updateDoor(id, doorPatchSchema.parse(await readBody(event)))
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return doorSchema.parse(updated)
})
