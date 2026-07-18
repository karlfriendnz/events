// POST /api/v1/code-roles/ensure-defaults — seed the org-wide default code roles the
// first time (only when none exist). Body = { orgId, defaults }. Returns the defs.
import { z } from 'zod'
import { ensureDefaultCodeRoles } from '../../../db/repositories/groups'

const inSchema = z.object({
  orgId: z.string(),
  defaults: z.array(z.object({ key: z.string(), label: z.string(), capabilities: z.array(z.string()) })),
})
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
  const parsed = inSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid payload' })
  return outSchema.parse(await ensureDefaultCodeRoles(parsed.data.orgId, parsed.data.defaults))
})
