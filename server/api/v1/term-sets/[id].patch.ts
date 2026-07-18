// PATCH /api/v1/term-sets/:id — rename a set / set its sport / set its locations.
import { updateTermSet } from '../../../db/repositories/memberships'
import { termSetPatchSchema, termSetSchema } from '../../../../shared/contracts/membership'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const parsed = termSetPatchSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid term set patch' })
  const row = await updateTermSet(id, parsed.data)
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Term set not found' })
  return termSetSchema.parse(row)
})
