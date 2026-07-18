// GET /api/v1/connection-groups?orgId= — saved invitee sets for an org.
import { listConnectionGroups } from '../../../db/repositories/events'
import { connectionGroupListSchema } from '../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const { orgId } = getQuery(event)
  if (!orgId || typeof orgId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'orgId required' })
  }
  return connectionGroupListSchema.parse(await listConnectionGroups(orgId))
})
