// GET /api/v1/organisations/for-user?userId= — the clubs a login belongs to
// (org_members by auth user id, joined to organisations). The ProfileMenu club
// switcher. Output validated.
import { listOrgsForUser } from '../../../db/repositories/organisations'
import { userOrgMembershipListSchema } from '../../../../shared/contracts/organisation'

export default defineEventHandler(async (event) => {
  const userId = getQuery(event).userId
  if (typeof userId !== 'string' || !userId) {
    throw createError({ statusCode: 400, statusMessage: 'userId required' })
  }
  return userOrgMembershipListSchema.parse(await listOrgsForUser(userId))
})
