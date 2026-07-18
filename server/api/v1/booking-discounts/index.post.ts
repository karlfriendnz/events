// POST /api/v1/booking-discounts — create OR update a discount + its activity/mode
// scope in one call (pass id to update). Returns the saved discount.
import { saveBookingDiscount } from '../../../db/repositories/bookings'
import { bookingDiscountSchema } from '../../../../shared/contracts/booking'
import { z } from 'zod'

const bodySchema = z.object({
  id: z.string().optional(),
  orgId: z.string(),
  name: z.string().min(1),
  formText: z.string().nullable().optional(),
  modifierType: z.string(),
  modifierValue: z.union([z.string(), z.number()]),
  applyTo: z.string(),
  conditions: z.array(z.any()).default([]),
  validFrom: z.string().nullable().optional(),
  validUntil: z.string().nullable().optional(),
  maxUses: z.number().int().nullable().optional(),
  isActive: z.boolean().default(true),
  activityIds: z.array(z.string()).default([]),
  modeIds: z.array(z.string()).default([]),
})

export default defineEventHandler(async (event) => {
  const input = bodySchema.parse(await readBody(event))
  return bookingDiscountSchema.parse(await saveBookingDiscount(input))
})
