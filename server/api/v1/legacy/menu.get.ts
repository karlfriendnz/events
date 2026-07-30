import { legacyClub } from '~~/server/utils/legacy'
import { listCalendars } from '~~/server/db/repositories/waitlists'

/**
 * What the OLD platform's menu needs to know about this module.
 *
 * The module's own left rail is hidden while embedded — that shell supplies the
 * navigation — so anything the rail was the only route to becomes unreachable.
 * Pinned calendars are exactly that: a club pins "Holiday Programme" to its menu
 * and, inside the platform, nothing shows it.
 *
 * So the host menu renders them, and this is where it reads them from. Returns
 * ONLY the pinned ones, in the club's own order, with the icon and colour it
 * chose — the host builds one sub-item per row under its Events entry, pointing
 * back at `/events/calendar/<id>`.
 *
 * READ-ONLY and cheap by design: the host caches the answer in a setting rather
 * than calling this while rendering a menu on every page load (see MOUNTING.md
 * edit 6). An unreachable module must never be able to slow the platform down.
 */
export default defineEventHandler(async (event) => {
  const { club: slug } = getQuery(event)
  const club = legacyClub(typeof slug === 'string' ? slug : undefined)
  if (!club?.orgId) {
    throw createError({ statusCode: 503, statusMessage: 'No legacy connection configured for this club.' })
  }

  const calendars = await listCalendars(club.orgId)
  return {
    calendars: calendars
      .filter((c: any) => c.pinToNav)
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        // PrimeIcons name (`pi-calendar`) — the host maps it to its own icon set,
        // so it is sent bare rather than as a CSS class.
        icon: String(c.icon || '').replace(/^pi\s+/, '').replace(/^pi-/, '') || null,
        colour: c.color ?? null,
      })),
  }
})
