// POST /api/v1/bookables/:id/modes — replace a bookable's whole mode set (the venue
// editor's Modes tab owns it — delete-then-insert). Body = { modes: BookableModeInput[] }.
import { setBookableModes } from '../../../../db/repositories/bookings'
import { bookableModeInputSchema } from '../../../../../shared/contracts/booking'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const { modes } = z.object({ modes: z.array(bookableModeInputSchema) }).parse(await readBody(event))
  await setBookableModes(id, modes)
  return { ok: true }
})
