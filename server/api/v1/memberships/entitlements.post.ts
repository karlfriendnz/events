// POST /api/v1/memberships/entitlements — replace what one membership includes
// (delete-then-insert). Body = { orgId, membershipGroupId, rows }. Returns the saved
// entitlement rows (contract shape).
import { z } from 'zod'
import { saveEntitlements } from '../../../db/repositories/memberships'
import {
  membershipEntitlementInputSchema,
  membershipEntitlementListSchema,
} from '../../../../shared/contracts/membership'

const inSchema = z.object({
  orgId: z.string(),
  membershipGroupId: z.string(),
  rows: z.array(membershipEntitlementInputSchema),
})

export default defineEventHandler(async (event) => {
  const parsed = inSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid entitlements payload' })
  const saved = await saveEntitlements(parsed.data.orgId, parsed.data.membershipGroupId, parsed.data.rows)
  return membershipEntitlementListSchema.parse(saved)
})
