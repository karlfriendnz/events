// GET /api/v1/group-views?orgId=… (list) OR ?id=… (single). Saved Classes-style views.
import { listViews, getView } from '../../../db/repositories/groups'
import { groupViewListSchema, groupViewSchema } from '../../../../shared/contracts/group'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  if (typeof q.id === 'string' && q.id) {
    const v = await getView(q.id)
    if (!v) throw createError({ statusCode: 404, statusMessage: 'View not found' })
    return groupViewSchema.parse(v)
  }
  const orgId = q.orgId
  if (typeof orgId !== 'string' || !orgId) throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  return groupViewListSchema.parse(await listViews(orgId))
})
