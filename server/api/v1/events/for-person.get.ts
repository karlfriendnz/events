import { db, schema } from '../../../db/client'
import { inArray } from 'drizzle-orm'
import { legacyClub, legacy, LEGACY_ID_PREFIX } from '../../../utils/legacy'
import { personIdVariants } from '../../../utils/legacyBridge'

/**
 * WHICH EVENTS ONE PERSON IS ON — their ids, nothing more.
 *
 * Backs the calendar's person view: the old platform's profile has an Events tab,
 * and it mounts this module scoped to that member. Without this the tab rendered
 * the whole club calendar, which looks like the feature working and is the one
 * thing it must not do — every member's tab showing every event.
 *
 * Ids only, deliberately. The board already has the events loaded; it needs to
 * know which are theirs, not a second copy of them.
 *
 * Covers BOTH systems: our own invitee rows, and (for a `legacy-` person) the old
 * platform's own answer, which knows about attendance we never see.
 */
export default defineEventHandler(async (event) => {
  const personId = String(getQuery(event).personId || '')
  if (!personId) throw createError({ statusCode: 400, statusMessage: 'personId required' })

  const ids = new Set<string>()

  // Ours — anything they've been invited to in this module. Under EITHER of their
  // ids: the profile asks as `legacy-<n>`, while an invite added here is stored
  // against our uuid for the same person.
  const rows = await db.select({ eventId: schema.invitees.eventId })
    .from(schema.invitees).where(inArray(schema.invitees.personId, await personIdVariants(personId)))
  for (const r of rows) if (r.eventId) ids.add(r.eventId)

  // Theirs. Best-effort: an unreachable platform should narrow the answer, never
  // fail the page — the tab still shows whatever this module knows about.
  if (personId.startsWith(LEGACY_ID_PREFIX)) {
    const club = legacyClub()
    if (club) {
      const pid = Number(personId.slice(LEGACY_ID_PREFIX.length))
      const theirs: any[] = await legacy.personEvents(club, pid).catch(() => [])
      for (const e of theirs ?? []) if (e?.id) ids.add(`${LEGACY_ID_PREFIX}${e.id}`)
    }
  }

  return [...ids]
})
