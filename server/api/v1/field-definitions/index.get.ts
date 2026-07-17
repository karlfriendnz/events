// GET /api/v1/field-definitions?orgId=… — the field library for an org. The client
// only ever talks to routes like this, never to the database. Output is validated
// against the shared contract before it leaves.
import { listFieldDefinitions } from '../../../db/repositories/personTypes'
import { fieldDefinitionListSchema } from '../../../../shared/contracts/personType'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const fields = await listFieldDefinitions(orgId)
  return fieldDefinitionListSchema.parse(fields)
})
