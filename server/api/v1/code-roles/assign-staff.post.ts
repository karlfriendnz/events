// POST /api/v1/code-roles/assign-staff — assign a person to a code-lineage role
// (idempotent on the lineage+person+role triple). Body = { orgId, codeLineageId,
// personId, roleKey }.
import { z } from 'zod'
import { assignCodeStaff } from '../../../db/repositories/groups'

const inSchema = z.object({
  orgId: z.string(),
  codeLineageId: z.string(),
  personId: z.string(),
  roleKey: z.string(),
})

export default defineEventHandler(async (event) => {
  const parsed = inSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid payload' })
  await assignCodeStaff(parsed.data.orgId, parsed.data.codeLineageId, parsed.data.personId, parsed.data.roleKey)
  return { ok: true }
})
