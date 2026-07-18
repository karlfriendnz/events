// GET /api/v1/forms/:id/fields — the ordered fields of one (legacy builder-shaped)
// form. Empty for designer-shaped forms (their fields live in config.groupFields).
// Output validated against the shared contract before it leaves the seam.
import { listFields } from '../../../../db/repositories/forms'
import { formFieldListSchema } from '../../../../../shared/contracts/form'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'id is required' })
  }
  const fields = await listFields(id)
  return formFieldListSchema.parse(fields)
})
