// POST /api/v1/person-types — create. Validates the body against the create
// contract (parse-on-input), returns the created row validated against the read
// contract (parse-on-output). The write mirror of index.get.
import { createPersonType } from '../../../db/repositories/personTypes'
import { personTypeCreateSchema, personTypeSchema } from '../../../../shared/contracts/personType'

export default defineEventHandler(async (event) => {
  const input = personTypeCreateSchema.parse(await readBody(event))
  return personTypeSchema.parse(await createPersonType(input))
})
