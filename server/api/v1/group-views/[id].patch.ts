// PATCH /api/v1/group-views/:id — update a saved view (name/config/sortOrder).
import { updateView } from '../../../db/repositories/groups'
import { groupViewPatchSchema, groupViewSchema } from '../../../../shared/contracts/group'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const parsed = groupViewPatchSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid view patch' })
  const v = await updateView(id, parsed.data)
  if (!v) throw createError({ statusCode: 404, statusMessage: 'View not found' })
  return groupViewSchema.parse(v)
})
