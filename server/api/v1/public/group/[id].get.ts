// GET /api/v1/public/group/:id — one public class + its registration detail (fee
// options, full/waitlist status, equivalent classes with space). Never the roster —
// only counts. 404 when the class doesn't exist.
import { publicGroup } from '../../../../db/repositories/public'
import { publicGroupSchema } from '../../../../../shared/contracts/public'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id is required' })
  const g = await publicGroup(id)
  if (!g) throw createError({ statusCode: 404, statusMessage: 'This class could not be found.' })
  return publicGroupSchema.parse(g)
})
