import { legacyClub, legacy } from '~~/server/utils/legacy'

/**
 * The club's existing events, for the embedded calendar.
 *
 * These are the events that already live in the old platform. The module shows
 * them alongside its own so a club sees one calendar, not two.
 */
export default defineEventHandler(async (event) => {
  const { club: slug, start, end, person } = getQuery(event) as Record<string, string>

  const club = legacyClub(slug)
  if (!club) {
    throw createError({ statusCode: 503, statusMessage: 'No legacy connection configured for this club.' })
  }

  if (person) return await legacy.personEvents(club, Number(person))

  if (!start || !end) {
    throw createError({ statusCode: 400, statusMessage: 'start and end are required' })
  }
  return await legacy.events(club, start, end)
})
