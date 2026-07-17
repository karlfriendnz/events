// POST /api/v1/terms — create a term/season. Validates the body against the create
// contract (parse-on-input), returns the created row validated against the read
// contract (parse-on-output). The write mirror of index.get.
import { createTerm } from '../../../db/repositories/memberships'
import { orgTermCreateSchema, orgTermSchema } from '../../../../shared/contracts/membership'

export default defineEventHandler(async (event) => {
  const input = orgTermCreateSchema.parse(await readBody(event))
  return orgTermSchema.parse(await createTerm(input))
})
