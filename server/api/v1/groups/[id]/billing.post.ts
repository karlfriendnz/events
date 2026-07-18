// POST /api/v1/groups/:id/billing — the group's per-term fee link (member_group_terms)
// + membership-plan connections (member_group_plans), delete-then-insert. The group's
// own term_id/term_fee live on member_groups (written via PATCH /groups/:id); this
// keeps the two link tables in sync. Body = { termId, fee, planIds }.
import { z } from 'zod'
import { saveGroupBilling } from '../../../../db/repositories/groups'

const inSchema = z.object({
  termId: z.string().nullable(),
  fee: z.union([z.string(), z.number()]).nullable(),
  planIds: z.array(z.string()),
})

export default defineEventHandler(async (event) => {
  const groupId = getRouterParam(event, 'id')!
  const parsed = inSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid billing payload' })
  await saveGroupBilling(groupId, parsed.data)
  return { ok: true }
})
