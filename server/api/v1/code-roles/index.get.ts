// GET /api/v1/code-roles?orgId= — the org's code-role definitions (per code lineage;
// a null lineage = an org-wide default). Backs useCodeRoles().loadRoleDefs().
import { z } from 'zod'
import { listCodeRoleDefs } from '../../../db/repositories/groups'

const outSchema = z.array(
  z.object({
    id: z.string(),
    orgId: z.string(),
    codeLineageId: z.string().nullable(),
    key: z.string(),
    label: z.string(),
    capabilities: z.array(z.string()),
    sortOrder: z.number().int().nullable(),
  }),
)

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId as string | undefined
  if (!orgId) throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  return outSchema.parse(await listCodeRoleDefs(orgId))
})
