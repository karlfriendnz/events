import { legacyClub, legacy, isLegacyId, legacyIdOf } from '~~/server/utils/legacy'

/**
 * Edit an event that lives in the OLD platform, from the new module.
 *
 * Deliberately a PARTIAL update: only the keys sent are written, and the old
 * platform leaves categories/classes alone unless they are explicitly supplied.
 * That is what makes editing safe here — the legacy row carries fields this
 * module has no screen for (awards, programme links, terms text), and they must
 * survive being edited from the new UI untouched.
 *
 * Only fields with a real home in the legacy Event row are accepted. Anything
 * else would be silently dropped by the old platform, which is worse than
 * refusing it.
 */
const EDITABLE = [
  'name', 'date', 'startTime', 'endDate', 'endTime',
  'venueID', 'location', 'notes', 'fee', 'feeDue',
  'maxAttendees', 'closeDate', 'account',
  'categoryIDs', 'isPublic', 'allMembers',
] as const

export default defineEventHandler(async (event) => {
  const body = await readBody<Record<string, any>>(event)
  const raw = String(body?.id ?? '')
  const eventID = isLegacyId(raw) ? legacyIdOf(raw) : Number(raw)

  if (!eventID || Number.isNaN(eventID)) {
    throw createError({ statusCode: 400, statusMessage: 'A legacy event id is required' })
  }

  const club = legacyClub()
  if (!club) {
    throw createError({ statusCode: 503, statusMessage: 'No legacy connection configured for this club.' })
  }

  const patch: Record<string, any> = { eventID }
  for (const key of EDITABLE) {
    if (body[key] !== undefined) patch[key] = body[key]
  }

  if (Object.keys(patch).length === 1) {
    throw createError({ statusCode: 400, statusMessage: 'Nothing to update' })
  }

  return await legacy.saveEvent(club, patch)
})
