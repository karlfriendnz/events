// POST /api/v1/person-type-links — link a club's own type to a governing body's
// type. Idempotent (unique(type_id, source_type_id) makes a repeat a no-op).
import { z } from 'zod'
import { linkPersonType } from '../../../db/repositories/personTypes'

const bodySchema = z.object({
  orgId: z.string().min(1),
  typeId: z.string().min(1),
  sourceTypeId: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const { orgId, typeId, sourceTypeId } = bodySchema.parse(await readBody(event))
  await linkPersonType(orgId, typeId, sourceTypeId)
  return { ok: true }
})
