// GET /api/v1/events/:id — one event, or 404. Output validated against the shared
// contract before it leaves.
import { getEvent } from '../../../db/repositories/events'
import { fmEventSchema } from '../../../../shared/contracts/event'
import { isLegacyId, legacyEvent } from '../../../utils/legacyBridge'
import { legacyClub } from '../../../utils/legacy'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  // An event that still lives in the OLD platform. Answered here so every screen
  // above the seam — the details summary, the roll — works on it unchanged.
  if (isLegacyId(id)) {
    const club = legacyClub()
    const row = club?.orgId ? await legacyEvent(id, club.orgId) : null
    if (!row) throw createError({ statusCode: 404, statusMessage: 'event not found' })
    return fmEventSchema.parse(row)
  }
  const found = await getEvent(id)
  if (!found) throw createError({ statusCode: 404, statusMessage: 'event not found' })
  return fmEventSchema.parse(found)
})
