// GET /api/v1/code-roles/staff?orgId= — code-level staff assignments for the org, each
// hydrated with its person (id/name/email). Backs useCodeRoles().loadStaff().
import { z } from 'zod'
import { listCodeStaffWithPerson } from '../../../db/repositories/groups'

const outSchema = z.array(
  z.object({
    id: z.string(),
    codeLineageId: z.string(),
    personId: z.string(),
    roleKey: z.string(),
    person: z
      .object({
        id: z.string(),
        firstName: z.string().nullable(),
        lastName: z.string().nullable(),
        email: z.string().nullable(),
      })
      .nullable(),
  }),
)

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId as string | undefined
  if (!orgId) throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  return outSchema.parse(await listCodeStaffWithPerson(orgId))
})
