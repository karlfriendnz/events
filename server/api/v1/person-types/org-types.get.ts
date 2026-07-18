// GET /api/v1/person-types/org-types?orgId=… — a club's OWN person/entity types
// with the FULL setup config (landing/menu/dashboard/permissions/member_slots). No
// inheritance — the single source the setup screens drive off.
import { listOrgTypesFull } from '../../../db/repositories/personTypes'
import { orgTypeFullListSchema } from '../../../../shared/contracts/personType'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  return orgTypeFullListSchema.parse(await listOrgTypesFull(orgId))
})
