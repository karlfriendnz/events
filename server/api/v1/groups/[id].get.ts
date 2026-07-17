// GET /api/v1/groups/:id — one group. 404 when it doesn't exist. Output validated
// against the shared contract before it leaves.
import { getGroup } from '../../../db/repositories/groups'
import { memberGroupSchema } from '../../../../shared/contracts/group'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const group = await getGroup(id)
  if (!group) {
    throw createError({ statusCode: 404, statusMessage: 'Group not found' })
  }
  return memberGroupSchema.parse(group)
})
