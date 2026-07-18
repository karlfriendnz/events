// GET /api/v1/groups/roster-with-person?groupIds=a,b — the roster of a set of groups
// with the FULL person projection the discipline-flag evaluator needs (custom_fields +
// person_types + dob/gender). Distinct from memberships-with-person (allocator shape).
import { z } from 'zod'
import { listMembershipsRosterWithPerson } from '../../../db/repositories/groups'

const outSchema = z.array(
  z.object({
    roles: z.array(z.string()),
    role: z.string().nullable(),
    positions: z.array(z.string()),
    subGroupId: z.string().nullable(),
    person: z
      .object({
        id: z.string(),
        firstName: z.string().nullable(),
        lastName: z.string().nullable(),
        email: z.string().nullable(),
        phone: z.string().nullable(),
        dob: z.string().nullable(),
        gender: z.string().nullable(),
        customFields: z.any(),
        personTypes: z.array(z.string()),
        personType: z.string().nullable(),
      })
      .nullable(),
  }),
)

export default defineEventHandler(async (event) => {
  const raw = getQuery(event).groupIds
  const groupIds = String(raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const rows = await listMembershipsRosterWithPerson(groupIds)
  return outSchema.parse(rows)
})
