// POST /api/v1/organisations — create. Validates the body against the create
// contract (parse-on-input), returns the created row validated against the
// read contract (parse-on-output). The write mirror of index.get.
import { createOrganisation } from '../../../db/repositories/organisations'
import { organisationCreateSchema, organisationSchema } from '../../../../shared/contracts/organisation'

export default defineEventHandler(async (event) => {
  const input = organisationCreateSchema.parse(await readBody(event))
  return organisationSchema.parse(await createOrganisation(input))
})
