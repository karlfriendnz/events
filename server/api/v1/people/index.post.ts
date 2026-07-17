// POST /api/v1/people — create. Validates the body against the create contract
// (parse-on-input), returns the created row validated against the read contract
// (parse-on-output). The write mirror of index.get.
import { createPerson } from '../../../db/repositories/people'
import { personCreateSchema, personSchema } from '../../../../shared/contracts/person'

export default defineEventHandler(async (event) => {
  const input = personCreateSchema.parse(await readBody(event))
  return personSchema.parse(await createPerson(input))
})
