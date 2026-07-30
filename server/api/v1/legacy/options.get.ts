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

  // The old platform's WEB root (the API hangs off it at /api/v1/fmevents/…).
  // People, competitions and the rest still live over there, so anything this
  // module can only point at — a person's profile, say — needs somewhere to
  // point. It isn't discoverable from the browser: the iframe carries no host
  // URL and its `referrerpolicy="same-origin"` strips the referrer, so the
  // server has to hand it over.
  return { venues, categories, webBase: club.baseUrl }
})
