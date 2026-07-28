import { legacyClub, legacy } from '~~/server/utils/legacy'

/**
 * The pick-lists an event editor needs from the OLD platform: its venues and
 * its event categories.
 *
 * The venues module has not moved across, so these ARE the club's venues —
 * anything editing an event has to offer them rather than the (empty) bookables
 * list this module would normally use.
 */
export default defineEventHandler(async () => {
  const club = legacyClub()
  if (!club) {
    throw createError({ statusCode: 503, statusMessage: 'No legacy connection configured for this club.' })
  }

  const [venues, categories] = await Promise.all([
    legacy.venues(club).catch(() => [] as any[]),
    legacy.categories(club).catch(() => [] as any[]),
  ])

  return { venues, categories }
})
