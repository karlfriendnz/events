// POST /api/v1/groups/memberships — add or update one person's membership on a group
// (pk = group_id + person_id). Used by the group roster + person-profile syncGroups.
// Input validated; output is the resulting membership row (contract shape).
import { z } from 'zod'
import { upsertMembership } from '../../../db/repositories/groups'
import { memberGroupMembershipSchema } from '../../../../shared/contracts/group'

const inSchema = z.object({
  groupId: z.string(),
  personId: z.string(),
  role: z.string().nullable().optional(),
  roles: z.array(z.string()).optional(),
  positions: z.array(z.string()).optional(),
  subGroupId: z.string().nullable().optional(),
  termId: z.string().nullable().optional(),
  planOptionId: z.string().nullable().optional(),
  feeOptionId: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  autoRenew: z.boolean().nullable().optional(),
  membershipStatus: z.string().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = inSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid membership payload' })
  }
  const row = await upsertMembership(parsed.data)
  return memberGroupMembershipSchema.parse(row)
})
