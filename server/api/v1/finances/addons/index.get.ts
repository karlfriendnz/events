// GET /api/v1/finances/addons?orgId= — every add-on in an org (via its event).
import { listAddons } from '../../../../db/repositories/finances'
import { addonListSchema } from '../../../../../shared/contracts/finance'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  return addonListSchema.parse(await listAddons(orgId))
})
