// PATCH /api/v1/bookings/:id — status change (approve/decline/cancel). Body =
// { status }.
import { updateBookingStatus } from '../../../db/repositories/bookings'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const { status } = z.object({ status: z.string() }).parse(await readBody(event))
  await updateBookingStatus(id, status)
  return { ok: true }
})
