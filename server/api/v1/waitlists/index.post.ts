// POST /api/v1/waitlists — create a waitlist. (index.get.ts serves both the list
// and one waitlist's entries by query param; this is the write mirror for the list.)
import { createWaitlist } from '../../../db/repositories/waitlists'
import { waitlistCreateSchema, waitlistSchema } from '../../../../shared/contracts/waitlist'

export default defineEventHandler(async (event) => {
  const input = waitlistCreateSchema.parse(await readBody(event))
  return waitlistSchema.parse(await createWaitlist(input))
})
