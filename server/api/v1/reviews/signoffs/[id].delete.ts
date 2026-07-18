// DELETE /api/v1/reviews/signoffs/:id — a reviewer revokes their sign-off.
import { deleteSignoff } from '../../../../db/repositories/reviews'
import { okSchema } from '../../../../../shared/contracts/review'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteSignoff(id)
  return okSchema.parse({ ok: true })
})
