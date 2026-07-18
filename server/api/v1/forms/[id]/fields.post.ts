// POST /api/v1/forms/:id/fields — replace the whole field set of a form
// (delete-then-insert). Body: { fields: FormFieldInput[] }. The client sends the
// ordered rows; the repo owns ids + defaults.
import { saveFields } from '../../../../db/repositories/forms'
import { saveFieldsSchema } from '../../../../../shared/contracts/form'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'id is required' })
  }
  const { fields } = saveFieldsSchema.parse(await readBody(event))
  await saveFields(id, fields)
  return { ok: true }
})
