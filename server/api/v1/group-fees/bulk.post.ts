// POST /api/v1/group-fees/bulk — append ONE fee option to many groups at once (bulk
// add; never wipes existing options). Body = { orgId, groupIds, option }. Org-scoped:
// every insert stamps the given orgId, and the groupIds are trusted only as targets.
import { z } from 'zod'
import { addFeeOptionToGroups } from '../../../db/repositories/groups'

const itemSchema = z.object({
  name: z.string().nullable().optional(),
  amount: z.union([z.string(), z.number()]).nullable().optional(),
  account: z.string().nullable().optional(),
  sortOrder: z.number().int().nullable().optional(),
})
const optionSchema = z.object({
  name: z.string(),
  feeType: z.string(),
  status: z.string().optional(),
  periodUnit: z.string().nullable().optional(),
  periodCount: z.number().int().nullable().optional(),
  autoRenew: z.boolean().nullable().optional(),
  instalmentCount: z.number().int().nullable().optional(),
  sessionCount: z.number().int().nullable().optional(),
  prorata: z.boolean().nullable().optional(),
  description: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  depositPercent: z.union([z.string(), z.number()]).nullable().optional(),
  items: z.array(itemSchema).optional(),
})
const inSchema = z.object({ orgId: z.string(), groupIds: z.array(z.string()), option: optionSchema })

export default defineEventHandler(async (event) => {
  const parsed = inSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid bulk fee payload' })
  await addFeeOptionToGroups(parsed.data.orgId, parsed.data.groupIds, parsed.data.option)
  return { ok: true }
})
