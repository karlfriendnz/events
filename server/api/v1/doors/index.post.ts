// POST /api/v1/doors — create a door.
import { createDoor } from '../../../db/repositories/bookings'
import { doorCreateSchema, doorSchema } from '../../../../shared/contracts/booking'

export default defineEventHandler(async (event) => {
  const input = doorCreateSchema.parse(await readBody(event))
  return doorSchema.parse(await createDoor(input))
})
