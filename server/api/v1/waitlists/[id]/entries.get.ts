// GET /api/v1/waitlists/:id/entries — the people waiting in one queue, each hydrated
// with their person (name/email/phone/dob), in queue order. Richer than the thin
// entries served by index.get.ts (?waitlistId=) — this is what the board's roster needs.
import { z } from 'zod'
import { listWaitlistEntriesWithPerson } from '../../../../db/repositories/groups'

const outSchema = z.array(
  z.object({
    id: z.string(),
    waitlistId: z.string(),
    personId: z.string(),
    status: z.string(),
    notes: z.string().nullable(),
    sortOrder: z.number().int(),
    priority: z.number().int(),
    createdAt: z.string().nullable(),
    person: z
      .object({
        id: z.string(),
        firstName: z.string().nullable(),
        lastName: z.string().nullable(),
        email: z.string().nullable(),
        phone: z.string().nullable(),
        dob: z.string().nullable(),
      })
      .nullable(),
  }),
)

export default defineEventHandler(async (event) => {
  const waitlistId = getRouterParam(event, 'id')!
  return outSchema.parse(await listWaitlistEntriesWithPerson(waitlistId))
})
