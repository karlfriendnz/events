// GET /api/v1/people/:id — one person. 404 when it doesn't exist. Output validated
// against the shared contract before it leaves.
import { getPerson } from '../../../db/repositories/people'
import { personSchema } from '../../../../shared/contracts/person'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const person = await getPerson(id)
  if (!person) {
    throw createError({ statusCode: 404, statusMessage: 'Person not found' })
  }
  return personSchema.parse(person)
})
