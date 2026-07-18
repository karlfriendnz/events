// GET /api/v1/resource-views — engagement rows.
//   ?orgId=…       → every view in the org (the admin explorer folds these into stats)
//   ?resourceId=…  → one resource's views
import { listViewsByOrg, listViews } from '../../../db/repositories/resources'
import { resourceViewListSchema } from '../../../../shared/contracts/resource'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const orgId = q.orgId ? String(q.orgId) : ''
  const resourceId = q.resourceId ? String(q.resourceId) : ''

  let views
  if (resourceId) views = await listViews(resourceId)
  else if (orgId) views = await listViewsByOrg(orgId)
  else throw createError({ statusCode: 400, statusMessage: 'orgId or resourceId required' })

  return resourceViewListSchema.parse(views)
})
