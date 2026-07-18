// GET /api/v1/resource-targets — audience rows.
//   ?orgId=…                  → every target in the org (the admin explorer buckets them)
//   ?ownerType=…&ownerId=…    → one owner's targets (the connect dialog)
import { listTargetsByOrg, listTargets } from '../../../db/repositories/resources'
import { resourceTargetListSchema } from '../../../../shared/contracts/resource'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const orgId = q.orgId ? String(q.orgId) : ''
  const ownerType = q.ownerType ? String(q.ownerType) : ''
  const ownerId = q.ownerId ? String(q.ownerId) : ''

  let targets
  if (ownerType && ownerId) targets = await listTargets(ownerType, ownerId)
  else if (orgId) targets = await listTargetsByOrg(orgId)
  else throw createError({ statusCode: 400, statusMessage: 'orgId or ownerType+ownerId required' })

  return resourceTargetListSchema.parse(targets)
})
