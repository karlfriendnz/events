// POST /api/v1/events — create. Validates the body against the create contract
// (parse-on-input), returns the created row validated against the read contract
// (parse-on-output). The write mirror of index.get.
import { createEvent } from '../../../db/repositories/events'
import { fmEventCreateSchema, fmEventSchema } from '../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const input = fmEventCreateSchema.parse(await readBody(event))
  return fmEventSchema.parse(await createEvent(input))
})
