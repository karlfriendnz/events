// GET /api/v1/profile-forms?orgId=…&typeKey=… — the form LAYOUT for one person type
// (order, sections, blocks). null when none saved.
import { getProfileForm } from '../../../db/repositories/personTypes'
import { profileFormSchema } from '../../../../shared/contracts/personType'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const orgId = q.orgId
  const typeKey = q.typeKey
  if (typeof orgId !== 'string' || !orgId) throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  if (typeof typeKey !== 'string' || !typeKey) throw createError({ statusCode: 400, statusMessage: 'typeKey is required' })
  return profileFormSchema.parse(await getProfileForm(orgId, typeKey))
})
