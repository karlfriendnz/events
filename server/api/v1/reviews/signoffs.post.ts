// POST /api/v1/reviews/signoffs — a reviewer signs off the current page.
import { createSignoff } from '../../../db/repositories/reviews'
import { createSignoffInputSchema, pageSignoffSchema } from '../../../../shared/contracts/review'

export default defineEventHandler(async (event) => {
  const { orgId, path, reviewerId, signedByUserId } = createSignoffInputSchema.parse(await readBody(event))
  return pageSignoffSchema.parse(await createSignoff({ orgId, path, reviewerId, signedByUserId: signedByUserId ?? null }))
})
