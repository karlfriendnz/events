// GET /api/v1/groups/:id/memberships — the roster of one group. Output validated
// against the shared contract before it leaves.
import { listMemberships } from '../../../../db/repositories/groups'
import { memberGroupMembershipListSchema } from '../../../../../shared/contracts/group'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const memberships = await listMemberships(id)
  return memberGroupMembershipListSchema.parse(memberships)
})
