// POST /api/v1/terminology/sport — save a sport's (non-default) terminology
// overrides onto its org_sports row.
import { z } from 'zod'
import { saveSportTerminology } from '../../../db/repositories/personTypes'
import { terminologyMapSchema } from '../../../../shared/contracts/personType'

const bodySchema = z.object({ sportId: z.string().min(1), overrides: terminologyMapSchema })

export default defineEventHandler(async (event) => {
  const { sportId, overrides } = bodySchema.parse(await readBody(event))
  await saveSportTerminology(sportId, overrides)
  return { ok: true }
})
