// GET /api/v1/people/:id/override?orgId=… — a governing body's private overlay of
// edits on this (club-owned) person, or null when it has none. Coexists with
// ../[id].get.ts (the person itself).
import { getPersonOverride } from '../../../../db/repositories/people'
import { personOverrideNullableSchema } from '../../../../../shared/contracts/personOverride'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) throw createError({ statusCode: 400, statusMessage: 'orgId required' })
  return personOverrideNullableSchema.parse(await getPersonOverride(orgId, id))
})
