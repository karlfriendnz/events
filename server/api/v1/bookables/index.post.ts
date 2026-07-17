// POST /api/v1/bookables — create. Validates the body against the create contract
// (parse-on-input), returns the created row validated against the read contract
// (parse-on-output). The write mirror of index.get.
import { createBookable } from '../../../db/repositories/bookings'
import { bookableCreateSchema, bookableSchema } from '../../../../shared/contracts/booking'

export default defineEventHandler(async (event) => {
  const input = bookableCreateSchema.parse(await readBody(event))
  return bookableSchema.parse(await createBookable(input))
})
