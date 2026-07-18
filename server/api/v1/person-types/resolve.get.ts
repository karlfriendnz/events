// GET /api/v1/person-types/resolve?orgIds=a,b,c&focusOrgId=… — own + inherited
// person types for an org and its ANCESTORS (types inherit down the parent chain),
// tagged with provenance. The client passes org + ancestor ids.
import { resolvePersonTypesForOrgs } from '../../../db/repositories/personTypes'
import { resolvedPersonTypeListSchema } from '../../../../shared/contracts/personType'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const orgIds = (typeof q.orgIds === 'string' ? q.orgIds : '').split(',').map((s) => s.trim()).filter(Boolean)
  const focusOrgId = q.focusOrgId
  if (typeof focusOrgId !== 'string' || !focusOrgId) {
    throw createError({ statusCode: 400, statusMessage: 'focusOrgId is required' })
  }
  return resolvedPersonTypeListSchema.parse(await resolvePersonTypesForOrgs(orgIds, focusOrgId))
})
