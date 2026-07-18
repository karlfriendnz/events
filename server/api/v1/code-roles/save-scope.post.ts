// POST /api/v1/code-roles/save-scope — replace the roles of ONE scope (a code lineage,
// or null for the org defaults), delete-then-insert scoped so it never clobbers another
// scope. Body = { orgId, codeLineageId, roles }.
import { z } from 'zod'
import { saveCodeRoleDefsForScope } from '../../../db/repositories/groups'

const inSchema = z.object({
  orgId: z.string(),
  codeLineageId: z.string().nullable(),
  roles: z.array(z.object({ key: z.string(), label: z.string(), capabilities: z.array(z.string()) })),
})

export default defineEventHandler(async (event) => {
  const parsed = inSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid payload' })
  await saveCodeRoleDefsForScope(parsed.data.orgId, parsed.data.codeLineageId, parsed.data.roles)
  return { ok: true }
})
