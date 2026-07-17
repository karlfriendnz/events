// PATCH /api/v1/people/:id — partial update. Coexists with [id].get.
import { updatePerson } from '../../../db/repositories/people'
import { personPatchSchema, personSchema } from '../../../../shared/contracts/person'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = personPatchSchema.parse(await readBody(event))
  const updated = await updatePerson(id, patch)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return personSchema.parse(updated)
})
