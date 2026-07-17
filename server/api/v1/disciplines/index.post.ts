// POST /api/v1/disciplines — create. Validates the body against the create
// contract (parse-on-input), returns the created row validated against the read
// contract (parse-on-output). The write mirror of index.get.
import { createDiscipline } from '../../../db/repositories/disciplines'
import { disciplineCreateSchema, disciplineSchema } from '../../../../shared/contracts/discipline'

export default defineEventHandler(async (event) => {
  const input = disciplineCreateSchema.parse(await readBody(event))
  return disciplineSchema.parse(await createDiscipline(input))
})
