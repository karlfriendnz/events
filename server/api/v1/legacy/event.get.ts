import { legacyClub, legacy, isLegacyId, legacyIdOf } from '~~/server/utils/legacy'

/**
 * One event that still lives in the OLD platform, with its roll and charges.
 *
 * Backs the read-only legacy event view, so clicking an old event on the new
 * calendar opens something useful instead of a dead end. The old platform
 * remains the owner — this only reads.
 */
export default defineEventHandler(async (event) => {
  const raw = String(getQuery(event).id || '')
  const eventID = isLegacyId(raw) ? legacyIdOf(raw) : Number(raw)

  if (!eventID || Number.isNaN(eventID)) {
    throw createError({ statusCode: 400, statusMessage: 'A legacy event id is required' })
  }

  const club = legacyClub()
  if (!club) {
    throw createError({ statusCode: 503, statusMessage: 'No legacy connection configured for this club.' })
  }

  // The roll and the charges are extra detail — a failure there should not stop
  // the club seeing the event itself.
  const [detail, attendance, fees] = await Promise.all([
    legacy.event(club, eventID),
    legacy.attendance(club, eventID).catch(() => [] as any[]),
    legacy.fees(club, eventID).catch(() => [] as any[]),
  ])

  return { event: detail, attendance, fees }
})
