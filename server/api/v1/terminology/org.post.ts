// POST /api/v1/terminology/org — save an org's (non-default) terminology overrides.
import { z } from 'zod'
import { saveOrgTerminology } from '../../../db/repositories/personTypes'
import { terminologyMapSchema } from '../../../../shared/contracts/personType'

const bodySchema = z.object({ orgId: z.string().min(1), overrides: terminologyMapSchema })

export default defineEventHandler(async (event) => {
  const { orgId, overrides } = bodySchema.parse(await readBody(event))
  await saveOrgTerminology(orgId, overrides)
  return { ok: true }
})
