// POST /api/v1/groups/:id/fee-options — replace a group's fee options (delete-then-
// insert, incl. line items). Body = { orgId, options }. Returns the saved options.
import { z } from 'zod'
import { saveFeeOptions } from '../../../../db/repositories/groups'
import { groupFeeOptionListSchema } from '../../../../../shared/contracts/group'

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
  sortOrder: z.number().int().nullable().optional(),
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
const inSchema = z.object({ orgId: z.string(), options: z.array(optionSchema) })

export default defineEventHandler(async (event) => {
  const groupId = getRouterParam(event, 'id')!
  const parsed = inSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid fee options payload' })
  const saved = await saveFeeOptions(parsed.data.orgId, groupId, parsed.data.options)
  return groupFeeOptionListSchema.parse(saved)
})
