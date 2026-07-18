// POST /api/v1/term-sets — create a term set (sequence). Body validated against the
// create contract; output is the created set (contract shape).
import { createTermSet } from '../../../db/repositories/memberships'
import { termSetCreateSchema, termSetSchema } from '../../../../shared/contracts/membership'

export default defineEventHandler(async (event) => {
  const parsed = termSetCreateSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid term set' })
  return termSetSchema.parse(await createTermSet(parsed.data))
})
