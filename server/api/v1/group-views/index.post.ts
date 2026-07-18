// POST /api/v1/group-views — create a saved view.
import { createView } from '../../../db/repositories/groups'
import { groupViewCreateSchema, groupViewSchema } from '../../../../shared/contracts/group'

export default defineEventHandler(async (event) => {
  const parsed = groupViewCreateSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid view payload' })
  return groupViewSchema.parse(await createView(parsed.data))
})
