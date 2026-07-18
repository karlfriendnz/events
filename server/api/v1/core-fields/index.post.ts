// POST /api/v1/core-fields — save the org's global CORE-fields config.
import { setCoreFields } from '../../../db/repositories/personTypes'
import { coreFieldsSaveSchema } from '../../../../shared/contracts/personType'

export default defineEventHandler(async (event) => {
  const { orgId, config } = coreFieldsSaveSchema.parse(await readBody(event))
  await setCoreFields(orgId, config)
  return { ok: true }
})
