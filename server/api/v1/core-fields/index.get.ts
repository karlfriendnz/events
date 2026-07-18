// GET /api/v1/core-fields?orgId=… — the org's global CORE-fields config
// ({ required, enabled }). Empty maps when never configured.
import { getCoreFields } from '../../../db/repositories/personTypes'
import { coreFieldsSchema } from '../../../../shared/contracts/personType'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  return coreFieldsSchema.parse(await getCoreFields(orgId))
})
