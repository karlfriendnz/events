// POST /api/v1/field-definitions — create. Validates the body against the create
// contract (parse-on-input), returns the created row validated against the read
// contract (parse-on-output). The write mirror of index.get.
import { createFieldDefinition } from '../../../db/repositories/personTypes'
import { fieldDefinitionCreateSchema, fieldDefinitionSchema } from '../../../../shared/contracts/personType'

export default defineEventHandler(async (event) => {
  const input = fieldDefinitionCreateSchema.parse(await readBody(event))
  return fieldDefinitionSchema.parse(await createFieldDefinition(input))
})
