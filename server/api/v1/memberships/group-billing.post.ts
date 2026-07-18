// POST /api/v1/memberships/group-billing — replace a group's billing links
// (delete-then-insert member_group_terms + member_group_plans). Body =
// { groupId, termFees: [{termId, fee}], planIds }. Returns the saved billing.
import { z } from 'zod'
import { saveGroupBilling } from '../../../db/repositories/memberships'
import { groupBillingSchema } from '../../../../shared/contracts/membership'

const inSchema = z.object({
  groupId: z.string(),
  termFees: z.array(
    z.object({ termId: z.string(), fee: z.union([z.string(), z.number()]).nullable() }),
  ),
  planIds: z.array(z.string()),
})

export default defineEventHandler(async (event) => {
  const parsed = inSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid group billing payload' })
  const saved = await saveGroupBilling(parsed.data.groupId, parsed.data.termFees, parsed.data.planIds)
  return groupBillingSchema.parse(saved)
})
