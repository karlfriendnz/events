// GET /api/v1/person-types/by-key?orgIds=a,b,c&key=team — the label + member-slot
// roster def of the type matching a key across [org + ancestors], preferring the
// org's own row (orgIds[0]) over an inherited one. null when no match.
import { resolveTypeByKey } from '../../../db/repositories/personTypes'
import { typeByKeySchema } from '../../../../shared/contracts/personType'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const orgIds = (typeof q.orgIds === 'string' ? q.orgIds : '').split(',').map((s) => s.trim()).filter(Boolean)
  const key = q.key
  if (typeof key !== 'string' || !key) {
    throw createError({ statusCode: 400, statusMessage: 'key is required' })
  }
  return typeByKeySchema.parse(await resolveTypeByKey(orgIds, key))
})
