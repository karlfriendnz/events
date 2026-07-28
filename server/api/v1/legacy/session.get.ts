import { legacyClub, legacy } from '~~/server/utils/legacy'

/**
 * Exchange the old platform's single-use login token for a session.
 *
 * The old platform renders the events module in an iframe with a freshly
 * minted 'app' token. This swaps it for the person behind it — server side,
 * so the club's API key never reaches the browser — and returns just enough
 * for the embedded module to know who it is working as.
 *
 * The token is consumed by the exchange, so a reload of the iframe needs a
 * fresh one from the old platform. That is deliberate: a replayable token in a
 * URL is a login anyone can copy out of a browser history.
 */
export default defineEventHandler(async (event) => {
  const { club: slug, logintoken } = getQuery(event) as { club?: string; logintoken?: string }

  if (!logintoken) {
    throw createError({ statusCode: 400, statusMessage: 'logintoken is required' })
  }

  const club = legacyClub(slug)
  if (!club) {
    throw createError({
      statusCode: 503,
      statusMessage: 'No legacy connection configured for this club (LEGACY_API_URL / LEGACY_API_KEY).',
    })
  }

  const { person, club: clubInfo } = await legacy.whoami(club, logintoken)

  return {
    person,
    club: {
      slug: club.slug,
      id: clubInfo.id,
      name: clubInfo.name,
      settings: clubInfo.settings,
      // The events UI renders as an organisation, so the embed needs this to
      // put the real board into the right club context.
      orgId: club.orgId,
    },
  }
})
