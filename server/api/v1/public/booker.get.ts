// GET /api/v1/public/booker?org=<id> — the PUBLIC booker menu: bookings-enabled ACTIVE
// activities + their modes, plus the public bookables + availability (open hours) the
// booking flow needs. Never bookings/contacts (who booked what) — that busy-slot read
// is a separate, narrowly-projected follow-up. 404 when the org doesn't exist.
import { publicBooker } from '../../../db/repositories/public'
import { publicBookerSchema } from '../../../../shared/contracts/public'

export default defineEventHandler(async (event) => {
  const org = String(getQuery(event).org ?? '')
  if (!org) throw createError({ statusCode: 400, statusMessage: 'org is required' })
  const booker = await publicBooker(org)
  if (!booker) throw createError({ statusCode: 404, statusMessage: 'Organisation not found' })
  return publicBookerSchema.parse(booker)
})
