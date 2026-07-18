// GET /api/v1/field-definitions/resolve?orgIds=a,b,c&focusOrgId=… — the field
// ENGINE: own + inherited field definitions for an org and its governing chain. The
// CLIENT resolves which orgs a club inherits from (the org-hierarchy layer owns that
// walk) and passes the id list; this reads their fields and tags each with where it
// came from (`inherited`, `ownerName`, `ownerLevel`). Output validated on the way out.
import { resolveFieldsForOrgs } from '../../../db/repositories/personTypes'
import { resolvedFieldListSchema } from '../../../../shared/contracts/personType'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const orgIds = (typeof q.orgIds === 'string' ? q.orgIds : '').split(',').map((s) => s.trim()).filter(Boolean)
  const focusOrgId = q.focusOrgId
  if (typeof focusOrgId !== 'string' || !focusOrgId) {
    throw createError({ statusCode: 400, statusMessage: 'focusOrgId is required' })
  }
  return resolvedFieldListSchema.parse(await resolveFieldsForOrgs(orgIds, focusOrgId))
})
