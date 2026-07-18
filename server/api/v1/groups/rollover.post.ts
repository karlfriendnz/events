// POST /api/v1/groups/rollover — clone a term's chosen groups into a target term
// (schedules / plans / term-fee / fee options+items / the resolved people + waitlists).
// Body = { orgId, targetTerm, plans }. Returns { created }.
import { z } from 'zod'
import { rollOverGroups } from '../../../db/repositories/groups'

const personSchema = z.object({
  personId: z.string(),
  roles: z.array(z.string()),
  role: z.string().nullable(),
  subGroupId: z.string().nullable(),
})
const planSchema = z.object({
  sourceId: z.string(),
  parentSourceId: z.string().nullable(),
  name: z.string(),
  color: z.string().nullable(),
  sortOrder: z.number().int().nullable(),
  codeId: z.string().nullable(),
  formId: z.string().nullable(),
  imageUrl: z.string().nullable(),
  code: z.string().nullable(),
  ageRange: z.string().nullable(),
  capacity: z.number().int().nullable(),
  termFee: z.union([z.string(), z.number()]).nullable(),
  genderRestriction: z.string().nullable(),
  subGroups: z.array(z.any()),
  lineageId: z.string().nullable(),
  people: z.array(personSchema),
})
const inSchema = z.object({
  orgId: z.string(),
  targetTerm: z.object({
    id: z.string(),
    name: z.string().nullable(),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
  }),
  plans: z.array(planSchema),
})

export default defineEventHandler(async (event) => {
  const parsed = inSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid rollover payload' })
  return await rollOverGroups(parsed.data.orgId, parsed.data.targetTerm, parsed.data.plans)
})
